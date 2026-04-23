'use client'

import { fetchWithAccount } from '@/lib/fetch-with-account'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

interface SyncInfo {
  tipo: string
  ultimaExecucao: string | null
  status: string
}

interface CronJob {
  nome: string
  schedule: string
  descricao: string
  frequencia: string
}

interface SyncHistoryEntry {
  date: string
  createdAt: string
  success: boolean
}

interface StorageUsage {
  storyMediaFiles: number
  totalCampaigns: number
  totalDocuments: number
  totalChunks: number
}

interface MetaApiQuota {
  note: string
  monitorUrl: string
  estimatedCallsPerSync: number
  hourlyLimit: number
}

interface PerformanceData {
  apiResponseTimes: Array<{ endpoint: string; avgMs: number | null }>
  syncHistory: SyncHistoryEntry[]
  storageUsage: StorageUsage
  metaApiQuota: MetaApiQuota
}

interface ReportInfo {
  lastReportDate: string | null
  emailConfigured: boolean
  emailTo: string | null
}

interface InstagramAccountInfo {
  igUserId: string | null
  adAccountId: string | null
  pageId: string | null
  username: string | null
  name: string | null
  profilePictureUrl: string | null
  followersCount: number | null
  mediaCount: number | null
}

interface SystemHealthData {
  token: {
    status: string
    daysLeft: number
    expiresAt?: number | null
    warning?: boolean
    warningThresholdDays?: number
  }
  instagramAccount?: InstagramAccountInfo
  lastSyncs: SyncInfo[]
  cronJobs: CronJob[]
  telegram: { configured: boolean }
  webhook?: { configured: boolean }
  dbStats: {
    posts: number
    reels: number
    stories: number
    campaigns: number
    comments: number
  }
  storageInfo: { storyMediaFiles: number }
  performance: PerformanceData
  report: ReportInfo
}

function IdRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-md bg-muted/40 p-2.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-xs font-mono break-all">{value ?? 'não configurado'}</div>
    </div>
  )
}

