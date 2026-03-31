'use client'

import { fetchWithAccount } from '@/lib/fetch-with-account'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

interface SettingsData {
  token: { status: string; daysLeft: number }
  telegram: { configured: boolean }
  instagram: { userId: string | null }
}

const CRON_JOBS = [
  { name: 'Sync de midias e metricas', schedule: '0 6 * * *', description: 'Diario as 06:00 UTC' },
  { name: 'Sync de stories', schedule: '0 */4 * * *', description: 'A cada 4 horas' },
  { name: 'Sync de audiencia', schedule: '0 7 * * 1', description: 'Semanal (segunda 07:00 UTC)' },
  { name: 'Relatorio semanal', schedule: '0 8 * * 1', description: 'Semanal (segunda 08:00 UTC)' },
  { name: 'Refresh de token', schedule: '0 3 */7 * *', description: 'A cada 7 dias as 03:00 UTC' },
]

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [testingTelegram, setTestingTelegram] = useState(false)

  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await fetchWithAccount('/api/settings')
        if (res.ok) {
          setSettings(await res.json())
        }
      } catch {
        toast.error('Erro ao carregar configuracoes')
      } finally {
        setLoading(false)
      }
    }
    fetchSettings()
  }, [])

  async function handleRefreshToken() {
    setRefreshing(true)
    try {
      const res = await fetchWithAccount('/api/instagram/refresh-token', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        toast.success('Token renovado com sucesso')
        // Reload settings to get updated token status
        const settingsRes = await fetchWithAccount('/api/settings')
        if (settingsRes.ok) setSettings(await settingsRes.json())
      } else {
        toast.error(data.error ?? 'Erro ao renovar token')
      }
    } catch {
      toast.error('Erro ao renovar token')
    } finally {
      setRefreshing(false)
    }
  }

  async function handleTestTelegram() {
    setTestingTelegram(true)
    try {
      const res = await fetchWithAccount('/api/settings/telegram-test', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        toast.success('Mensagem de teste enviada')
      } else {
        toast.error(data.error ?? 'Erro ao enviar mensagem de teste')
      }
    } catch {
      toast.error('Erro ao enviar mensagem de teste')
    } finally {
      setTestingTelegram(false)
    }
  }

  function getTokenBadge() {
    if (!settings) return null
    const { status, daysLeft } = settings.token
    if (status === 'unknown') {
      return <Badge className="bg-gray-50 text-gray-500 border-0">Desconhecido</Badge>
    }
    if (status === 'expiring' || daysLeft <= 0) {
      return (
        <Badge className="bg-red-50 text-red-600 border-0">
          {daysLeft <= 0 ? 'Expirado' : `Expira em ${daysLeft} dias`}
        </Badge>
      )
    }
    return (
      <Badge className="bg-green-50 text-green-600 border-0">
        Valido — {daysLeft} dias restantes
      </Badge>
    )
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Configuracoes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie integracoes e configuracoes do DashIG
          </p>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configuracoes</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie integracoes e configuracoes do DashIG
        </p>
      </div>

      {/* Section 1: Conta Instagram */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold mb-4">Conta Instagram</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">IG User ID</span>
              <span className="text-sm font-mono">
                {settings?.instagram.userId ?? 'Nao configurado'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status do Token</span>
              {getTokenBadge()}
            </div>
            <div className="pt-2">
              <Button
                size="sm"
                onClick={handleRefreshToken}
                disabled={refreshing}
              >
                {refreshing ? 'Renovando...' : 'Renovar Token'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Notificacoes Telegram */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold mb-4">Notificacoes Telegram</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status da Conexao</span>
              {settings?.telegram.configured ? (
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
                  <Badge className="bg-green-50 text-green-600 border-0">Configurado</Badge>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                  <Badge className="bg-red-50 text-red-600 border-0">Nao configurado</Badge>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Configure as variaveis TELEGRAM_BOT_TOKEN e TELEGRAM_CHAT_ID para receber alertas.
            </p>
            <div className="pt-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleTestTelegram}
                disabled={testingTelegram || !settings?.telegram.configured}
              >
                {testingTelegram ? 'Enviando...' : 'Enviar Mensagem de Teste'}
              </Button>
            </div>
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
                  <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Job</th>
                  <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Cron</th>
                  <th className="text-left py-2 font-medium text-muted-foreground">Frequencia</th>
                </tr>
              </thead>
              <tbody>
                {CRON_JOBS.map((job) => (
                  <tr key={job.name} className="border-b border-border/50">
                    <td className="py-2.5 pr-4">{job.name}</td>
                    <td className="py-2.5 pr-4">
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                        {job.schedule}
                      </code>
                    </td>
                    <td className="py-2.5 text-muted-foreground">{job.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Section 4: Sobre */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold mb-4">Sobre</h2>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Versao</span>
              <span className="text-sm font-mono">0.1.0</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Projeto</span>
              <span className="text-sm">DashIG — Welcome Weddings</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Repositorio</span>
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
