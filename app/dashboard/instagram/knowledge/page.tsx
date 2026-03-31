import KnowledgeBaseManager from '@/components/instagram/knowledge/KnowledgeBaseManager'

export default function KnowledgePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Knowledge Base</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie documentos e conteudos que alimentam a IA nas campanhas
        </p>
      </div>
      <KnowledgeBaseManager />
    </div>
  )
}
