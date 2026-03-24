'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function ReportPage() {
  const [isGenerating, setIsGenerating] = useState(false)
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)

  const generatePreview = async () => {
    setIsGenerating(true)
    try {
      const res = await fetch('/api/instagram/report')
      const html = await res.text()
      setPreviewHtml(html)
    } catch {
      setPreviewHtml('<p style="padding:20px;color:red;">Erro ao gerar relatorio.</p>')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Relatorio</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Relatorio mensal consolidado — previsualizar ou enviar por email
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={generatePreview}
            disabled={isGenerating}
            variant="outline"
            className="h-9"
          >
            {isGenerating ? 'Gerando...' : 'Previsualizar'}
          </Button>
        </div>
      </div>

      {/* Info cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-0 shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-base">📋</span>
            <div>
              <p className="text-xs text-muted-foreground">Formato</p>
              <p className="text-sm font-medium">HTML / Email</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-base">📅</span>
            <div>
              <p className="text-xs text-muted-foreground">Envio automatico</p>
              <p className="text-sm font-medium">Dia 1 de cada mes</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-base">📧</span>
            <div>
              <p className="text-xs text-muted-foreground">Destinatario</p>
              <p className="text-sm font-medium">{process.env.NEXT_PUBLIC_REPORT_EMAIL ?? 'Configurar Resend'}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Preview */}
      {previewHtml && (
        <Card className="border-0 shadow-sm overflow-hidden">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold">Preview do Relatorio</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPreviewHtml(null)}
              className="text-xs"
            >
              Fechar
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <iframe
              srcDoc={previewHtml}
              className="w-full border-t"
              style={{ height: '800px' }}
              title="Report Preview"
            />
          </CardContent>
        </Card>
      )}

      {!previewHtml && (
        <div className="rounded-xl border-2 border-dashed border-border/60 p-12 text-center">
          <p className="text-lg font-medium text-muted-foreground">Clique em Previsualizar</p>
          <p className="mt-1 text-sm text-muted-foreground/70">
            O relatorio inclui KPIs, top posts, top reels e resumo de conteudo do mes anterior.
          </p>
        </div>
      )}
    </div>
  )
}
