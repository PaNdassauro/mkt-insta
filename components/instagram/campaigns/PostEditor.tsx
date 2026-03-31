'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { CampaignPost } from '@/types/instagram'

const POST_STATUS_BADGE: Record<string, { label: string; className: string }> = {
  PENDING: { label: 'Pendente', className: 'bg-gray-50 text-gray-500' },
  APPROVED: { label: 'Aprovado', className: 'bg-green-50 text-green-600' },
  REVISION_REQUESTED: { label: 'Revisao', className: 'bg-yellow-50 text-yellow-600' },
}

const FORMAT_CONFIG: Record<string, { icon: string; label: string; color: string }> = {
  REEL: { icon: '🎬', label: 'Reel', color: 'text-purple-600' },
  CAROUSEL: { icon: '📸', label: 'Carrossel', color: 'text-blue-600' },
  IMAGE: { icon: '🖼', label: 'Imagem', color: 'text-emerald-600' },
  STORY: { icon: '⏳', label: 'Story', color: 'text-orange-600' },
}

interface PostEditorProps {
  post: CampaignPost
  campaignId: string
  onUpdate: (updated: CampaignPost) => void
}

interface HashtagSuggestion {
  hashtag: string
  count: number
  avg_reach: number
  impact: number
  in_caption: boolean
}

