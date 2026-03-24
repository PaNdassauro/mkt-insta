import PostGrid from '@/components/instagram/PostGrid'

export default function PostsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Posts</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Feed completo com metricas de performance e filtros
        </p>
      </div>

      <PostGrid />
    </div>
  )
}
