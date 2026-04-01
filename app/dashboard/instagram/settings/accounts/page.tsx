'use client'

import { Suspense } from 'react'
import { fetchWithAccount } from '@/lib/fetch-with-account'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useCurrentAccount, type InstagramAccount } from '@/hooks/useCurrentAccount'

export default function AccountsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <AccountsPageContent />
    </Suspense>
  )
}

function AccountsPageContent() {
  const { accounts, currentAccount, setCurrentAccount, loading, refetch } = useCurrentAccount()
  const searchParams = useSearchParams()

  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  // Feedback do OAuth callback
  useEffect(() => {
    const success = searchParams.get('success')
    const error = searchParams.get('error')
    if (success) {
      toast.success(`${success} conta(s) conectada(s) com sucesso!`)
      refetch()
      // Limpar params da URL
      window.history.replaceState({}, '', window.location.pathname)
    }
    if (error) {
      toast.error(decodeURIComponent(error))
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [searchParams, refetch])

  // Form state
  const [formLabel, setFormLabel] = useState('')
  const [formUsername, setFormUsername] = useState('')
  const [formIgUserId, setFormIgUserId] = useState('')
  const [formAccessToken, setFormAccessToken] = useState('')

  function resetForm() {
    setFormLabel('')
    setFormUsername('')
    setFormIgUserId('')
    setFormAccessToken('')
    setShowForm(false)
  }

  async function handleAddAccount(e: React.FormEvent) {
    e.preventDefault()

    if (!formIgUserId.trim() || !formAccessToken.trim() || !formLabel.trim()) {
      toast.error('Preencha todos os campos obrigatorios')
      return
    }

    setSaving(true)
    try {
      const res = await fetchWithAccount('/api/settings/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ig_user_id: formIgUserId.trim(),
          access_token: formAccessToken.trim(),
          label: formLabel.trim(),
          username: formUsername.trim() || undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error ?? 'Erro ao adicionar conta')
        return
      }

      toast.success('Conta adicionada com sucesso')
      resetForm()
      refetch()
    } catch {
      toast.error('Erro ao adicionar conta')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleActive(account: InstagramAccount) {
    setTogglingId(account.id)
    try {
      const res = await fetchWithAccount('/api/settings/accounts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: account.id,
          is_active: !account.is_active,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error ?? 'Erro ao atualizar conta')
        return
      }

      toast.success(account.is_active ? 'Conta desativada' : 'Conta ativada')
      refetch()
    } catch {
      toast.error('Erro ao atualizar conta')
    } finally {
      setTogglingId(null)
    }
  }

  function handleSelectAccount(id: string) {
    setCurrentAccount(id)
    toast.success('Conta selecionada. Recarregue a pagina para aplicar.')
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contas Instagram</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie as contas Instagram conectadas ao DashIG
          </p>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contas Instagram</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie as contas Instagram conectadas ao DashIG
          </p>
        </div>
        <div className="flex gap-2">
          <a href="/api/auth/instagram">
            <Button size="sm">
              Conectar com Instagram
            </Button>
          </a>
          <Button size="sm" variant="outline" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Cancelar' : 'Adicionar manual'}
          </Button>
        </div>
      </div>

      {/* Info banner */}
      <Card className="border-0 shadow-sm bg-blue-50 dark:bg-blue-950/30">
        <CardContent className="p-4">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            Clique em <strong>Conectar com Instagram</strong> para vincular uma conta automaticamente via login no Meta.
            O token e renovado automaticamente. Para contas sem acesso ao login, use &ldquo;Adicionar manual&rdquo;.
          </p>
        </CardContent>
      </Card>

      {/* Add account form */}
      {showForm && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold mb-4">Nova Conta</h2>
            <form onSubmit={handleAddAccount} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="acc-label" className="block text-sm font-medium mb-1">
                    Nome / Label *
                  </label>
                  <input
                    id="acc-label"
                    type="text"
                    value={formLabel}
                    onChange={(e) => setFormLabel(e.target.value)}
                    placeholder="Ex: Welcome Weddings"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="acc-username" className="block text-sm font-medium mb-1">
                    Username
                  </label>
                  <input
                    id="acc-username"
                    type="text"
                    value={formUsername}
                    onChange={(e) => setFormUsername(e.target.value)}
                    placeholder="Ex: welcomeweddings"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <label htmlFor="acc-ig-user-id" className="block text-sm font-medium mb-1">
                    IG User ID *
                  </label>
                  <input
                    id="acc-ig-user-id"
                    type="text"
                    value={formIgUserId}
                    onChange={(e) => setFormIgUserId(e.target.value)}
                    placeholder="Ex: 17841400123456789"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/50"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="acc-token" className="block text-sm font-medium mb-1">
                    Access Token *
                  </label>
                  <input
                    id="acc-token"
                    type="password"
                    value={formAccessToken}
                    onChange={(e) => setFormAccessToken(e.target.value)}
                    placeholder="Token de longa duracao"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/50"
                    required
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="submit" size="sm" disabled={saving}>
                  {saving ? 'Salvando...' : 'Salvar Conta'}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Accounts list */}
      {accounts.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhuma conta cadastrada. Clique em &quot;Adicionar Conta&quot; para comecar.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {accounts.map((account) => {
            const isCurrent = account.id === currentAccount?.id
            return (
              <Card
                key={account.id}
                className={`border-0 shadow-sm transition-colors ${isCurrent ? 'ring-2 ring-primary/30' : ''}`}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold">
                        IG
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold truncate">{account.label}</p>
                          {isCurrent && (
                            <Badge className="bg-primary/10 text-primary border-0 text-[10px]">
                              Atual
                            </Badge>
                          )}
                          {account.is_active ? (
                            <Badge className="bg-green-50 text-green-600 dark:bg-green-950/30 dark:text-green-400 border-0 text-[10px]">
                              Ativa
                            </Badge>
                          ) : (
                            <Badge className="bg-gray-50 text-gray-500 dark:bg-gray-900 dark:text-gray-400 border-0 text-[10px]">
                              Inativa
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {account.username ? `@${account.username}` : 'Sem username'} — ID:{' '}
                          <span className="font-mono">{account.ig_user_id}</span>
                        </p>
                        {account.token_expires_at && (
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            Token expira em:{' '}
                            {new Date(account.token_expires_at).toLocaleDateString('pt-BR')}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {account.is_active && !isCurrent && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSelectAccount(account.id)}
                        >
                          Selecionar
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleToggleActive(account)}
                        disabled={togglingId === account.id}
                      >
                        {togglingId === account.id
                          ? '...'
                          : account.is_active
                            ? 'Desativar'
                            : 'Ativar'}
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
