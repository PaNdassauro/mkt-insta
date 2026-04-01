import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  const supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            supabaseResponse.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Rotas publicas (nao precisam de auth)
  const publicPaths = [
    '/login',
    '/api/webhooks',
    '/api/instagram/sync',
    '/api/instagram/sync-stories',
    '/api/instagram/sync-audience',
    '/api/instagram/auto-publish',
    '/api/instagram/report',
    '/api/instagram/refresh-token',
    '/api/knowledge/scrape',
    '/api/auth/instagram',
    '/api/instagram/sync-competitors',
  ]
  const isPublic = publicPaths.some((p) => request.nextUrl.pathname.startsWith(p))
  const isApi = request.nextUrl.pathname.startsWith('/api/')
  const isRoot = request.nextUrl.pathname === '/'

  // APIs com CRON_SECRET nao precisam de sessao
  if (isApi) {
    const authHeader = request.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) return supabaseResponse
  }

  if (!user && !isPublic && !isRoot) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
