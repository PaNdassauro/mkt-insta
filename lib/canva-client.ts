/**
 * Canva Connect API client stub.
 * Prerequisites: CANVA_CLIENT_ID and CANVA_CLIENT_SECRET env vars, Canva developer app registration.
 * Docs: https://www.canva.dev/docs/connect/
 *
 * This is a placeholder module — no real API calls are made.
 * Implement when Canva developer app is registered and OAuth flow is in place.
 */

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
// Helpers
// ---------------------------------------------------------------------------

function assertConfigured(): void {
  if (!process.env.CANVA_CLIENT_ID || !process.env.CANVA_CLIENT_SECRET) {
    throw new Error(
      'Canva API not configured. Set CANVA_CLIENT_ID and CANVA_CLIENT_SECRET env vars. ' +
        'See docs/CANVA_API_INTEGRATION.md for setup instructions.'
    )
  }
}

// ---------------------------------------------------------------------------
// Public API (stubs)
// ---------------------------------------------------------------------------

/**
 * List brand templates available in the connected Canva account.
 */
export async function listTemplates(): Promise<CanvaTemplate[]> {
  assertConfigured()
  // TODO: GET /v1/designs?ownership=owned&type=template
  throw new Error('Not implemented — listTemplates')
}

/**
 * Create a new design by filling a template with campaign data (Autofill).
 */
export async function createDesignFromTemplate(
  templateId: string,
  data: AutofillData
): Promise<CanvaDesign> {
  assertConfigured()
  // TODO: POST /v1/autofill  { brand_template_id, data }
  console.log('createDesignFromTemplate stub called', { templateId, data })
  throw new Error('Not implemented — createDesignFromTemplate')
}

/**
 * Request an export of a design as PNG/JPG.
 * Returns a download URL when the export is complete.
 */
export async function exportDesign(
  designId: string,
  format: 'png' | 'jpg' | 'pdf' = 'png'
): Promise<string> {
  assertConfigured()
  // TODO: POST /v1/designs/{designId}/exports  { format }
  //       Then poll GET /v1/designs/{designId}/exports/{exportId} until completed
  console.log('exportDesign stub called', { designId, format })
  throw new Error('Not implemented — exportDesign')
}

/**
 * Check the status of an ongoing export.
 */
export async function getExportStatus(
  designId: string,
  exportId: string
): Promise<CanvaExportResult> {
  assertConfigured()
  // TODO: GET /v1/designs/{designId}/exports/{exportId}
  console.log('getExportStatus stub called', { designId, exportId })
  throw new Error('Not implemented — getExportStatus')
}