export default function PostEditor({ post, campaignId, onUpdate }: PostEditorProps) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [captionEdit, setCaptionEdit] = useState(post.caption_edited ?? post.caption ?? '')
  const [hashtagsEdit, setHashtagsEdit] = useState(
    (post.hashtags_edited ?? post.hashtags ?? []).join(', ')
  )
  const [visualNotes, setVisualNotes] = useState(post.visual_notes ?? '')
  const [analystNotes, setAnalystNotes] = useState(post.analyst_notes ?? '')
  const [suggestions, setSuggestions] = useState<HashtagSuggestion[]>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)

  async function fetchSuggestions() {
    setLoadingSuggestions(true)
    try {
      const params = new URLSearchParams({ caption: captionEdit })
      const res = await fetch(`/api/instagram/hashtags/suggest?${params}`)
      if (res.ok) {
        const data = await res.json()
        setSuggestions(data.suggestions ?? [])
      }
    } catch { /* ignore */ }
    finally { setLoadingSuggestions(false) }
  }

  function addSuggestion(tag: string) {
    const current = hashtagsEdit.split(',').map((h) => h.trim().replace(/^#/, '')).filter(Boolean)
    if (current.includes(tag)) return
    setHashtagsEdit([...current, tag].join(', '))
    setSuggestions((prev) => prev.filter((s) => s.hashtag !== tag))
  }

  const fmt = FORMAT_CONFIG[post.format] ?? FORMAT_CONFIG.IMAGE
  const statusCfg = POST_STATUS_BADGE[post.status] ?? POST_STATUS_BADGE.PENDING
  const isEdited = post.caption_edited !== null || post.hashtags_edited !== null

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/posts/${post.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caption_edited: captionEdit,
          hashtags_edited: hashtagsEdit.split(',').map((h) => h.trim().replace(/^#/, '')).filter(Boolean),
          visual_notes: visualNotes || null,
          analyst_notes: analystNotes || null,
        }),
      })
      if (res.ok) {
        const updated = await res.json()
        onUpdate(updated)
        setEditing(false)
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleStatusChange(newStatus: string) {
    setSaving(true)
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/posts/${post.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        const updated = await res.json()
        onUpdate(updated)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="border-0 shadow-sm hover:shadow-md transition-all">
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">{fmt.icon}</span>
            <span className={`text-sm font-semibold ${fmt.color}`}>
              #{post.post_order} · {fmt.label}
            </span>
            <Badge variant="secondary" className={`text-[10px] ${statusCfg.className}`}>
              {statusCfg.label}
            </Badge>
            {isEdited && (
              <Badge variant="secondary" className="text-[10px] bg-blue-50 text-blue-500">
                Editado
              </Badge>
            )}
          </div>
          {post.scheduled_for && (
            <span className="text-xs text-muted-foreground">
              {new Date(post.scheduled_for).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          )}
        </div>

        {editing ? (
          /* Edit mode */
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Caption
              </label>
              <Textarea
                value={captionEdit}
                onChange={(e) => setCaptionEdit(e.target.value)}
                rows={5}
                className="text-sm"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Hashtags (separadas por virgula)
                </label>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-6 text-[10px] text-primary"
                  onClick={fetchSuggestions}
                  disabled={loadingSuggestions}
                >
                  {loadingSuggestions ? 'Buscando...' : 'Sugerir hashtags'}
                </Button>
              </div>
              <Textarea
                value={hashtagsEdit}
                onChange={(e) => setHashtagsEdit(e.target.value)}
                rows={2}
                className="text-sm"
              />
              {suggestions.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {suggestions.map((s) => (
                    <button
                      key={s.hashtag}
                      type="button"
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                      onClick={() => addSuggestion(s.hashtag)}
                      title={`${s.count} usos · reach medio ${s.avg_reach.toLocaleString('pt-BR')}`}
                    >
                      #{s.hashtag}
                      <span className="text-muted-foreground">({s.count}x)</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Notas visuais (para o designer)
              </label>
              <Textarea
                value={visualNotes}
                onChange={(e) => setVisualNotes(e.target.value)}
                rows={2}
                className="text-sm"
                placeholder="Ex: usar foto do casal no por do sol..."
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Notas do analista
              </label>
              <Textarea
                value={analystNotes}
                onChange={(e) => setAnalystNotes(e.target.value)}
                rows={2}
                className="text-sm"
                placeholder="Observacoes internas..."
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          /* View mode */
          <div className="space-y-2">
            <p className="text-sm whitespace-pre-line">
              {post.caption_edited ?? post.caption}
            </p>

            {(post.hashtags_edited ?? post.hashtags)?.length ? (
              <p className="text-xs text-primary/70">
                {(post.hashtags_edited ?? post.hashtags)!
                  .map((h) => `#${h}`)
                  .join(' ')}
              </p>
            ) : null}

            {post.cta && (
              <p className="text-xs">
                <span className="font-medium">CTA:</span> {post.cta}
              </p>
            )}

            {post.visual_brief && (
              <div className="mt-2 p-3 bg-muted/30 rounded-lg">
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  Brief Visual
                </p>
                <p className="text-xs">{post.visual_brief}</p>
                {post.visual_notes && (
                  <p className="text-xs text-blue-600 mt-1 italic">
                    Nota: {post.visual_notes}
                  </p>
                )}
              </div>
            )}

            {/* Reel extras */}
            {post.format === 'REEL' && post.reel_concept && (
              <div className="mt-2 p-3 bg-purple-50/50 rounded-lg">
                <p className="text-xs font-medium text-purple-600 mb-1">Conceito do Reel</p>
                <p className="text-xs">{post.reel_concept}</p>
                {post.reel_duration && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Duracao: {post.reel_duration}
                  </p>
                )}
                {post.audio_suggestion && (
                  <p className="text-xs text-muted-foreground">
                    Audio: {post.audio_suggestion}
                  </p>
                )}
              </div>
            )}

            {/* Carousel slides */}
            {post.format === 'CAROUSEL' && post.slides && post.slides.length > 0 && (
              <div className="mt-2 p-3 bg-blue-50/50 rounded-lg">
                <p className="text-xs font-medium text-blue-600 mb-1">
                  Slides ({post.slides.length})
                </p>
                {post.slides.map((slide, i) => (
                  <p key={i} className="text-xs mt-1">
                    <span className="font-medium">{i + 1}.</span>{' '}
                    {String(slide.content ?? slide.text ?? slide.description ?? JSON.stringify(slide))}
                  </p>
                ))}
              </div>
            )}

            {post.strategic_note && (
              <p className="text-xs text-muted-foreground italic mt-2">
                Nota estrategica: {post.strategic_note}
              </p>
            )}

            {post.analyst_notes && (
              <p className="text-xs text-yellow-600 italic mt-1">
                Analista: {post.analyst_notes}
              </p>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2 border-t mt-3">
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                Editar
              </Button>
              {post.status === 'PENDING' && (
                <>
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => handleStatusChange('APPROVED')}
                    disabled={saving}
                  >
                    Aprovar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-yellow-600 border-yellow-300 hover:bg-yellow-50"
                    onClick={() => handleStatusChange('REVISION_REQUESTED')}
                    disabled={saving}
                  >
                    Pedir revisao
                  </Button>
                </>
              )}
              {post.status === 'REVISION_REQUESTED' && (
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => handleStatusChange('APPROVED')}
                  disabled={saving}
                >
                  Aprovar
                </Button>
              )}
              {post.status === 'APPROVED' && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-gray-500"
                  onClick={() => handleStatusChange('PENDING')}
                  disabled={saving}
                >
                  Voltar para pendente
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