function StatusDot({ color }: { color: 'green' | 'yellow' | 'red' }) {
  const bgClass =
    color === 'green'
      ? 'bg-green-500'
      : color === 'yellow'
        ? 'bg-yellow-500'
        : 'bg-red-500'
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${bgClass}`} />
}

function formatDateTime(iso: string | null): string {
  if (!iso) return 'Nunca'
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getSyncColor(ultimaExecucao: string | null): 'green' | 'yellow' | 'red' {
  if (!ultimaExecucao) return 'red'
  const hoursAgo = (Date.now() - new Date(ultimaExecucao).getTime()) / (1000 * 60 * 60)
  if (hoursAgo <= 24) return 'green'
  if (hoursAgo <= 72) return 'yellow'
  return 'red'
}

export default function SystemHealthPage() {
  const [data, setData] = useState<SystemHealthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [refreshingToken, setRefreshingToken] = useState(false)
  const [testingTelegram, setTestingTelegram] = useState(false)
  const [testingWebhook, setTestingWebhook] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [backfilling, setBackfilling] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetchWithAccount('/api/settings/system')
      if (res.ok) {
        setData(await res.json())
      } else {
        toast.error('Erro ao carregar dados do sistema')
      }
    } catch {
      toast.error('Erro ao carregar dados do sistema')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  async function handleSync() {
    setSyncing(true)
    try {
      const res = await fetchWithAccount('/api/instagram/manual-sync', { method: 'POST' })
      if (res.ok) {
        toast.success('Sync iniciado com sucesso')
        // Refresh data after a short delay
        setTimeout(() => fetchData(), 3000)
      } else {
        const body = await res.json()
        toast.error(body.error ?? 'Erro ao iniciar sync')
      }
    } catch {
      toast.error('Erro ao iniciar sync')
    } finally {
      setSyncing(false)
    }
  }

  async function handleRefreshToken() {
    setRefreshingToken(true)
    try {
      const res = await fetchWithAccount('/api/instagram/manual-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'refresh-token' }),
      })
      const body = await res.json()
      if (res.ok) {
        toast.success('Token renovado com sucesso')
        fetchData()
      } else {
        toast.error(body.error ?? 'Erro ao renovar token')
      }
    } catch {
      toast.error('Erro ao renovar token')
    } finally {
      setRefreshingToken(false)
    }
  }

  async function handleBackfillMedia() {
    setBackfilling(true)
    try {
      const res = await fetchWithAccount('/api/instagram/manual-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'backfill-media' }),
      })
      const body = await res.json()
      if (res.ok) {
        const result = body?.results?.['backfill-media?limit=500']?.report
        if (result) {
          const total = (result.posts_updated ?? 0) + (result.reels_updated ?? 0)
          toast.success(
            `Backfill concluido: ${result.posts_updated} posts e ${result.reels_updated} reels recuperados (${result.upload_failures} falhas)`,
            { duration: 8000 }
          )
          if (total === 0) {
            toast.info('Nenhuma midia foi atualizada — confira se o sync ja persistiu tudo.', { duration: 6000 })
          }
        } else {
          toast.success('Backfill iniciado')
        }
      } else {
        toast.error(body.error ?? 'Erro ao executar backfill')
      }
    } catch {
      toast.error('Erro ao executar backfill')
    } finally {
      setBackfilling(false)
    }
  }

  async function handleTestTelegram() {
    setTestingTelegram(true)
    try {
      const res = await fetchWithAccount('/api/settings/telegram-test', { method: 'POST' })
      const body = await res.json()
      if (res.ok) {
        toast.success('Mensagem de teste enviada')
      } else {
        toast.error(body.error ?? 'Erro ao enviar mensagem de teste')
      }
    } catch {
      toast.error('Erro ao enviar mensagem de teste')
    } finally {
      setTestingTelegram(false)
    }
  }

  async function handleTestWebhook() {
    setTestingWebhook(true)
    try {
      const res = await fetchWithAccount('/api/settings/webhook-test', { method: 'POST' })
      const body = await res.json()
      if (res.ok) {
        toast.success('Webhook de teste enviado')
      } else {
        toast.error(body.error ?? 'Erro ao enviar webhook de teste')
      }
    } catch {
      toast.error('Erro ao enviar webhook de teste')
    } finally {
      setTestingWebhook(false)
    }
  }

  async function handleExport() {
    setExporting(true)
    try {
      const res = await fetchWithAccount('/api/admin/export-all')
      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        const disposition = res.headers.get('Content-Disposition')
        const filenameMatch = disposition?.match(/filename="(.+)"/)
        a.download = filenameMatch?.[1] ?? 'dashig-export.json'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        toast.success('Exportacao concluida')
      } else {
        const body = await res.json()
        toast.error(body.error ?? 'Erro ao exportar dados')
      }
    } catch {
      toast.error('Erro ao exportar dados')
    } finally {
      setExporting(false)
    }
  }

  function getTokenColor(): 'green' | 'yellow' | 'red' {
    if (!data) return 'red'
    const threshold = data.token.warningThresholdDays ?? 60
    if (data.token.status === 'valid' && data.token.daysLeft >= threshold) return 'green'
    if (data.token.status === 'valid') return 'yellow'
    return 'red'
  }

  function getTokenLabel(): string {
    if (!data) return 'Desconhecido'
    if (data.token.status === 'unknown') return 'Desconhecido'
    if (data.token.daysLeft <= 0) return 'Expirado'
    return `${data.token.daysLeft} dias restantes`
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sistema</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Saude do sistema e informacoes tecnicas
          </p>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    )
  }

  const tokenExpired = data?.token.status === 'expired' || (data?.token.daysLeft ?? 0) <= 0
  const tokenWarning = data?.token.warning === true
  const tokenExpiresAtDate = data?.token.expiresAt
    ? new Date(data.token.expiresAt * 1000).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Sistema</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Saúde do sistema e informações técnicas
        </p>
      </div>

      {/* Token expiration banner */}
      {tokenExpired && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          <div className="font-semibold">Token Meta expirado</div>
          <div className="mt-1">
            O token em <code className="rounded bg-red-100 px-1 py-0.5 text-xs dark:bg-red-900/40">META_ACCESS_TOKEN</code> (.env) está expirado. Gere um novo no Meta Graph API Explorer, substitua no <code className="rounded bg-red-100 px-1 py-0.5 text-xs dark:bg-red-900/40">.env</code> e reinicie o servidor.
          </div>
        </div>
      )}
      {!tokenExpired && tokenWarning && (
        <div className="rounded-md border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-900 dark:border-yellow-900 dark:bg-yellow-950/40 dark:text-yellow-200">
          <div className="font-semibold">Token Meta expira em breve</div>
          <div className="mt-1">
            Restam <strong>{data?.token.daysLeft} dias</strong>
            {tokenExpiresAtDate && <> (expira em {tokenExpiresAtDate})</>}. Gere um novo token em <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener noreferrer" className="underline">Graph API Explorer</a>, substitua <code className="rounded bg-yellow-100 px-1 py-0.5 text-xs dark:bg-yellow-900/40">META_ACCESS_TOKEN</code> no <code className="rounded bg-yellow-100 px-1 py-0.5 text-xs dark:bg-yellow-900/40">.env</code> e reinicie o servidor antes da expiração.
          </div>
        </div>
      )}

      {/* Section 0: Conta Instagram */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold mb-4">Conta Instagram</h2>
          <div className="flex items-start gap-4">
            {data?.instagramAccount?.profilePictureUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={data.instagramAccount.profilePictureUrl}
                alt={data.instagramAccount.username ?? 'Perfil'}
                className="h-16 w-16 rounded-full object-cover"
              />
            ) : (
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center text-2xl">📷</div>
            )}
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-semibold text-lg">
                  {data?.instagramAccount?.username ? `@${data.instagramAccount.username}` : '—'}
                </span>
                {data?.instagramAccount?.name && (
                  <span className="text-sm text-muted-foreground">{data.instagramAccount.name}</span>
                )}
              </div>
              <div className="flex flex-wrap gap-4 text-sm">
                <span>
                  <strong className="tabular-nums">
                    {data?.instagramAccount?.followersCount?.toLocaleString('pt-BR') ?? '—'}
                  </strong>
                  <span className="text-muted-foreground ml-1">seguidores</span>
                </span>
                <span>
                  <strong className="tabular-nums">
                    {data?.instagramAccount?.mediaCount?.toLocaleString('pt-BR') ?? '—'}
                  </strong>
                  <span className="text-muted-foreground ml-1">publicações</span>
                </span>
              </div>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <IdRow label="IG User ID" value={data?.instagramAccount?.igUserId ?? null} />
            <IdRow label="Ad Account ID" value={data?.instagramAccount?.adAccountId ?? null} />
            <IdRow label="Facebook Page ID" value={data?.instagramAccount?.pageId ?? null} />
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Esses valores vêm das variáveis <code className="rounded bg-muted px-1 py-0.5">META_IG_USER_ID</code>, <code className="rounded bg-muted px-1 py-0.5">META_AD_ACCOUNT_ID</code> e <code className="rounded bg-muted px-1 py-0.5">META_PAGE_ID</code> no <code className="rounded bg-muted px-1 py-0.5">.env</code>.
          </p>
        </CardContent>
      </Card>

      {/* Section 1: Status Geral */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold mb-4">Status Geral</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <StatusDot color={getTokenColor()} />
                <span className="text-sm">Token Meta</span>
              </div>
              <Badge
                className={
                  getTokenColor() === 'green'
                    ? 'bg-green-50 text-green-600 border-0 dark:bg-green-950 dark:text-green-400'
                    : getTokenColor() === 'yellow'
                      ? 'bg-yellow-50 text-yellow-600 border-0 dark:bg-yellow-950 dark:text-yellow-400'
                      : 'bg-red-50 text-red-600 border-0 dark:bg-red-950 dark:text-red-400'
                }
              >
                {getTokenLabel()}
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <StatusDot
                  color={
                    data?.lastSyncs.some((s) => s.ultimaExecucao)
                      ? getSyncColor(
                          data?.lastSyncs
                            .filter((s) => s.ultimaExecucao)
                            .sort(
                              (a, b) =>
                                new Date(b.ultimaExecucao!).getTime() -
                                new Date(a.ultimaExecucao!).getTime()
                            )[0]?.ultimaExecucao ?? null
                        )
                      : 'red'
                  }
                />
                <span className="text-sm">Ultimo Sync</span>
              </div>
              <span className="text-sm text-muted-foreground">
                {data?.lastSyncs.find((s) => s.ultimaExecucao)
                  ? formatDateTime(
                      data.lastSyncs
                        .filter((s) => s.ultimaExecucao)
                        .sort(
                          (a, b) =>
                            new Date(b.ultimaExecucao!).getTime() -
                            new Date(a.ultimaExecucao!).getTime()
                        )[0]?.ultimaExecucao ?? null
                    )
                  : 'Nunca'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <StatusDot color={data?.telegram.configured ? 'green' : 'red'} />
                <span className="text-sm">Telegram</span>
              </div>
              <Badge
                className={
                  data?.telegram.configured
                    ? 'bg-green-50 text-green-600 border-0 dark:bg-green-950 dark:text-green-400'
                    : 'bg-red-50 text-red-600 border-0 dark:bg-red-950 dark:text-red-400'
                }
              >
                {data?.telegram.configured ? 'Configurado' : 'Não configurado'}
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <StatusDot color={data?.webhook?.configured ? 'green' : 'red'} />
                <span className="text-sm">Webhook (Slack/Teams)</span>
              </div>
              <Badge
                className={
                  data?.webhook?.configured
                    ? 'bg-green-50 text-green-600 border-0 dark:bg-green-950 dark:text-green-400'
                    : 'bg-red-50 text-red-600 border-0 dark:bg-red-950 dark:text-red-400'
                }
              >
                {data?.webhook?.configured ? 'Configurado' : 'Não configurado'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Ultimos Syncs */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold mb-4">Ultimos Syncs</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Tipo</th>
                  <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Ultima Execucao</th>
                  <th className="text-left py-2 font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {data?.lastSyncs.map((sync) => (
                  <tr key={sync.tipo} className="border-b border-border/50">
                    <td className="py-2.5 pr-4">{sync.tipo}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">
                      {formatDateTime(sync.ultimaExecucao)}
                    </td>
                    <td className="py-2.5">
                      <div className="flex items-center gap-2">
                        <StatusDot color={getSyncColor(sync.ultimaExecucao)} />
                        <span className="capitalize">{sync.status}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Section 3: Cron Jobs */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold mb-4">Cron Jobs</h2>
          <p className="text-xs text-muted-foreground mb-3">
            Jobs agendados via Vercel Cron. Configurados em vercel.json.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Nome</th>
                  <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Schedule</th>
                  <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Descricao</th>
                  <th className="text-left py-2 font-medium text-muted-foreground">Frequencia</th>
                </tr>
              </thead>
              <tbody>
                {data?.cronJobs.map((job) => (
                  <tr key={job.nome} className="border-b border-border/50">
                    <td className="py-2.5 pr-4">{job.nome}</td>
                    <td className="py-2.5 pr-4">
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                        {job.schedule}
                      </code>
                    </td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{job.descricao}</td>
                    <td className="py-2.5">
                      <Badge variant="outline" className="text-xs">
                        {job.frequencia}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Section 4: Estatisticas do Banco */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold mb-4">Estatisticas do Banco</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {[
              { label: 'Posts', value: data?.dbStats.posts ?? 0 },
              { label: 'Reels', value: data?.dbStats.reels ?? 0 },
              { label: 'Stories', value: data?.dbStats.stories ?? 0 },
              { label: 'Campanhas', value: data?.dbStats.campaigns ?? 0 },
              { label: 'Comentarios', value: data?.dbStats.comments ?? 0 },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-lg bg-muted/50 p-4 text-center"
              >
                <p className="text-2xl font-bold">{stat.value.toLocaleString('pt-BR')}</p>
                <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <span>Arquivos de midia (stories):</span>
            <span className="font-medium text-foreground">
              {data?.storageInfo.storyMediaFiles.toLocaleString('pt-BR') ?? 0}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Section 5: Metricas */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold mb-4">Metricas</h2>

          {/* Historico de Syncs */}
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Historico de Syncs</h3>
          {data?.performance.syncHistory && data.performance.syncHistory.length > 0 ? (
            <div className="space-y-2 mb-6">
              {data.performance.syncHistory.map((entry) => (
                <div
                  key={entry.date}
                  className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-2"
                >
                  <div className="flex items-center gap-2">
                    <StatusDot color={entry.success ? 'green' : 'red'} />
                    <span className="text-sm">{entry.date}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(entry.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground mb-6">Nenhum historico de sync disponivel.</p>
          )}

          {/* Uso do Armazenamento */}
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Uso do Armazenamento</h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-6">
            {[
              { label: 'Stories com Midia', value: data?.performance.storageUsage.storyMediaFiles ?? 0 },
              { label: 'Campanhas Totais', value: data?.performance.storageUsage.totalCampaigns ?? 0 },
              { label: 'Documentos Indexados', value: data?.performance.storageUsage.totalDocuments ?? 0 },
              { label: 'Chunks de Embedding', value: data?.performance.storageUsage.totalChunks ?? 0 },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-lg bg-muted/50 p-4 text-center"
              >
                <p className="text-2xl font-bold">{stat.value.toLocaleString('pt-BR')}</p>
                <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Meta API */}
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Meta API</h3>
          <div className="rounded-lg bg-muted/50 p-4">
            <p className="text-sm mb-2">
              {data?.performance.metaApiQuota.note ?? 'Informacoes de quota indisponiveis.'}
            </p>
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground mt-2">
              <span>Limite por hora: <strong className="text-foreground">{data?.performance.metaApiQuota.hourlyLimit ?? '-'}</strong></span>
              <span>Chamadas por sync: <strong className="text-foreground">~{data?.performance.metaApiQuota.estimatedCallsPerSync ?? '-'}</strong></span>
            </div>
            {data?.performance.metaApiQuota.monitorUrl && (
              <a
                href={data.performance.metaApiQuota.monitorUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary underline mt-2 inline-block"
              >
                Abrir Meta Developer Dashboard
              </a>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Section 6: Relatorio Mensal */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold mb-4">Relatorio Mensal</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Ultimo relatorio</span>
              <span className="text-sm text-muted-foreground">
                {data?.report.lastReportDate
                  ? new Date(data.report.lastReportDate + 'T00:00:00').toLocaleDateString('pt-BR')
                  : 'Nenhum gerado'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Email</span>
              <Badge
                className={
                  data?.report.emailConfigured
                    ? 'bg-green-50 text-green-600 border-0 dark:bg-green-950 dark:text-green-400'
                    : 'bg-red-50 text-red-600 border-0 dark:bg-red-950 dark:text-red-400'
                }
              >
                {data?.report.emailConfigured ? 'Configurado' : 'Nao configurado'}
              </Badge>
            </div>
            {data?.report.emailTo && (
              <div className="flex items-center justify-between">
                <span className="text-sm">Destinatario</span>
                <span className="text-sm text-muted-foreground">{data.report.emailTo}</span>
              </div>
            )}
            {!data?.report.emailConfigured && (
              <p className="text-xs text-muted-foreground mt-2">
                Configure as variaveis REPORT_EMAIL_TO e RESEND_API_KEY para envio automatico do relatorio mensal.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Section 7: Acoes Rapidas */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold mb-4">Acoes Rapidas</h2>
          <div className="flex flex-wrap gap-3">
            <Button
              size="sm"
              onClick={handleSync}
              disabled={syncing}
            >
              {syncing ? 'Sincronizando...' : 'Sync Manual'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleRefreshToken}
              disabled={refreshingToken}
            >
              {refreshingToken ? 'Renovando...' : 'Refresh Token'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleBackfillMedia}
              disabled={backfilling}
              title="Re-baixa todos os thumbnails de posts e reels do Instagram para o Storage. Use uma vez apos a migration."
            >
              {backfilling ? 'Recuperando imagens...' : 'Recuperar Imagens'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleTestTelegram}
              disabled={testingTelegram || !data?.telegram.configured}
            >
              {testingTelegram ? 'Enviando...' : 'Teste Telegram'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleTestWebhook}
              disabled={testingWebhook || !data?.webhook?.configured}
            >
              {testingWebhook ? 'Enviando...' : 'Teste Webhook'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleExport}
              disabled={exporting}
            >
              {exporting ? 'Exportando...' : 'Exportar Dados'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Section 8: Sobre */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold mb-4">Sobre</h2>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Versão</span>
              <span className="text-sm font-mono">0.1.0</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Projeto</span>
              <span className="text-sm">DashIG — Welcome Weddings</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Repositório</span>
              <a
                href="https://github.com/welcome-trips/mkt-insta"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline"
              >
                github.com/welcome-trips/mkt-insta
              </a>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
