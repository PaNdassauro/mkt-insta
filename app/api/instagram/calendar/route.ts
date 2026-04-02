import { logger } from '@/lib/logger'
import { validateDashboardRequest } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase'
import { apiSuccess, apiError, getErrorMessage } from '@/lib/api-response'
import { resolveAccountId } from '@/lib/account-context'

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const accountId = await resolveAccountId(request)
    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month') // YYYY-MM
    const supabase = createServerSupabaseClient()

    let query = supabase
      .from('instagram_editorial_calendar')
      .select('*')
      .order('scheduled_for', { ascending: true })

    if (accountId) query = query.eq('account_id', accountId)

    if (month) {
      const start = `${month}-01T00:00:00Z`
      const [y, m] = month.split('-').map(Number)
      const end = new Date(y, m, 0, 23, 59, 59).toISOString()
      query = query.gte('scheduled_for', start).lte('scheduled_for', end)
    }

    const { data, error } = await query
    if (error) throw error

    return apiSuccess({ data })
  } catch (err) {
    logger.error('GET error', 'DashIG Calendar', { error: err as Error })
    return apiError(getErrorMessage(err))
  }
}

export async function POST(request: Request) {
  const authError = validateDashboardRequest(request)
  if (authError) return authError

  try {
    const body = await request.json()
    const { scheduled_for, content_type, topic, caption_draft, hashtags_plan, status, recurrence, recurrence_end } = body

    if (!scheduled_for || !content_type) {
      return apiError('scheduled_for and content_type are required', 400)
    }

    const parsedDate = new Date(scheduled_for)
    if (isNaN(parsedDate.getTime())) {
      return apiError('scheduled_for deve ser uma data ISO valida', 400)
    }

    const validContentTypes = ['REEL', 'CAROUSEL', 'IMAGE', 'STORY']
    if (!validContentTypes.includes(content_type)) {
      return apiError(`content_type invalido. Deve ser: ${validContentTypes.join(', ')}`, 400)
    }

    const validRecurrences = ['weekly', 'biweekly', 'monthly']
    if (recurrence && !validRecurrences.includes(recurrence)) {
      return apiError(`recurrence invalido. Deve ser: ${validRecurrences.join(', ')}`, 400)
    }

    const accountId = await resolveAccountId(request)
    const supabase = createServerSupabaseClient()

    const baseEntry = {
      scheduled_for,
      content_type,
      topic: topic || null,
      caption_draft: caption_draft || null,
      hashtags_plan: hashtags_plan || null,
      status: status || 'DRAFT',
      account_id: accountId,
      recurrence: recurrence || null,
      recurrence_end: recurrence_end || null,
    }

    // Criar primeira entrada
    const { data: firstEntry, error: firstError } = await supabase
      .from('instagram_editorial_calendar')
      .insert(baseEntry)
      .select()
      .single()

    if (firstError) throw firstError

    const allEntries = [firstEntry]

    // Se tem recorrencia, gerar entradas subsequentes
    if (recurrence) {
      const endDate = recurrence_end
        ? new Date(recurrence_end)
        : new Date(parsedDate.getTime() + 90 * 24 * 60 * 60 * 1000) // 3 meses

      const recurringEntries: Array<Record<string, unknown>> = []
      let nextDate = new Date(parsedDate)

      while (true) {
        if (recurrence === 'weekly') {
          nextDate = new Date(nextDate.getTime() + 7 * 24 * 60 * 60 * 1000)
        } else if (recurrence === 'biweekly') {
          nextDate = new Date(nextDate.getTime() + 14 * 24 * 60 * 60 * 1000)
        } else if (recurrence === 'monthly') {
          nextDate = new Date(nextDate)
          nextDate.setMonth(nextDate.getMonth() + 1)
        }

        if (nextDate > endDate) break

        recurringEntries.push({
          scheduled_for: nextDate.toISOString(),
          content_type,
          topic: topic || null,
          caption_draft: caption_draft || null,
          hashtags_plan: hashtags_plan || null,
          status: 'DRAFT',
          account_id: accountId,
          recurrence: recurrence,
          recurrence_end: recurrence_end || null,
        })
      }

      if (recurringEntries.length > 0) {
        const { data: extraEntries, error: extraError } = await supabase
          .from('instagram_editorial_calendar')
          .insert(recurringEntries)
          .select()

        if (extraError) throw extraError
        if (extraEntries) allEntries.push(...extraEntries)
      }
    }

    return apiSuccess({ data: allEntries })
  } catch (err) {
    logger.error('POST error', 'DashIG Calendar', { error: err as Error })
    return apiError(getErrorMessage(err))
  }
}

export async function PUT(request: Request) {
  const authError = validateDashboardRequest(request)
  if (authError) return authError

  try {
    const body = await request.json()
    const { id } = body

    if (!id) return apiError('id is required', 400)

    const allowedFields = [
      'scheduled_for', 'content_type', 'topic', 'caption_draft',
      'hashtags_plan', 'status', 'media_url', 'carousel_urls',
      'location_id', 'user_tags', 'alt_text', 'collaborators',
      'cover_url', 'auto_publish',
    ]
    const updates: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) updates[field] = body[field]
    }

    if (Object.keys(updates).length === 0) {
      return apiError('No valid fields to update', 400)
    }

    // Validar enums
    const validStatuses = ['DRAFT', 'APPROVED', 'PUBLISHED', 'CANCELLED']
    if (updates.status && !validStatuses.includes(updates.status as string)) {
      return apiError(`Invalid status. Must be: ${validStatuses.join(', ')}`, 400)
    }

    const validTypes = ['REEL', 'CAROUSEL', 'IMAGE', 'STORY']
    if (updates.content_type && !validTypes.includes(updates.content_type as string)) {
      return apiError(`Invalid content_type. Must be: ${validTypes.join(', ')}`, 400)
    }

    const supabase = createServerSupabaseClient()
    const { data, error } = await supabase
      .from('instagram_editorial_calendar')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return apiSuccess({ data })
  } catch (err) {
    logger.error('PUT error', 'DashIG Calendar', { error: err as Error })
    return apiError(getErrorMessage(err))
  }
}

export async function DELETE(request: Request) {
  const authError = validateDashboardRequest(request)
  if (authError) return authError

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return apiError('id is required', 400)

    const supabase = createServerSupabaseClient()

    // Limpar referencia em campaign_posts antes de deletar (FK sem CASCADE)
    await supabase
      .from('campaign_posts')
      .update({ calendar_entry_id: null })
      .eq('calendar_entry_id', id)

    const { error } = await supabase.from('instagram_editorial_calendar').delete().eq('id', id)
    if (error) throw error

    return apiSuccess({ success: true })
  } catch (err) {
    logger.error('DELETE error', 'DashIG Calendar', { error: err as Error })
    return apiError(getErrorMessage(err))
  }
}
