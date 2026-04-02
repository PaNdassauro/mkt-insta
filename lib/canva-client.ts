/**
 * Canva Connect API client for DashIG.
 * Handles token management, template listing, autofill, and export.
 *
 * Prerequisites: CANVA_CLIENT_ID and CANVA_CLIENT_SECRET env vars,
 * Canva developer app registration, and completed OAuth flow.
 *
 * Docs: https://www.canva.dev/docs/connect/
 */

import { createServerSupabaseClient } from '@/lib/supabase'
import { logger } from '@/lib/logger'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CanvaTemplate {
  id: string
  title: string
  thumbnail_url: string
  /** Variable field names defined in the template */
  fields: string[]
}

export interface CanvaDesign {
  id: string
  title: string
  export_url: string | null
  status: 'draft' | 'exporting' | 'ready'
  created_at: string
}

export interface CanvaExportResult {
  export_id: string
  status: 'pending' | 'completed' | 'failed'
  download_url: string | null
}

export interface AutofillData {
  title: string
  caption: string
  visualBrief: string
  [key: string]: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CANVA_API = 'https://api.canva.com/rest/v1'
const EXPORT_POLL_INTERVAL_MS = 2000
const EXPORT_POLL_MAX_ATTEMPTS = 30

// ---------------------------------------------------------------------------
// Token management
// ---------------------------------------------------------------------------

function assertConfigured(): void {
  if (!process.env.CANVA_CLIENT_ID || !process.env.CANVA_CLIENT_SECRET) {
    throw new Error(
      'Canva API not configured. Set CANVA_CLIENT_ID and CANVA_CLIENT_SECRET env vars. ' +
        'See docs/CANVA_API_INTEGRATION.md for setup instructions.'
    )
  }
}

/**
 * Fetch a valid Canva access token for the given account.
 * Automatically refreshes if the token is expired or about to expire.
 */
async function getCanvaToken(accountId?: string): Promise<string> {
  assertConfigured()

  const supabase = createServerSupabaseClient()

  let query = supabase.from('canva_tokens').select('*')

  if (accountId) {
    query = query.eq('account_id', accountId)
  }

  const { data, error } = await query.limit(1).single()

  if (error || !data) {
    throw new Error(
      `No Canva token found${accountId ? ` for account ${accountId}` : ''}. ` +
        'Connect your Canva account via Settings.'
    )
  }

  // Check if token is expired or expires within 5 minutes
  const now = new Date()
  const expiresAt = data.expires_at ? new Date(data.expires_at) : null
  const bufferMs = 5 * 60 * 1000

  if (expiresAt && expiresAt.getTime() - now.getTime() < bufferMs) {
    // Token is expired or about to expire — refresh it
    if (!data.refresh_token) {
      throw new Error(
        'Canva token expired and no refresh_token available. Re-authorize via Settings.'
      )
    }

    logger.info('Refreshing expired Canva token', 'CanvaClient', {
      accountId: data.account_id,
    })

    const refreshed = await refreshCanvaToken(data.refresh_token, data.account_id)
    return refreshed
  }

  return data.access_token
}

/**
 * Refresh a Canva access token using the refresh_token grant.
 */
async function refreshCanvaToken(
  refreshToken: string,
  accountId: string | null
): Promise<string> {
  const clientId = process.env.CANVA_CLIENT_ID!
  const clientSecret = process.env.CANVA_CLIENT_SECRET!

  const res = await fetch(`${CANVA_API}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })

  if (!res.ok) {
    const errBody = await res.text()
    logger.error('Failed to refresh Canva token', 'CanvaClient', { response: errBody })
    throw new Error('Failed to refresh Canva token. Re-authorize via Settings.')
  }

  const tokenData = await res.json()
  const newAccessToken: string = tokenData.access_token
  const newRefreshToken: string | undefined = tokenData.refresh_token
  const expiresIn: number | undefined = tokenData.expires_in

  const expiresAt = expiresIn
    ? new Date(Date.now() + expiresIn * 1000).toISOString()
    : null

  // Update tokens in the database
  const supabase = createServerSupabaseClient()
  const updateData: Record<string, unknown> = {
    access_token: newAccessToken,
    expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  }

  if (newRefreshToken) {
    updateData.refresh_token = newRefreshToken
  }

  if (accountId) {
    await supabase.from('canva_tokens').update(updateData).eq('account_id', accountId)
  } else {
    await supabase.from('canva_tokens').update(updateData).is('account_id', null)
  }

  logger.info('Canva token refreshed', 'CanvaClient', { accountId })

  return newAccessToken
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * List brand templates available in the connected Canva account.
 */
export async function listTemplates(accountId?: string): Promise<CanvaTemplate[]> {
  const token = await getCanvaToken(accountId)

  const res = await fetch(`${CANVA_API}/brand-templates`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) {
    const errBody = await res.text()
    logger.error('Failed to list Canva templates', 'CanvaClient', { response: errBody })
    throw new Error('Failed to list Canva templates')
  }

  const body = await res.json()
  const items = body.items ?? body.data ?? []

  return items.map(
    (item: Record<string, unknown>): CanvaTemplate => ({
      id: (item.id as string) ?? '',
      title: (item.title as string) ?? (item.name as string) ?? 'Untitled',
      thumbnail_url:
        ((item.thumbnail as Record<string, unknown>)?.url as string) ??
        (item.thumbnail_url as string) ??
        '',
      fields: Array.isArray(item.dataset)
        ? (item.dataset as Array<Record<string, string>>).map((f) => f.name)
        : [],
    })
  )
}

/**
 * Create a new design by filling a template with campaign data (Autofill).
 */
export async function createDesignFromTemplate(
  templateId: string,
  data: AutofillData,
  accountId?: string
): Promise<CanvaDesign> {
  const token = await getCanvaToken(accountId)

  const autofillData = Object.fromEntries(
    Object.entries(data)
      .filter(([k]) => k !== 'title')
      .map(([k, v]) => [k, { type: 'text', text: v }])
  )

  const res = await fetch(`${CANVA_API}/autofills`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      brand_template_id: templateId,
      title: data.title,
      data: autofillData,
    }),
  })

  if (!res.ok) {
    const errBody = await res.text()
    logger.error('Failed to create design from template', 'CanvaClient', {
      templateId,
      response: errBody,
    })
    throw new Error('Failed to create Canva design from template')
  }

  const body = await res.json()
  const job = body.job ?? body

  return {
    id: (job.design?.id as string) ?? (job.id as string) ?? '',
    title: data.title,
    export_url: null,
    status: 'draft',
    created_at: new Date().toISOString(),
  }
}

/**
 * Request an export of a design as PNG/JPG/PDF.
 * Polls until the export is complete and returns the download URL.
 */
export async function exportDesign(
  designId: string,
  format: 'png' | 'jpg' | 'pdf' = 'png',
  accountId?: string
): Promise<string> {
  const token = await getCanvaToken(accountId)

  // Start export
  const res = await fetch(`${CANVA_API}/designs/${designId}/exports`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ format }),
  })

  if (!res.ok) {
    const errBody = await res.text()
    logger.error('Failed to start Canva export', 'CanvaClient', {
      designId,
      format,
      response: errBody,
    })
    throw new Error('Failed to start Canva design export')
  }

  const body = await res.json()
  const exportId: string = body.job?.id ?? body.export_id ?? body.id ?? ''

  if (!exportId) {
    throw new Error('No export ID returned from Canva')
  }

  // Poll for completion
  for (let attempt = 0; attempt < EXPORT_POLL_MAX_ATTEMPTS; attempt++) {
    await sleep(EXPORT_POLL_INTERVAL_MS)

    const status = await getExportStatus(designId, exportId, token)

    if (status.status === 'completed' && status.download_url) {
      logger.info('Canva export completed', 'CanvaClient', { designId, exportId })
      return status.download_url
    }

    if (status.status === 'failed') {
      throw new Error(`Canva export failed for design ${designId}`)
    }
  }

  throw new Error(
    `Canva export timed out after ${EXPORT_POLL_MAX_ATTEMPTS * EXPORT_POLL_INTERVAL_MS / 1000}s`
  )
}

/**
 * Check the status of an ongoing export.
 */
export async function getExportStatus(
  designId: string,
  exportId: string,
  tokenOverride?: string
): Promise<CanvaExportResult> {
  const token = tokenOverride ?? (await getCanvaToken())

  const res = await fetch(`${CANVA_API}/designs/${designId}/exports/${exportId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) {
    const errBody = await res.text()
    logger.error('Failed to check Canva export status', 'CanvaClient', {
      designId,
      exportId,
      response: errBody,
    })
    throw new Error('Failed to check Canva export status')
  }

  const body = await res.json()
  const job = body.job ?? body

  return {
    export_id: exportId,
    status: mapExportStatus(job.status as string),
    download_url: (job.urls?.[0]?.url as string) ?? (job.url as string) ?? null,
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapExportStatus(status: string): 'pending' | 'completed' | 'failed' {
  switch (status?.toLowerCase()) {
    case 'completed':
    case 'success':
      return 'completed'
    case 'failed':
    case 'error':
      return 'failed'
    default:
      return 'pending'
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
