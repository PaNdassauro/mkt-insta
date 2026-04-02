'use client'

import { fetchWithAccount } from '@/lib/fetch-with-account'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import type { CampaignPost } from '@/types/instagram'

interface CanvaTemplate {
  id: string
  title: string
  thumbnail_url: string
  fields: string[]
}

interface PostGenerationState {
  status: 'idle' | 'generating' | 'generated' | 'exporting' | 'exported' | 'error'
  design_id?: string
  download_url?: string
  error?: string
}

interface CanvaAssetGeneratorProps {
  campaignId: string
  posts: CampaignPost[]
}

export default function CanvaAssetGenerator({ campaignId, posts }: CanvaAssetGeneratorProps) {
  const [canvaConnected, setCanvaConnected] = useState<boolean | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [templates, setTemplates] = useState<CanvaTemplate[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [postStates, setPostStates] = useState<Record<string, PostGenerationState>>({})

  const approvedPosts = posts.filter((p) => p.status === 'APPROVED')

  // Check Canva connection status
  useEffect(() => {
    fetchWithAccount('/api/auth/canva/status')
      .then((r) => r.json())
      .then((data) => setCanvaConnected(data.connected ?? false))
      .catch(() => setCanvaConnected(false))
  }, [])

  // Load templates when panel is opened
  const loadTemplates = useCallback(async () => {
    setTemplatesLoading(true)
    try {
      const res = await fetchWithAccount('/api/canva/templates')
      const data = await res.json()
      if (data.connected && data.templates?.length > 0) {
        setTemplates(data.templates)
      } else {
        // Show placeholder templates when Canva is not fully configured
        setTemplates([])
      }
    } catch {
      setTemplates([])
    } finally {
      setTemplatesLoading(false)
    }
  }, [])

  const handleOpenPanel = () => {
    setPanelOpen(true)
    loadTemplates()
  }

  const handleGenerate = async (post: CampaignPost) => {
    if (!selectedTemplate) return

    setPostStates((prev) => ({
      ...prev,
      [post.id]: { status: 'generating' },
    }))

    try {
      const res = await fetchWithAccount('/api/canva/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_id: selectedTemplate,
          post_id: post.id,
          campaign_id: campaignId,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erro desconhecido' }))
        setPostStates((prev) => ({
          ...prev,
          [post.id]: { status: 'error', error: err.error },
        }))
        return
      }

      const design = await res.json()
      setPostStates((prev) => ({
        ...prev,
        [post.id]: { status: 'generated', design_id: design.id },
      }))
    } catch {
      setPostStates((prev) => ({
        ...prev,
        [post.id]: { status: 'error', error: 'Erro de conexao' },
      }))
    }
  }

  const handleExport = async (post: CampaignPost) => {
    const state = postStates[post.id]
    if (!state?.design_id) return

    setPostStates((prev) => ({
      ...prev,
      [post.id]: { ...prev[post.id], status: 'exporting' },
    }))

    try {
      const res = await fetchWithAccount('/api/canva/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ design_id: state.design_id }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erro desconhecido' }))
        setPostStates((prev) => ({
          ...prev,
          [post.id]: { ...prev[post.id], status: 'error', error: err.error },
        }))
        return
      }

      const data = await res.json()
      setPostStates((prev) => ({
        ...prev,
        [post.id]: {
          ...prev[post.id],
          status: 'exported',
          download_url: data.download_url,
        },
      }))
    } catch {
      setPostStates((prev) => ({
        ...prev,
        [post.id]: { ...prev[post.id], status: 'error', error: 'Erro de conexao' },
      }))
    }
  }

  // Loading state
  if (canvaConnected === null) {
    return <Skeleton className="h-9 w-36" />
  }

  // Not connected — show connect button
  if (!canvaConnected) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => window.open('/api/auth/canva', '_self')}
      >
        Conectar Canva
      </Button>
    )
  }

  // No approved posts
  if (approvedPosts.length === 0) {
    return (
      <Button variant="outline" size="sm" disabled className="opacity-60 cursor-not-allowed">
        Gerar Assets (Canva)
      </Button>
    )
  }

  // Connected — show main button and panel
  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={panelOpen ? () => setPanelOpen(false) : handleOpenPanel}
      >
        {panelOpen ? 'Fechar Canva' : 'Gerar Assets (Canva)'}
      </Button>

      {panelOpen && (
        <Card className="absolute right-0 top-full mt-2 z-50 w-[520px] border shadow-lg">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Gerador de Assets — Canva</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Template selector */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Template Canva
              </label>
              {templatesLoading ? (
                <Skeleton className="h-9 w-full" />
              ) : templates.length > 0 ? (
                <select
                  className="w-full rounded-lg border border-border/50 bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                  value={selectedTemplate ?? ''}
                  onChange={(e) => setSelectedTemplate(e.target.value || null)}
                >
                  <option value="">Selecione um template...</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="rounded-lg border border-dashed border-border/60 p-3 text-center">
                  <p className="text-xs text-muted-foreground">
                    Nenhum template disponivel. Configure templates com campos variaveis no Canva
                    ou verifique se a API esta conectada corretamente.
                  </p>
                </div>
              )}
            </div>

            {/* Posts list */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Posts aprovados ({approvedPosts.length})
              </p>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {approvedPosts.map((post) => {
                  const state = postStates[post.id] ?? { status: 'idle' }
                  const formatLabel =
                    post.format === 'REEL'
                      ? 'Reel'
                      : post.format === 'CAROUSEL'
                        ? 'Carrossel'
                        : post.format === 'STORY'
                          ? 'Story'
                          : 'Imagem'

                  return (
                    <div
                      key={post.id}
                      className="flex items-center gap-3 rounded-lg border border-border/40 p-2.5"
                    >
                      {/* Post info */}
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <Badge variant="secondary" className="text-[10px] shrink-0">
                          #{post.post_order}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {formatLabel}
                        </Badge>
                        <span className="text-xs text-muted-foreground truncate">
                          {(post.caption_edited || post.caption || '').substring(0, 40)}...
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        {state.status === 'idle' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            disabled={!selectedTemplate}
                            onClick={() => handleGenerate(post)}
                          >
                            Gerar
                          </Button>
                        )}

                        {state.status === 'generating' && (
                          <span className="text-xs text-blue-600 animate-pulse">Gerando...</span>
                        )}

                        {state.status === 'generated' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => handleExport(post)}
                          >
                            Exportar
                          </Button>
                        )}

                        {state.status === 'exporting' && (
                          <span className="text-xs text-blue-600 animate-pulse">
                            Exportando...
                          </span>
                        )}

                        {state.status === 'exported' && state.download_url && (
                          <div className="flex items-center gap-2">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={state.download_url}
                              alt={`Preview post #${post.post_order}`}
                              className="h-8 w-8 rounded object-cover border"
                            />
                            <a
                              href={state.download_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline"
                            >
                              Download
                            </a>
                          </div>
                        )}

                        {state.status === 'error' && (
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-red-500 max-w-[120px] truncate" title={state.error}>
                              {state.error || 'Erro'}
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 text-[10px] px-1.5"
                              onClick={() =>
                                setPostStates((prev) => ({
                                  ...prev,
                                  [post.id]: { status: 'idle' },
                                }))
                              }
                            >
                              Tentar novamente
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Info note */}
            <p className="text-[10px] text-muted-foreground/70">
              Os templates devem ter campos variaveis configurados no Canva (titulo, caption, cta).
              Consulte a documentacao para mais detalhes.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
