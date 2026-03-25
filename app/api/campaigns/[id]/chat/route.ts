import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServerSupabaseClient } from '@/lib/supabase'
import { buildChatSystemPrompt } from '@/lib/campaign/system-prompt'

/**
 * POST /api/campaigns/[id]/chat
 * Chat estrategico com a IA sobre a campanha.
 * Permite ao analista questionar e discutir decisoes.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { messages } = body as {
      messages: Array<{ role: 'user' | 'assistant'; content: string }>
    }

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: 'messages is required' }, { status: 400 })
    }

    const supabase = createServerSupabaseClient()

    // Buscar campanha e posts para contexto
    const [{ data: campaign }, { data: posts }] = await Promise.all([
      supabase
        .from('instagram_campaigns')
        .select('*')
        .eq('id', id)
        .single(),
      supabase
        .from('campaign_posts')
        .select('post_order, format, scheduled_for, caption, hashtags, cta, strategic_note, status')
        .eq('campaign_id', id)
        .order('post_order'),
    ])

    if (!campaign) {
      return NextResponse.json({ error: 'Campanha nao encontrada' }, { status: 404 })
    }

    // Montar contexto
    const campaignContext = `
Titulo: ${campaign.title}
Objetivo: ${campaign.objective}
Tema: ${campaign.theme}
Publico: ${campaign.target_audience}
Duracao: ${campaign.duration_days} dias (inicio: ${campaign.start_date})

Resumo: ${campaign.campaign_summary}
Racional estrategico: ${campaign.strategic_rationale}
${campaign.format_strategy ? `Estrategia de formatos: ${campaign.format_strategy}` : ''}
${campaign.timing_strategy ? `Estrategia de timing: ${campaign.timing_strategy}` : ''}
${campaign.expected_results ? `Resultados esperados: ${campaign.expected_results}` : ''}

Posts (${posts?.length ?? 0}):
${(posts ?? []).map((p) => `#${p.post_order} [${p.format}] ${p.scheduled_for ? new Date(p.scheduled_for).toLocaleDateString('pt-BR') : 'sem data'} — ${p.strategic_note ?? 'sem nota'} (${p.status})`).join('\n')}
`.trim()

    const systemPrompt = buildChatSystemPrompt(campaignContext)

    const anthropic = new Anthropic({ maxRetries: 3 })

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: systemPrompt,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    })

    const assistantMessage =
      response.content[0].type === 'text' ? response.content[0].text : ''

    return NextResponse.json({ message: assistantMessage })
  } catch (err) {
    console.error('[Campaign Chat]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    )
  }
}
