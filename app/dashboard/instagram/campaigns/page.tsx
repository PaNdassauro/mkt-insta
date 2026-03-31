'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import type { Campaign } from '@/types/instagram'

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  DRAFT: { label: 'Rascunho', className: 'bg-gray-50 text-gray-500' },
  GENERATING: { label: 'Gerando...', className: 'bg-blue-50 text-blue-500' },
  REVIEW: { label: 'Em revisao', className: 'bg-purple-50 text-purple-600' },
  APPROVED: { label: 'Aprovada', className: 'bg-green-50 text-green-600' },
  SCHEDULED: { label: 'Agendada', className: 'bg-indigo-50 text-indigo-600' },
  ARCHIVED: { label: 'Arquivada', className: 'bg-gray-50 text-gray-400' },
}

interface CampaignWithCount extends Campaign {
  post_count: number
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<CampaignWithCount[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/campaigns')
      .then((res) => res.json())
      .then((data) => setCampaigns(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="space-y-4" role="status" aria-label="Carregando campanhas">
        <span className="sr-only">Carregando campanhas...</span>
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Campaign Studio</h1>
          <p className="text-sm text-muted-foreground">
            Gere campanhas de conteudo com IA embasada nos seus dados
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/instagram/campaigns/compare">
            <Button variant="outline">Comparar</Button>
          </Link>
          <Link href="/dashboard/instagram/campaigns/new">
            <Button>Nova Campanha</Button>
          </Link>
        </div>
      </div>

      {campaigns.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <p className="text-muted-foreground text-sm">
              Nenhuma campanha criada ainda.
            </p>
            <p className="text-muted-foreground text-xs mt-1">
              Crie sua primeira campanha com IA clicando no botao acima.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3" aria-live="polite">
          {campaigns.map((campaign) => {
            const statusCfg = STATUS_CONFIG[campaign.status] ?? STATUS_CONFIG.DRAFT

            return (
              <Link
                key={campaign.id}
                href={
                  campaign.status === 'GENERATING'
                    ? `/dashboard/instagram/campaigns/new/generating?id=${campaign.id}`
                    : `/dashboard/instagram/campaigns/${campaign.id}`
                }
              >
                <Card className="border-0 shadow-sm hover:shadow-md transition-all cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-sm truncate">
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
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {campaign.theme}
                          </p>
                        )}
                        <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                          <span>{campaign.post_count} posts</span>
                          {campaign.duration_days && (
                            <span>{campaign.duration_days} dias</span>
                          )}
                          {campaign.start_date && (
                            <span>
                              Inicio:{' '}
                              {new Date(campaign.start_date).toLocaleDateString(
                                'pt-BR'
                              )}
                            </span>
                          )}
                          <span>
                            Criada em{' '}
                            {new Date(campaign.created_at).toLocaleDateString(
                              'pt-BR'
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
