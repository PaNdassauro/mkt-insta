'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { EditorialEntry, ContentType, CalendarStatus } from '@/types/instagram'

const CONTENT_TYPES: { value: ContentType; label: string; icon: string }[] = [
  { value: 'REEL', label: 'Reel', icon: '🎬' },
  { value: 'CAROUSEL', label: 'Carrossel', icon: '📸' },
  { value: 'IMAGE', label: 'Foto', icon: '🖼' },
  { value: 'STORY', label: 'Story', icon: '⏳' },
]

const STATUS_CONFIG: Record<CalendarStatus, { label: string; color: string }> = {
  DRAFT: { label: 'Rascunho', color: 'bg-slate-100 text-slate-700' },
  APPROVED: { label: 'Aprovado', color: 'bg-blue-50 text-blue-700' },
  PUBLISHED: { label: 'Publicado', color: 'bg-emerald-50 text-emerald-700' },
  CANCELLED: { label: 'Cancelado', color: 'bg-red-50 text-red-500' },
}

interface FormState {
  scheduled_for: string
  content_type: ContentType
  topic: string
  caption_draft: string
  hashtags_input: string
  status: CalendarStatus
  media_url: string
  carousel_urls: string[]
  location_id: string
  alt_text: string
  collaborators_input: string
  cover_url: string
  auto_publish: boolean
  user_tags: Array<{ username: string; x: number; y: number }>
}

