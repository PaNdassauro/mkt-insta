'use client'

import { fetchWithAccount } from '@/lib/fetch-with-account'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import type { KnowledgeDocument } from '@/types/instagram'

export default function KnowledgeBaseManager() {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [scraping, setScraping] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetchWithAccount('/api/knowledge/documents')
      if (!res.ok) throw new Error('Falha ao carregar documentos')
      const data = await res.json()
      setDocuments(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const title = file.name.replace(/\.pdf$/i, '')

    setUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('title', title)

      const res = await fetchWithAccount('/api/knowledge/ingest', {
        method: 'POST',
        headers: {},
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Falha no upload')
      }

      await fetchDocuments()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro no upload')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleToggleActive(id: string, isActive: boolean) {
    try {
      const res = await fetchWithAccount('/api/knowledge/documents', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_active: !isActive }),
      })

      if (!res.ok) throw new Error('Falha ao atualizar')
      await fetchDocuments()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar')
    }
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Excluir "${title}" e todos os seus chunks?`)) return

    try {
      const res = await fetchWithAccount('/api/knowledge/documents', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })

      if (!res.ok) throw new Error('Falha ao excluir')
      await fetchDocuments()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir')
    }
  }

  async function handleScrape() {
    setScraping(true)
    setError(null)

    try {
      const res = await fetchWithAccount('/api/knowledge/scrape', {
        method: 'POST',
        headers: {},
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Falha no scraping')
      }

      const data = await res.json()
      alert(
        `Scraping concluido!\n${data.pages_scraped} paginas indexadas\n${data.total_chunks} chunks criados`
      )
      await fetchDocuments()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro no scraping')
    } finally {
      setScraping(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  const totalChunks = documents.reduce(
    (sum, d) => sum + (d.chunk_count ?? 0),
    0
  )
  const activeCount = documents.filter((d) => d.is_active).length

  return (
    <div className="space-y-6">
      {/* Header com acoes */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Knowledge Base</h2>
          <p className="text-sm text-muted-foreground">
            {documents.length} documento{documents.length !== 1 ? 's' : ''} ({activeCount} ativo{activeCount !== 1 ? 's' : ''}) · {totalChunks} chunks indexados
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleScrape}
            disabled={scraping}
          >
            {scraping ? 'Indexando site...' : 'Re-indexar Site'}
          </Button>
          <Button
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? 'Enviando...' : 'Upload PDF'}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={handleUpload}
          />
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Lista de documentos */}
      {documents.length === 0 ? (
        <Card className="border-2 border-dashed border-border/60 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-3xl mb-3">📚</p>
            <p className="text-muted-foreground text-sm font-medium">
              Nenhum documento indexado
            </p>
            <p className="text-muted-foreground text-xs mt-1">
              Faca upload de PDFs ou indexe seu site para alimentar a IA nas campanhas.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {documents.map((doc) => (
            <Card
              key={doc.id}
              className={`border-0 shadow-sm transition-all hover:shadow-md ${
                !doc.is_active ? 'opacity-50' : ''
              }`}
            >
              <CardHeader className="p-4 pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-sm font-medium truncate">
                      {doc.title}
                    </CardTitle>
                    {doc.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {doc.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <SourceBadge type={doc.source_type} />
                    <Badge
                      variant={doc.is_active ? 'default' : 'secondary'}
                      className="text-[10px]"
                    >
                      {doc.is_active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="flex items-center justify-between">
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span>{doc.chunk_count ?? 0} chunks</span>
                    {doc.file_name && <span>{doc.file_name}</span>}
                    {doc.source_url && (
                      <span className="truncate max-w-[200px]">
                        {doc.source_url}
                      </span>
                    )}
                    <span>
                      Indexado em{' '}
                      {new Date(doc.indexed_at).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() =>
                        handleToggleActive(doc.id, doc.is_active)
                      }
                    >
                      {doc.is_active ? 'Desativar' : 'Ativar'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-red-500 hover:text-red-600 hover:bg-red-50"
                      onClick={() => handleDelete(doc.id, doc.title)}
                    >
                      Excluir
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function SourceBadge({ type }: { type: string }) {
  const config: Record<string, { label: string; className: string }> = {
    PDF: { label: 'PDF', className: 'bg-red-50 text-red-600 border-red-200' },
    WEBSITE: {
      label: 'Site',
      className: 'bg-blue-50 text-blue-600 border-blue-200',
    },
    MANUAL: {
      label: 'Manual',
      className: 'bg-gray-50 text-gray-600 border-gray-200',
    },
  }

  const c = config[type] ?? config.MANUAL

  return (
    <Badge variant="outline" className={`text-[10px] ${c.className}`}>
      {c.label}
    </Badge>
  )
}
