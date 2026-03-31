'use client'

import { fetchWithAccount } from '@/lib/fetch-with-account'

import { useState, useEffect } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { AudienceSnapshot } from '@/types/instagram'

const GENDER_COLORS = ['#4F46E5', '#EC4899']
const AGE_COLOR = '#4F46E5'

export default function AudienceDemographics() {
  const [audience, setAudience] = useState<AudienceSnapshot | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchWithAccount('/api/instagram/audience')
      .then((r) => r.json())
      .then((json) => setAudience(json.data))
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [])

  if (isLoading) {
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="border-0 shadow-sm">
            <CardHeader><Skeleton className="h-6 w-40" /></CardHeader>
            <CardContent><Skeleton className="h-48 w-full rounded-lg" /></CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (!audience) {
    return (
      <div className="rounded-xl border-2 border-dashed border-border/60 p-12 text-center">
        <p className="text-lg font-medium text-muted-foreground">Nenhum dado de audiencia</p>
        <p className="mt-1 text-sm text-muted-foreground/70">
          Execute o sync de audiencia para popular os dados demograficos.
        </p>
      </div>
    )
  }

  // Gender data
  const genderData = audience.gender
    ? Object.entries(audience.gender).map(([key, value]) => ({
        name: key === 'M' ? 'Masculino' : 'Feminino',
        value,
      }))
    : []

  const totalGender = genderData.reduce((s, d) => s + d.value, 0)

  // Age data
  const ageData = audience.age_ranges
    ? Object.entries(audience.age_ranges)
        .sort(([a], [b]) => {
          const aNum = parseInt(a.split('-')[0])
          const bNum = parseInt(b.split('-')[0])
          return aNum - bNum
        })
        .map(([range, value]) => ({ faixa: range, valor: value }))
    : []

  // Cities data
  const citiesData = audience.top_cities ?? []

  // Countries data
  const countriesData = audience.top_countries ?? []

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Genero */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Genero</CardTitle>
          <p className="text-xs text-muted-foreground">Distribuicao por genero da audiencia</p>
        </CardHeader>
        <CardContent>
          {genderData.length > 0 ? (
            <div className="flex items-center gap-6">
              <div className="h-48 w-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={genderData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      dataKey="value"
                      strokeWidth={2}
                      stroke="hsl(var(--card))"
                    >
                      {genderData.map((_, i) => (
                        <Cell key={i} fill={GENDER_COLORS[i]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '13px',
                      }}
                      formatter={(value) => [`${value}`, '']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3">
                {genderData.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-3">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: GENDER_COLORS[i] }} />
                    <div>
                      <p className="text-sm font-medium">{d.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {totalGender > 0 ? ((d.value / totalGender) * 100).toFixed(1) : 0}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">Sem dados</div>
          )}
        </CardContent>
      </Card>

      {/* Faixa etaria */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Faixa Etaria</CardTitle>
          <p className="text-xs text-muted-foreground">Distribuicao por idade</p>
        </CardHeader>
        <CardContent>
          {ageData.length > 0 ? (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ageData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="faixa" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '13px',
                    }}
                    formatter={(value) => [`${value}`, 'Seguidores']}
                  />
                  <Bar dataKey="valor" fill={AGE_COLOR} radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">Sem dados</div>
          )}
        </CardContent>
      </Card>

      {/* Cidades */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Top Cidades</CardTitle>
          <p className="text-xs text-muted-foreground">Localizacao da audiencia</p>
        </CardHeader>
        <CardContent>
          {citiesData.length > 0 ? (
            <div className="space-y-2.5">
              {citiesData.slice(0, 8).map((city, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-5 text-xs font-medium text-muted-foreground">{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{city.city}</span>
                      <span className="text-xs text-muted-foreground">{city.pct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500"
                        style={{ width: `${Math.min(city.pct * 3, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">Sem dados</div>
          )}
        </CardContent>
      </Card>

      {/* Paises */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Top Paises</CardTitle>
          <p className="text-xs text-muted-foreground">Distribuicao geografica</p>
        </CardHeader>
        <CardContent>
          {countriesData.length > 0 ? (
            <div className="space-y-2.5">
              {countriesData.slice(0, 8).map((country, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-5 text-xs font-medium text-muted-foreground">{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{country.country}</span>
                      <span className="text-xs text-muted-foreground">{country.pct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-500"
                        style={{ width: `${Math.min(country.pct * 2, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">Sem dados</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
