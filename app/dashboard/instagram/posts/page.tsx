import PostGrid from '@/components/instagram/PostGrid'
import ExportButton from '@/components/instagram/ExportButton'
import CollabNotice from '@/components/instagram/CollabNotice'

export default function PostsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Posts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Feed completo com métricas de performance e filtros
          </p>
        </div>
        <ExportButton type="posts" />
      </div>

      <CollabNotice />

      <PostGrid />
    </div>
  )
}
