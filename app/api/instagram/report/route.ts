import { logger } from '@/lib/logger'
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
    logger.error('GET error', 'DashIG Report', { error: err as Error })
    return apiError(getErrorMessage(err))
  }
}

// POST — gera e envia por email via Resend (chamado pelo cron)
export async function POST(request: Request) {
  try {
    const authError = validateCronSecret(request)
    if (authError) return authError

    const report = await generateMonthlyReport()
    const html = reportToHtml(report)
    const monthLabel = `${report.month} ${report.year}`

    const resendKey = process.env.RESEND_API_KEY
    const recipientEmail = process.env.REPORT_EMAIL_TO || process.env.REPORT_RECIPIENT_EMAIL

    if (recipientEmail && resendKey) {
      const resend = new Resend(resendKey)
      const { error } = await resend.emails.send({
        from: 'DashIG <onboarding@resend.dev>',
        to: recipientEmail,
        subject: `Relatorio Mensal DashIG - ${monthLabel} | @welcomeweddings`,
        html,
      })

      if (error) throw new Error(JSON.stringify(error))

      logger.info(`Relatorio mensal enviado para ${recipientEmail}`, 'DashIG Report')

      return apiSuccess({
        success: true,
        sent_to: recipientEmail,
        month: monthLabel,
      })
    }

    // Sem email configurado — apenas gera o HTML
    logger.info('Relatorio mensal gerado (sem envio de email — REPORT_EMAIL_TO ou RESEND_API_KEY nao configurados)', 'DashIG Report')

    return apiSuccess({
      success: true,
      sent_to: null,
      month: monthLabel,
      note: 'Email nao enviado. Configure REPORT_EMAIL_TO e RESEND_API_KEY para envio automatico.',
    })
  } catch (err) {
    logger.error('POST error', 'DashIG Report', { error: err as Error })
    return apiError(getErrorMessage(err))
  }
}
