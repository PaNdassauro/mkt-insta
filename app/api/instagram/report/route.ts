import { generateMonthlyReport, reportToHtml } from '@/lib/report-generator'
import { Resend } from 'resend'
import { validateCronSecret } from '@/lib/auth'
import { apiSuccess, apiError, getErrorMessage } from '@/lib/api-response'

// GET — gera e retorna o relatorio como HTML
export async function GET() {
  try {
    const report = await generateMonthlyReport()
    const html = reportToHtml(report)

    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  } catch (err) {
    console.error('[DashIG Report GET] Error:', err)
    return apiError(getErrorMessage(err))
  }
}

// POST — gera e envia por email via Resend (chamado pelo cron)
export async function POST(request: Request) {
  try {
    const authError = validateCronSecret(request)
    if (authError) return authError

    const resendKey = process.env.RESEND_API_KEY
    const recipientEmail = process.env.REPORT_RECIPIENT_EMAIL

    if (!resendKey || !recipientEmail) {
      return apiError('RESEND_API_KEY and REPORT_RECIPIENT_EMAIL required', 500)
    }

    const report = await generateMonthlyReport()
    const html = reportToHtml(report)

    const resend = new Resend(resendKey)
    const { error } = await resend.emails.send({
      from: 'DashIG <onboarding@resend.dev>',
      to: recipientEmail,
      subject: `Relatorio Instagram — ${report.month} ${report.year} | @welcomeweddings`,
      html,
    })

    if (error) throw new Error(JSON.stringify(error))

    return apiSuccess({
      success: true,
      sent_to: recipientEmail,
      month: `${report.month} ${report.year}`,
    })
  } catch (err) {
    console.error('[DashIG Report POST] Error:', err)
    return apiError(getErrorMessage(err))
  }
}
