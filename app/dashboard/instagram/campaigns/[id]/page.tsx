'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import PostEditor from '@/components/instagram/campaigns/PostEditor'
import CampaignTimeline from '@/components/instagram/campaigns/CampaignTimeline'
import ScheduleButton from '@/components/instagram/campaigns/ScheduleButton'
import StrategyChatPanel from '@/components/instagram/campaigns/StrategyChatPanel'
import type { Campaign, CampaignPost } from '@/types/instagram'

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  DRAFT: { label: 'Rascunho', className: 'bg-gray-50 text-gray-500' },
  GENERATING: { label: 'Gerando...', className: 'bg-blue-50 text-blue-500' },
  REVIEW: { label: 'Em Revisao', className: 'bg-purple-50 text-purple-600' },
  APPROVED: { label: 'Aprovada', className: 'bg-green-50 text-green-600' },
  SCHEDULED: { label: 'Agendada', className: 'bg-indigo-50 text-indigo-600' },
  ARCHIVED: { label: 'Arquivada', className: 'bg-gray-50 text-gray-400' },
}

export default function CampaignEditorPage() {
  const params = useParams()
  const router = useRouter()
  const campaignId = params.id as string

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [posts, setPosts] = useState<CampaignPost[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)

  const loadData = useCallback(async () => {
    try {
      const [campRes, postsRes] = await Promise.all([
        fetch(`/api/campaigns/${campaignId}`),
        fetch(`/api/campaigns/${campaignId}/posts`),
      ])

      if (campRes.ok) {
        setCampaign(await campRes.json())
      }
      if (postsRes.ok) {
        setPosts(await postsRes.json())
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [campaignId])

  useEffect(() => {
    loadData()
  }, [loadData])

  async function handleDeleteCampaign() {
    if (!confirm('Tem certeza que deseja deletar esta campanha? Esta acao nao pode ser desfeita.')) {
      return
    }
    setDeleting(true)
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, { method: 'DELETE' })
      if (res.ok) {
        router.replace('/dashboard/instagram/campaigns')
      } else {
        const data = await res.json().catch(() => ({ error: 'Erro desconhecido' }))
        alert(`Erro ao deletar: ${data.error}`)
      }
    } catch {
      alert('Erro de conexao ao deletar campanha')
    } finally {
      setDeleting(false)
    }
  }

  function handlePostUpdate(updated: CampaignPost) {
    setPosts((prev) =>
      prev.map((p) => (p.id === updated.id ? updated : p))
    )
    // Reload campaign to get updated status
    fetch(`/api/campaigns/${campaignId}`)
      .then((r) => r.json())
      .then(setCampaign)
      .catch(() => {})
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <div className="grid gap-3">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    )
  }

  if (!campaign) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Campanha nao encontrada.
      </div>
    )
  }

  const statusCfg = STATUS_BADGE[campaign.status] ?? STATUS_BADGE.DRAFT
  const sortedPosts = [...posts].sort((a, b) => a.post_order - b.post_order)
  const approvedCount = posts.filter((p) => p.status === 'APPROVED').length
  const pendingCount = posts.filter((p) => p.status === 'PENDING').length
  const revisionCount = posts.filter((p) => p.status === 'REVISION_REQUESTED').length

  return (
    <div className="space-y-6">
      {/* Back */}
      <Link
        href="/dashboard/instagram/campaigns"
        className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
      >
        ← Voltar para campanhas
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{campaign.title}</h1>
            <Badge variant="secondary" className={`text-xs ${statusCfg.className}`}>
              {statusCfg.label}
            </Badge>
          </div>
          {campaign.theme && (
            <p className="text-sm text-muted-foreground mt-1">{campaign.theme}</p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Schedule button — only when approved */}
          {campaign.status === 'APPROVED' && (
            <ScheduleButton
              campaignId={campaignId}
              onScheduled={() => {
                loadData()
                router.refresh()
              }}
            />
          )}

          {campaign.status === 'SCHEDULED' && (
            <div className="flex items-center gap-2 text-sm text-indigo-600">
              <span>Campanha agendada no calendario editorial</span>
            </div>
          )}

          <Link
            href={`/dashboard/instagram/campaigns/${campaignId}/report`}
            className="text-sm text-primary hover:underline"
          >
            Ver Relatorio
          </Link>

          <Link
            href="/dashboard/instagram/campaigns/compare"
            className="text-sm text-primary hover:underline"
          >
            Comparar Campanhas
          </Link>

          <Button
            variant="destructive"
            size="sm"
            disabled={deleting}
            onClick={handleDeleteCampaign}
          >
            {deleting ? 'Deletando...' : 'Deletar Campanha'}
          </Button>
        </div>
      </div>

      {/* Tags */}
      <TagsEditor campaignId={campaignId} tags={campaign.tags ?? []} onUpdate={loadData} />

      {/* Strategy Section */}
      {campaign.campaign_summary && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Resumo Estrategico</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm">{campaign.campaign_summary}</p>
              {campaign.strategic_rationale && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    Racional
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {campaign.strategic_rationale}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Justificativas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {campaign.format_strategy && (
                <div>
                  <p className="text-xs font-medium text-purple-600 mb-0.5">
                    Formatos
                  </p>
                  <p className="text-xs">{campaign.format_strategy}</p>
                </div>
              )}
              {campaign.timing_strategy && (
                <div>
                  <p className="text-xs font-medium text-blue-600 mb-0.5">
                    Datas e Horarios
                  </p>
                  <p className="text-xs">{campaign.timing_strategy}</p>
                </div>
              )}
              {campaign.expected_results && (
                <div>
                  <p className="text-xs font-medium text-green-600 mb-0.5">
                    Resultados Esperados
                  </p>
                  <p className="text-xs">{campaign.expected_results}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Strategy Chat */}
      {(campaign.status === 'REVIEW' || campaign.status === 'APPROVED') && (
        <StrategyChatPanel campaignId={campaignId} />
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {campaign.duration_days && (
          <MiniCard label="Duracao" value={`${campaign.duration_days} dias`} />
        )}
        {campaign.start_date && (
          <MiniCard
            label="Inicio"
            value={new Date(campaign.start_date).toLocaleDateString('pt-BR')}
          />
        )}
        <MiniCard label="Total" value={String(posts.length)} />
        <MiniCard
          label="Aprovados"
          value={`${approvedCount}/${posts.length}`}
          valueClass={approvedCount === posts.length ? 'text-green-600' : undefined}
        />
        {campaign.generation_time_ms && (
          <MiniCard
            label="Geracao"
            value={`${(campaign.generation_time_ms / 1000).toFixed(0)}s`}
          />
        )}
      </div>

      {/* Progress */}
      {posts.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Progresso de aprovacao</span>
            <span>
              {approvedCount} aprovados · {pendingCount} pendentes
              {revisionCount > 0 && ` · ${revisionCount} em revisao`}
            </span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden flex">
            <div
              className="h-full bg-green-500 transition-all"
              style={{ width: `${(approvedCount / posts.length) * 100}%` }}
            />
            <div
              className="h-full bg-yellow-400 transition-all"
              style={{ width: `${(revisionCount / posts.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Timeline */}
      <CampaignTimeline posts={posts} />

      <Separator />

      {/* Posts */}
      <div>
        <h2 className="text-lg font-semibold mb-4">
          Posts da Campanha ({posts.length})
        </h2>
        {sortedPosts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum post gerado ainda.</p>
        ) : (
          <div className="grid gap-4">
            {sortedPosts.map((post) => (
              <PostEditor
                key={post.id}
                post={post}
                campaignId={campaignId}
                onUpdate={handlePostUpdate}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function MiniCard({
  label,
  value,
  valueClass,
}: {
  label: string
  value: string
  valueClass?: string
}) {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-3 text-center">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-lg font-semibold ${valueClass ?? ''}`}>{value}</p>
      </CardContent>
    </Card>
  )
}

function TagsEditor({
  campaignId,
  tags,
  onUpdate,
}: {
  campaignId: string
  tags: string[]
  onUpdate: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [input, setInput] = useState(tags.join(', '))

  async function saveTags() {
    const newTags = input
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)

    await fetch(`/api/campaigns/${campaignId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags: newTags }),
    })
    setEditing(false)
    onUpdate()
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="casamento, welconnect, caribe"
          className="flex-1 rounded-lg border border-border/50 bg-background px-3 py-1.5 text-sm outline-none focus:border-primary"
          onKeyDown={(e) => e.key === 'Enter' && saveTags()}
        />
        <Button size="sm" onClick={saveTags}>
          Salvar
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
          Cancelar
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {tags.map((tag) => (
        <Badge key={tag} variant="secondary" className="text-xs">
          {tag}
        </Badge>
      ))}
      <button
        onClick={() => setEditing(true)}
        className="text-xs text-muted-foreground hover:text-foreground"
      >
        {tags.length > 0 ? 'Editar tags' : '+ Adicionar tags'}
      </button>
    </div>
  )
}
