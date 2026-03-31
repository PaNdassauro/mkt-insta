import { logger } from '@/lib/logger'
import { apiError, getErrorMessage } from '@/lib/api-response'
import { validateDashboardRequest } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase'

export async function GET(request: Request) {
  const authError = validateDashboardRequest(request)
  if (authError) return authError

  try {
    const supabase = createServerSupabaseClient()

    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

    const [
      postsRes,
      reelsRes,
      storiesRes,
      campaignsRes,
      campaignPostsRes,
      calendarRes,
      commentsRes,
      snapshotsRes,
    ] = await Promise.all([
      supabase.from('instagram_posts').select('*'),
      supabase.from('instagram_reels').select('*'),
      supabase.from('instagram_stories').select('*'),
      supabase.from('instagram_campaigns').select('*'),
      supabase.from('campaign_posts').select('*'),
      supabase.from('instagram_editorial_calendar').select('*'),
      supabase.from('instagram_comments').select('*'),
      supabase
        .from('instagram_account_snapshots')
        .select('*')
        .gte('captured_at', ninetyDaysAgo.toISOString()),
    ])

    const exportData = {
      exported_at: new Date().toISOString(),
      instagram_posts: postsRes.data ?? [],
      instagram_reels: reelsRes.data ?? [],
      instagram_stories: storiesRes.data ?? [],
      instagram_campaigns: campaignsRes.data ?? [],
      campaign_posts: campaignPostsRes.data ?? [],
      instagram_editorial_calendar: calendarRes.data ?? [],
      instagram_comments: commentsRes.data ?? [],
      instagram_account_snapshots: snapshotsRes.data ?? [],
    }

    const jsonString = JSON.stringify(exportData, null, 2)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')

    logger.info('Full data export generated', 'AdminExport', {
      posts: exportData.instagram_posts.length,
      reels: exportData.instagram_reels.length,
      stories: exportData.instagram_stories.length,
    })

    return new Response(jsonString, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="dashig-export-${timestamp}.json"`,
      },
    })
  } catch (err) {
    logger.error('Export error', 'AdminExport', { error: err as Error })
    return apiError(getErrorMessage(err))
  }
}
