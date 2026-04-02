import Anthropic from '@anthropic-ai/sdk'
import { logger } from '@/lib/logger'
import { apiError, getErrorMessage } from '@/lib/api-response'
import { validateDashboardRequest } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase'
import { buildPrompt, type CampaignBriefing } from '@/lib/campaign/prompt-builder'
import { extractJSON } from '@/lib/campaign/campaign-parser'
import { logActivity } from '@/lib/activity'
import { resolveAccountId } from '@/lib/account-context'

export const dynamic = "force-dynamic"

/**
 * POST /api/campaigns/generate
 * Gera uma campanha completa via Claude API com streaming.
 */
export async function POST(request: Request) {
  const authError = validateDashboardRequest(request)
  if (authError) return authError

  const startTime = Date.now()

  try {
    const body = await request.json()
    const briefing = body as CampaignBriefing

    if (!briefing.title || !briefing.objective || !briefing.theme) {
      return apiError('title, objective and theme are required', 400)
    }

    const accountId = await resolveAccountId(request)
    const supabase = createServerSupabaseClient()

    // 1. Criar campanha com status GENERATING
    const { data: campaign, error: createError } = await supabase
      .from('instagram_campaigns')
      .insert({
        title: briefing.title,
        status: 'GENERATING',
        objective: briefing.objective,
        target_audience: briefing.target_audience,
        theme: briefing.theme,
        tone_notes: briefing.tone_notes ?? null,
        duration_days: briefing.duration_days,
        start_date: briefing.start_date,
        preferred_formats: briefing.preferred_formats,
        account_id: accountId,
      })
      .select()
      .single()

    if (createError) {
      throw new Error(`Failed to create campaign: ${createError.message}`)
    }

    // 2. Montar prompt com 3 camadas de contexto
    const { systemPrompt, userPrompt, chunksUsed } =
      await buildPrompt(briefing)

    // 3. Chamar Claude API com streaming (retry automatico para 429/529)
    const anthropic = new Anthropic({ maxRetries: 3 })

    const stream = anthropic.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })

    let fullText = ''

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === 'content_block_delta' &&
              event.delta.type === 'text_delta'
            ) {
              fullText += event.delta.text
              controller.enqueue(
                new TextEncoder().encode(event.delta.text)
              )
            }
          }

          // 4. Parse e persiste resultado
          const campaignOutput = extractJSON(fullText)
          const generationTime = Date.now() - startTime

          // Atualizar campanha
          await supabase
            .from('instagram_campaigns')
            .update({
              status: 'REVIEW',
              campaign_summary: campaignOutput.campaign_summary,
              strategic_rationale: campaignOutput.strategic_rationale,
              format_strategy: campaignOutput.format_strategy || null,
              timing_strategy: campaignOutput.timing_strategy || null,
              expected_results: campaignOutput.expected_results || null,
              context_chunks_used: chunksUsed,
              model_used: 'claude-sonnet-4-20250514',
              generation_time_ms: generationTime,
              generated_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', campaign.id)

          // Inserir posts
          const postRows = campaignOutput.posts.map((post) => ({
            campaign_id: campaign.id,
            post_order: post.post_order,
            format: post.format,
            scheduled_for: post.scheduled_for ?? null,
            caption: post.caption,
            hashtags: post.hashtags,
            cta: post.cta,
            visual_brief: post.visual_brief,
            strategic_note: post.strategic_note ?? null,
            reel_concept: post.reel_concept ?? null,
            reel_duration: post.reel_duration ?? null,
            audio_suggestion: post.audio_suggestion ?? null,
            slides: post.slides ?? null,
            status: 'PENDING',
          }))

          await supabase.from('campaign_posts').insert(postRows)

          // Registrar atividade
          await logActivity({
            action: 'campaign.created',
            entityType: 'campaign',
            entityId: campaign.id,
            details: {
              title: briefing.title,
              postsCount: postRows.length,
              generationTimeMs: generationTime,
            },
          })

          // Enviar metadata final como JSON separado por newline
          const metadata = JSON.stringify({
            __done: true,
            campaign_id: campaign.id,
            posts_created: postRows.length,
            generation_time_ms: generationTime,
            chunks_used: chunksUsed,
          })
          controller.enqueue(
            new TextEncoder().encode(`\n---METADATA---\n${metadata}`)
          )

          controller.close()
        } catch (err) {
          logger.error('Stream error', 'Campaign Generate', {
            error: err as Error,
            fullTextLength: fullText.length,
            fullTextPreview: fullText.substring(0, 300),
          })

          // Marcar campanha como DRAFT em caso de erro
          await supabase
            .from('instagram_campaigns')
            .update({ status: 'DRAFT', updated_at: new Date().toISOString() })
            .eq('id', campaign.id)

          const errorMsg = getErrorMessage(err)
          controller.enqueue(
            new TextEncoder().encode(
              `\n---ERROR---\n${JSON.stringify({ error: errorMsg })}`
            )
          )
          controller.close()
        }
      },
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'X-Campaign-Id': campaign.id,
      },
    })
  } catch (err) {
    logger.error('Generation failed', 'Campaign Generate', { error: err as Error })
    return apiError(getErrorMessage(err))
  }
}
