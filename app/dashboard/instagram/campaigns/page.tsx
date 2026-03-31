'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import type { Campaign } from '@/types/instagram'

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: string }> = {
  DRAFT: { label: 'Rascunho', className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400', icon: '📝' },
  GENERATING: { label: 'Gerando...', className: 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400', icon: '⏳' },
  REVIEW: { label: 'Em revisao', className: 'bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-400', icon: '👁' },
  APPROVED: { label: 'Aprovada', className: 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400', icon: '✅' },
  SCHEDULED: { label: 'Agendada', className: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900 dark:text-indigo-400', icon: '📅' },
  ARCHIVED: { label: 'Arquivada', className: 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500', icon: '📦' },
}

const FILTER_OPTIONS = [
  { value: 'all', label: 'Todas' },
  { value: 'DRAFT', label: 'Rascunhos' },
  { value: 'REVIEW', label: 'Em revisao' },
  { value: 'APPROVED', label: 'Aprovadas' },
  { value: 'SCHEDULED', label: 'Agendadas' },
  { value: 'ARCHIVED', label: 'Arquivadas' },
]

interface CampaignWithCount extends Campaign {
  post_count: number
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<CampaignWithCount[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  async function loadCampaigns() {
    try {
      const res = await fetch('/api/campaigns', { cache: 'no-store' })
      if (res.ok) setCampaigns(await res.json())
    } catch { /* silent */ }
    finally { setLoading(false) }
  }

  useEffect(() => { loadCampaigns() }, [])

  const filtered = useMemo(() => {
    let list = campaigns
    if (filter !== 'all') {
      list = list.filter((c) => c.status === filter)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          (c.theme && c.theme.toLowerCase().includes(q))
      )
    }
    return list
  }, [campaigns, filter, search])

  // Contadores por status
  const counts = useMemo(() => {
    const map: Record<string, number> = { all: campaigns.length }
    for (const c of campaigns) {
      map[c.status] = (map[c.status] ?? 0) + 1
    }
    return map
  }, [campaigns])

  async function archiveCampaign(id: string, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    try {
      const res = await fetch(`/api/campaigns/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ARCHIVED' }),
      })
      if (res.ok) {
        toast.success('Campanha arquivada')
        await loadCampaigns()
      } else {
        toast.error('Erro ao arquivar')
      }
    } catch { toast.error('Erro de conexao') }
  }

  async function deleteCampaign(id: string, title: string, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm(`Deletar "${title}"? Esta acao nao pode ser desfeita.`)) return
    try {
      const res = await fetch(`/api/campaigns/${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Campanha deletada')
        await loadCampaigns()
      } else {
        const data = await res.json().catch(() => ({ error: 'Erro desconhecido' }))
        toast.error(`Erro: ${data.error}`)
      }
    } catch { toast.error('Erro de conexao') }
  }

  if (loading) {
    return (
      <div className="space-y-4" role="status" aria-label="Carregando campanhas">
        <span className="sr-only">Carregando campanhas...</span>
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20" />)}
        </div>
        <div className="grid gap-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 w-full" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Campanhas</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Gerencie campanhas de conteudo geradas com IA
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Link href="/dashboard/instagram/campaigns/compare">
            <Button variant="outline" size="sm">Comparar</Button>
          </Link>
          <Link href="/dashboard/instagram/campaigns/new">
            <Button size="sm">Nova Campanha</Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-2xl font-bold">{campaigns.length}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-purple-600">{counts.REVIEW ?? 0}</p>
            <p className="text-xs text-muted-foreground">Em revisao</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-green-600">{counts.APPROVED ?? 0}</p>
            <p className="text-xs text-muted-foreground">Aprovadas</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-indigo-600">{counts.SCHEDULED ?? 0}</p>
            <p className="text-xs text-muted-foreground">Agendadas</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters + Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1 bg-muted/50 rounded-lg p-1 w-full sm:w-fit overflow-x-auto" role="group" aria-label="Filtros de status">
          {FILTER_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              size="sm"
              variant={filter === opt.value ? 'default' : 'ghost'}
              className="h-8 text-xs shrink-0"
              onClick={() => setFilter(opt.value)}
            >
              {opt.label}
              {counts[opt.value] !== undefined && (
                <span className="ml-1 text-[10px] opacity-60">({counts[opt.value]})</span>
              )}
            </Button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Buscar por nome ou tema..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 rounded-lg border bg-background px-3 text-xs w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-primary/20"
          aria-label="Buscar campanhas"
        />
      </div>

      {/* Campaign List */}
      {filtered.length === 0 ? (
        <Card className="border-2 border-dashed border-border/60 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-12">
            {search || filter !== 'all' ? (
              <>
                <p className="text-2xl mb-2">🔎</p>
                <p className="text-muted-foreground text-sm font-medium">
                  Nenhuma campanha encontrada com esses filtros.
                </p>
                <p className="text-muted-foreground text-xs mt-1">
                  Tente ajustar a busca ou remover os filtros aplicados.
                </p>
              </>
            ) : (
              <>
                <p className="text-3xl mb-3">🎯</p>
                <p className="text-muted-foreground text-sm font-medium">
                  Nenhuma campanha criada
                </p>
                <p className="text-muted-foreground text-xs mt-1">
                  Crie sua primeira campanha com IA para gerar conteudo automaticamente.
                </p>
                <Link href="/dashboard/instagram/campaigns/new" className="mt-4">
                  <Button size="sm">Criar campanha</Button>
                </Link>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3" aria-live="polite">
          {filtered.map((campaign) => {
            const statusCfg = STATUS_CONFIG[campaign.status] ?? STATUS_CONFIG.DRAFT
            const isArchived = campaign.status === 'ARCHIVED'

            return (
              <Card
                key={campaign.id}
                className={`border-0 shadow-sm hover:shadow-md transition-all ${isArchived ? 'opacity-60' : ''}`}
              >
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                    {/* Left: Info */}
                    <Link
                      href={
                        campaign.status === 'GENERATING'
                          ? `/dashboard/instagram/campaigns/new/generating?id=${campaign.id}`
                          : `/dashboard/instagram/campaigns/${campaign.id}`
                      }
                      className="flex-1 min-w-0"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-lg" aria-hidden="true">{statusCfg.icon}</span>
                        <h3 className="font-medium text-sm truncate hover:text-primary transition-colors">
                          {campaign.title}
                        </h3>
                        <Badge
                          variant="secondary"
                          className={`text-[10px] shrink-0 ${statusCfg.className}`}
                          aria-label={`Status: ${statusCfg.label}`}
                        >
                          {statusCfg.label}
                        </Badge>
                      </div>
                      {campaign.theme && (
                        <p className="text-xs text-muted-foreground mt-0.5 ml-8 truncate">
                          {campaign.theme}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 ml-8 text-xs text-muted-foreground">
                        <span>{campaign.post_count} posts</span>
                        {campaign.duration_days && <span>{campaign.duration_days} dias</span>}
                        {campaign.start_date && (
                          <span>Inicio: {new Date(campaign.start_date).toLocaleDateString('pt-BR')}</span>
                        )}
                        <span>Criada em {new Date(campaign.created_at).toLocaleDateString('pt-BR')}</span>
                        {campaign.objective && (
                          <span className="text-primary/70">Objetivo: {campaign.objective}</span>
                        )}
                      </div>
                    </Link>

                    {/* Right: Actions */}
                    <div className="flex flex-wrap gap-1 shrink-0">
                      <Link
                        href={`/dashboard/instagram/campaigns/${campaign.id}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button size="sm" variant="outline" className="text-xs h-7">
                          Editar
                        </Button>
                      </Link>
                      {(campaign.status === 'SCHEDULED' || campaign.status === 'APPROVED') && (
                        <Link
                          href={`/dashboard/instagram/campaigns/${campaign.id}/report`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button size="sm" variant="outline" className="text-xs h-7">
                            Relatorio
                          </Button>
                        </Link>
                      )}
                      {campaign.status !== 'ARCHIVED' && campaign.status !== 'GENERATING' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs h-7"
                          onClick={(e) => archiveCampaign(campaign.id, e)}
                        >
                          Arquivar
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs h-7 text-red-500 hover:text-red-600"
                        onClick={(e) => deleteCampaign(campaign.id, campaign.title, e)}
                      >
                        Excluir
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