function entryToForm(entry: EditorialEntry): FormState {
  return {
    scheduled_for: entry.scheduled_for
      ? new Date(entry.scheduled_for).toISOString().slice(0, 16)
      : '',
    content_type: entry.content_type ?? 'IMAGE',
    topic: entry.topic ?? '',
    caption_draft: entry.caption_draft ?? '',
    hashtags_input: entry.hashtags_plan?.map((h) => h.replace(/^#/, '')).join(', ') ?? '',
    status: entry.status,
    media_url: entry.media_url ?? '',
    carousel_urls: entry.carousel_urls ?? [''],
    location_id: entry.location_id ?? '',
    alt_text: entry.alt_text ?? '',
    collaborators_input: entry.collaborators?.join(', ') ?? '',
    cover_url: entry.cover_url ?? '',
    auto_publish: entry.auto_publish ?? false,
    user_tags: entry.user_tags ?? [],
  }
}

export default function CalendarEntryEditorPage() {
  const params = useParams()
  const router = useRouter()
  const entryId = params.id as string

  const [entry, setEntry] = useState<EditorialEntry | null>(null)
  const [form, setForm] = useState<FormState | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)

  const loadEntry = useCallback(async () => {
    try {
      const res = await fetch(`/api/instagram/calendar/${entryId}`)
      if (res.ok) {
        const data = await res.json()
        setEntry(data)
        setForm(entryToForm(data))
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [entryId])

  useEffect(() => {
    loadEntry()
  }, [loadEntry])

  function updateForm(updates: Partial<FormState>) {
    setForm((prev) => (prev ? { ...prev, ...updates } : prev))
    setSaveMsg(null)
  }

  async function handleSave() {
    if (!form) return
    setSaving(true)
    setSaveMsg(null)

    const hashtags = form.hashtags_input
      .split(',')
      .map((h) => h.trim().replace(/^#/, ''))
      .filter(Boolean)
      .map((h) => `#${h}`)

    const collaborators = form.collaborators_input
      .split(',')
      .map((c) => c.trim().replace(/^@/, ''))
      .filter(Boolean)

    try {
      const res = await fetch('/api/instagram/calendar', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: entryId,
          scheduled_for: form.scheduled_for || null,
          content_type: form.content_type,
          topic: form.topic || null,
          caption_draft: form.caption_draft || null,
          hashtags_plan: hashtags.length > 0 ? hashtags : null,
          status: form.status,
          media_url: form.media_url || null,
          carousel_urls:
            form.content_type === 'CAROUSEL'
              ? form.carousel_urls.filter(Boolean)
              : null,
          location_id: form.location_id || null,
          alt_text: form.alt_text || null,
          collaborators: collaborators.length > 0 ? collaborators : null,
          cover_url: form.cover_url || null,
          auto_publish: form.auto_publish,
        }),
      })

      if (res.ok) {
        setSaveMsg('Salvo!')
        await loadEntry()
      } else {
        const data = await res.json()
        setSaveMsg(`Erro: ${data.error}`)
      }
    } catch {
      setSaveMsg('Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  async function handlePublish() {
    if (!confirm('Publicar este post no Instagram da @welcomeweddings?')) return
    setPublishing(true)
    try {
      const res = await fetch('/api/instagram/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ calendarEntryId: entryId }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error)
      } else {
        toast.success('Publicado no Instagram!')
      }
      await loadEntry()
    } catch {
      toast.error('Erro de conexao')
    } finally {
      setPublishing(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Tem certeza que deseja excluir esta entrada?')) return
    await fetch(`/api/instagram/calendar?id=${entryId}`, { method: 'DELETE' })
    router.push('/dashboard/instagram/calendar')
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-6 lg:grid-cols-[1fr,380px]">
          <div className="space-y-4">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
          <Skeleton className="h-[500px] w-full" />
        </div>
      </div>
    )
  }

  if (!entry || !form) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Entrada nao encontrada.
      </div>
    )
  }

  const statusCfg = STATUS_CONFIG[entry.status]
  const typeCfg = CONTENT_TYPES.find((t) => t.value === form.content_type)
  const captionLength = form.caption_draft.length
  const hasMedia = form.media_url || form.carousel_urls.some(Boolean)
  const isPublished = entry.status === 'PUBLISHED'

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/instagram/calendar"
        className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
      >
        ← Voltar para calendario
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">{typeCfg?.icon}</span>
            <h1 className="text-2xl font-bold tracking-tight">
              {form.topic || typeCfg?.label || 'Post'}
            </h1>
            <Badge className={`${statusCfg.color} border-0`}>{statusCfg.label}</Badge>
            {form.auto_publish && (
              <Badge className="bg-indigo-50 text-indigo-600 border-0">Auto-publish</Badge>
            )}
          </div>
          {form.scheduled_for && (
            <p className="text-sm text-muted-foreground mt-1">
              Agendado para{' '}
              {new Date(form.scheduled_for).toLocaleDateString('pt-BR', {
                weekday: 'long',
                day: '2-digit',
                month: 'long',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          )}
        </div>
      </div>

      {/* Publish status indicator */}
      {isPublished && entry.published_at && (
        <Card className="border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center shrink-0">
              <span className="text-emerald-600 dark:text-emerald-400 text-sm">&#10003;</span>
            </div>
            <div>
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Publicado</p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400">
                {new Date(entry.published_at).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                {entry.published_media_id && (
                  <span className="ml-2 text-emerald-500">ID: {entry.published_media_id}</span>
                )}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error banner */}
      {entry.publish_error && !isPublished && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-800 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center shrink-0">
              <span className="text-red-600 dark:text-red-400 text-sm">&#10007;</span>
            </div>
            <div>
              <p className="text-sm font-medium text-red-700 dark:text-red-300">Erro na publicacao</p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{entry.publish_error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr,380px]">
        {/* LEFT: Editor */}
        <div className="space-y-6">
          {/* Basic Info */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Informacoes Basicas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Data e Hora
                  </label>
                  <input
                    type="datetime-local"
                    value={form.scheduled_for}
                    onChange={(e) => updateForm({ scheduled_for: e.target.value })}
                    className="w-full rounded-lg border border-border/50 bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    disabled={isPublished}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Formato
                  </label>
                  <Select
                    value={form.content_type}
                    onValueChange={(v) => updateForm({ content_type: v as ContentType })}
                    disabled={isPublished}
                  >
                    <SelectTrigger className="h-9 text-sm border-border/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTENT_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.icon} {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Tema / Titulo
                </label>
                <input
                  type="text"
                  value={form.topic}
                  onChange={(e) => updateForm({ topic: e.target.value })}
                  placeholder="Ex: Casamento em Toscana"
                  className="w-full rounded-lg border border-border/50 bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  disabled={isPublished}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Status
                  </label>
                  <Select
                    value={form.status}
                    onValueChange={(v) => updateForm({ status: v as CalendarStatus })}
                    disabled={isPublished}
                  >
                    <SelectTrigger className="h-9 text-sm border-border/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                        <SelectItem key={key} value={key}>
                          {cfg.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={() => updateForm({ auto_publish: !form.auto_publish })}
                    disabled={isPublished}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors w-full ${
                      form.auto_publish
                        ? 'bg-indigo-100 text-indigo-700'
                        : 'bg-muted/50 text-muted-foreground'
                    }`}
                  >
                    <div
                      className={`w-8 h-4 rounded-full relative transition-colors ${
                        form.auto_publish ? 'bg-indigo-500' : 'bg-gray-300'
                      }`}
                    >
                      <div
                        className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${
                          form.auto_publish ? 'translate-x-4' : 'translate-x-0.5'
                        }`}
                      />
                    </div>
                    Auto-publish
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Caption & Hashtags */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Caption e Hashtags</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-xs font-medium text-muted-foreground">Caption</label>
                  <span
                    className={`text-xs ${
                      captionLength > 2200 ? 'text-red-500' : 'text-muted-foreground'
                    }`}
                  >
                    {captionLength}/2.200
                  </span>
                </div>
                <Textarea
                  value={form.caption_draft}
                  onChange={(e) => updateForm({ caption_draft: e.target.value })}
                  rows={8}
                  className="text-sm"
                  placeholder="Escreva a caption do post..."
                  disabled={isPublished}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Hashtags (separadas por virgula)
                </label>
                <Textarea
                  value={form.hashtags_input}
                  onChange={(e) => updateForm({ hashtags_input: e.target.value })}
                  rows={2}
                  className="text-sm"
                  placeholder="casamento, destinationwedding, caribe"
                  disabled={isPublished}
                />
              </div>
            </CardContent>
          </Card>

          {/* Media */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Midia</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {form.content_type === 'CAROUSEL' ? (
                <>
                  <label className="text-xs font-medium text-muted-foreground block">
                    URLs das imagens do carrossel
                  </label>
                  {form.carousel_urls.map((url, i) => (
                    <div key={i} className="flex gap-2 items-start">
                      <span className="text-xs text-muted-foreground mt-2.5 w-4 shrink-0">
                        {i + 1}.
                      </span>
                      <input
                        type="url"
                        value={url}
                        onChange={(e) => {
                          const updated = [...form.carousel_urls]
                          updated[i] = e.target.value
                          updateForm({ carousel_urls: updated })
                        }}
                        placeholder="https://..."
                        className="flex-1 rounded-lg border border-border/50 bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                        disabled={isPublished}
                      />
                      {url && (
                        <img
                          src={url}
                          alt=""
                          className="w-10 h-10 rounded object-cover shrink-0"
                          onError={(e) => {
                            ;(e.target as HTMLImageElement).style.display = 'none'
                          }}
                        />
                      )}
                      {form.carousel_urls.length > 1 && (
                        <button
                          onClick={() => {
                            const updated = form.carousel_urls.filter((_, j) => j !== i)
                            updateForm({ carousel_urls: updated })
                          }}
                          className="text-red-400 hover:text-red-600 text-sm mt-2"
                          disabled={isPublished}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                  {form.carousel_urls.length < 10 && !isPublished && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        updateForm({ carousel_urls: [...form.carousel_urls, ''] })
                      }
                    >
                      + Adicionar imagem
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      {form.content_type === 'REEL' ? 'URL do video' : 'URL da imagem'}
                    </label>
                    <input
                      type="url"
                      value={form.media_url}
                      onChange={(e) => updateForm({ media_url: e.target.value })}
                      placeholder="https://..."
                      className="w-full rounded-lg border border-border/50 bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                      disabled={isPublished}
                    />
                  </div>
                  {form.content_type === 'REEL' && (
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">
                        URL da capa (thumbnail do Reel)
                      </label>
                      <input
                        type="url"
                        value={form.cover_url}
                        onChange={(e) => updateForm({ cover_url: e.target.value })}
                        placeholder="https://... (opcional)"
                        className="w-full rounded-lg border border-border/50 bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                        disabled={isPublished}
                      />
                    </div>
                  )}
                </>
              )}

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Texto alternativo (acessibilidade)
                </label>
                <input
                  type="text"
                  value={form.alt_text}
                  onChange={(e) => updateForm({ alt_text: e.target.value })}
                  placeholder="Descricao da imagem para leitores de tela"
                  className="w-full rounded-lg border border-border/50 bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  disabled={isPublished}
                />
              </div>
            </CardContent>
          </Card>

          {/* Instagram Metadata */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Metadados do Instagram</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Localizacao (Facebook Place ID)
                </label>
                <input
                  type="text"
                  value={form.location_id}
                  onChange={(e) => updateForm({ location_id: e.target.value })}
                  placeholder="Ex: 106377336067638 (Cancun)"
                  className="w-full rounded-lg border border-border/50 bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  disabled={isPublished}
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Busque o ID em developers.facebook.com/tools/explorer → GET /search?type=place&q=nome
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Colaboradores (usernames separados por virgula)
                </label>
                <input
                  type="text"
                  value={form.collaborators_input}
                  onChange={(e) => updateForm({ collaborators_input: e.target.value })}
                  placeholder="parceiro1, parceiro2"
                  className="w-full rounded-lg border border-border/50 bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  disabled={isPublished}
                />
              </div>

              {/* User Tags */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Tags em fotos
                </label>
                {form.user_tags.map((tag, i) => (
                  <div key={i} className="flex gap-2 items-center mb-2">
                    <span className="text-xs">@{tag.username}</span>
                    <span className="text-[10px] text-muted-foreground">
                      ({tag.x.toFixed(2)}, {tag.y.toFixed(2)})
                    </span>
                    {!isPublished && (
                      <button
                        onClick={() => {
                          updateForm({
                            user_tags: form.user_tags.filter((_, j) => j !== i),
                          })
                        }}
                        className="text-red-400 hover:text-red-600 text-xs"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                {!isPublished && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const username = prompt('Username (sem @):')
                      if (!username) return
                      const x = parseFloat(prompt('Posicao X (0 a 1, ex: 0.5):') ?? '0.5')
                      const y = parseFloat(prompt('Posicao Y (0 a 1, ex: 0.5):') ?? '0.5')
                      updateForm({
                        user_tags: [
                          ...form.user_tags,
                          {
                            username: username.replace(/^@/, ''),
                            x: Math.max(0, Math.min(1, x)),
                            y: Math.max(0, Math.min(1, y)),
                          },
                        ],
                      })
                    }}
                  >
                    + Adicionar tag
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT: Preview + Actions */}
        <div className="space-y-4 lg:sticky lg:top-8 lg:self-start">
          {/* Instagram Preview */}
          <Card className="border-0 shadow-sm overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Pre-visualizacao</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {/* Profile header */}
              <div className="flex items-center gap-2 px-4 py-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-[10px] font-bold">
                  WW
                </div>
                <div>
                  <p className="text-xs font-semibold">welcomeweddings</p>
                  {form.location_id && (
                    <p className="text-[10px] text-muted-foreground">Localizacao</p>
                  )}
                </div>
              </div>

              {/* Media preview */}
              <div className="aspect-square bg-muted/30 flex items-center justify-center relative">
                {form.content_type === 'CAROUSEL' && form.carousel_urls.some(Boolean) ? (
                  <div className="w-full h-full relative">
                    <img
                      src={form.carousel_urls.find(Boolean)}
                      alt="Preview"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        ;(e.target as HTMLImageElement).style.display = 'none'
                      }}
                    />
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                      {form.carousel_urls.filter(Boolean).map((_, i) => (
                        <div
                          key={i}
                          className={`w-1.5 h-1.5 rounded-full ${
                            i === 0 ? 'bg-primary' : 'bg-white/50'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                ) : form.media_url ? (
                  form.content_type === 'REEL' ? (
                    <div className="w-full h-full relative">
                      {form.cover_url ? (
                        <img
                          src={form.cover_url}
                          alt="Cover"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-900" />
                      )}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-12 h-12 rounded-full bg-white/30 flex items-center justify-center">
                          <span className="text-white text-xl ml-1">▶</span>
                        </div>
                      </div>
                      <div className="absolute bottom-2 right-2">
                        <span className="text-white text-xs bg-black/50 px-1.5 py-0.5 rounded">
                          🎬 Reel
                        </span>
                      </div>
                    </div>
                  ) : (
                    <img
                      src={form.media_url}
                      alt="Preview"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        ;(e.target as HTMLImageElement).style.display = 'none'
                      }}
                    />
                  )
                ) : (
                  <div className="text-center text-muted-foreground">
                    <p className="text-3xl mb-2">{typeCfg?.icon}</p>
                    <p className="text-xs">Sem midia</p>
                  </div>
                )}
              </div>

              {/* Engagement icons */}
              <div className="flex items-center gap-4 px-4 py-2">
                <span className="text-lg">♡</span>
                <span className="text-lg">💬</span>
                <span className="text-lg">↗</span>
                <span className="ml-auto text-lg">🔖</span>
              </div>

              {/* Caption preview */}
              <div className="px-4 pb-4">
                {form.caption_draft && (
                  <p className="text-xs">
                    <span className="font-semibold">welcomeweddings</span>{' '}
                    {form.caption_draft.length > 150
                      ? form.caption_draft.slice(0, 150) + '... mais'
                      : form.caption_draft}
                  </p>
                )}
                {form.hashtags_input && (
                  <p className="text-xs text-primary/70 mt-1">
                    {form.hashtags_input
                      .split(',')
                      .map((h) => h.trim())
                      .filter(Boolean)
                      .map((h) => `#${h.replace(/^#/, '')}`)
                      .join(' ')}
                  </p>
                )}
                {form.collaborators_input && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    com{' '}
                    {form.collaborators_input
                      .split(',')
                      .map((c) => `@${c.trim().replace(/^@/, '')}`)
                      .join(', ')}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Publish Preview */}
          {entry.status === 'APPROVED' && hasMedia && (
            <Card className="border-0 shadow-sm border-l-4 border-l-emerald-500">
              <CardContent className="p-4 space-y-3">
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  Pronto para publicar
                </p>

                {/* Media thumbnail */}
                {form.content_type === 'CAROUSEL' && form.carousel_urls.some(Boolean) ? (
                  <div className="flex gap-1 overflow-x-auto">
                    {form.carousel_urls.filter(Boolean).map((url, i) => (
                      <img
                        key={i}
                        src={url}
                        alt={`Imagem ${i + 1}`}
                        className="w-16 h-16 rounded object-cover shrink-0"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                    ))}
                  </div>
                ) : form.media_url ? (
                  <img
                    src={form.content_type === 'REEL' && form.cover_url ? form.cover_url : form.media_url}
                    alt="Preview da midia"
                    className="w-full h-32 rounded-lg object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                ) : null}

                {/* Caption preview */}
                {form.caption_draft && (
                  <p className="text-xs text-muted-foreground line-clamp-4">
                    {form.caption_draft.length > 200
                      ? form.caption_draft.slice(0, 200) + '...'
                      : form.caption_draft}
                  </p>
                )}

                {/* Hashtags */}
                {form.hashtags_input && (
                  <p className="text-xs text-primary/70">
                    {form.hashtags_input
                      .split(',')
                      .map((h) => h.trim())
                      .filter(Boolean)
                      .map((h) => `#${h.replace(/^#/, '')}`)
                      .join(' ')}
                  </p>
                )}

                {/* Content type + scheduled date */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className="text-[10px] bg-muted/60 border-0">
                    {typeCfg?.icon} {typeCfg?.label}
                  </Badge>
                  {form.scheduled_for && (
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(form.scheduled_for).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 space-y-2">
              <Button
                className="w-full"
                onClick={handleSave}
                disabled={saving || isPublished}
              >
                {saving ? 'Salvando...' : 'Salvar alteracoes'}
              </Button>
              {saveMsg && (
                <p
                  className={`text-xs text-center ${
                    saveMsg.startsWith('Erro') ? 'text-red-500' : 'text-green-600'
                  }`}
                >
                  {saveMsg}
                </p>
              )}

              <Separator />

              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={handlePublish}
                disabled={
                  publishing ||
                  isPublished ||
                  entry.status !== 'APPROVED' ||
                  !hasMedia
                }
              >
                {publishing
                  ? 'Publicando...'
                  : isPublished
                    ? 'Publicado'
                    : '▶ Publicar no Instagram'}
              </Button>

              {!hasMedia && entry.status === 'APPROVED' && (
                <p className="text-[10px] text-yellow-600 text-center">
                  Adicione uma URL de midia para publicar
                </p>
              )}

              {entry.status !== 'APPROVED' && !isPublished && (
                <p className="text-[10px] text-muted-foreground text-center">
                  Mude o status para Aprovado para publicar
                </p>
              )}

              <Separator />

              <Button
                className="w-full"
                variant="outline"
                onClick={handleDelete}
                disabled={isPublished}
              >
                Excluir entrada
              </Button>
            </CardContent>
          </Card>

          {/* Metadata */}
          {(entry.published_media_id || entry.published_at) && (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4 space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  Dados da publicacao
                </p>
                {entry.published_at && (
                  <p className="text-xs">
                    Publicado em:{' '}
                    {new Date(entry.published_at).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                )}
                {entry.published_media_id && (
                  <p className="text-xs">
                    Media ID: {entry.published_media_id}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          <p className="text-[10px] text-muted-foreground text-center">
            ID: {entryId.slice(0, 8)}... | Criado em{' '}
            {new Date(entry.created_at).toLocaleDateString('pt-BR')}
          </p>
        </div>
      </div>
    </div>
  )
}
