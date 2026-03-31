'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { ThemeToggle } from '@/components/ThemeToggle'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { useSessionCheck } from '@/hooks/useSessionCheck'

interface NavGroup {
  label: string
  items: { label: string; href: string; icon: string }[]
}

const navGroups: NavGroup[] = [
  {
    label: 'Analytics',
    items: [
      { label: 'Visao Geral', href: '/dashboard/instagram', icon: '📊' },
      { label: 'Posts', href: '/dashboard/instagram/posts', icon: '📸' },
      { label: 'Reels', href: '/dashboard/instagram/reels', icon: '🎬' },
      { label: 'Stories', href: '/dashboard/instagram/stories', icon: '⏳' },
      { label: 'Crescimento', href: '/dashboard/instagram/growth', icon: '📈' },
      { label: 'Audiencia', href: '/dashboard/instagram/audience', icon: '👥' },
      { label: 'Hashtags', href: '/dashboard/instagram/hashtags', icon: '🏷' },
      { label: 'Hashtag Monitor', href: '/dashboard/instagram/hashtag-monitor', icon: '🔍' },
      { label: 'Concorrentes', href: '/dashboard/instagram/competitors', icon: '🏆' },
      { label: 'Relatorio', href: '/dashboard/instagram/report', icon: '📋' },
    ],
  },
  {
    label: 'Producao',
    items: [
      { label: 'Campanhas', href: '/dashboard/instagram/campaigns', icon: '🚀' },
      { label: 'Calendario', href: '/dashboard/instagram/calendar', icon: '📅' },
      { label: 'Knowledge Base', href: '/dashboard/instagram/knowledge', icon: '🧠' },
    ],
  },
  {
    label: 'Engajamento',
    items: [
      { label: 'Comentarios', href: '/dashboard/instagram/comments', icon: '💭' },
      { label: 'Mensagens', href: '/dashboard/instagram/messages', icon: '💬' },
      { label: 'Mencoes', href: '/dashboard/instagram/mentions', icon: '📷' },
    ],
  },
  {
    label: 'Administracao',
    items: [
      { label: 'Configuracoes', href: '/dashboard/instagram/settings', icon: '⚙️' },
      { label: 'Usuarios', href: '/dashboard/instagram/settings/users', icon: '🔐' },
      { label: 'Atividades', href: '/dashboard/instagram/settings/activity', icon: '📜' },
      { label: 'Sistema', href: '/dashboard/instagram/settings/system', icon: '🖥' },
    ],
  },
]

// Flat list for mobile — core features accessible
const mobileNavItems = [
  { label: 'Inicio', href: '/dashboard/instagram', icon: '📊' },
  { label: 'Posts', href: '/dashboard/instagram/posts', icon: '📸' },
  { label: 'Reels', href: '/dashboard/instagram/reels', icon: '🎬' },
  { label: 'Stories', href: '/dashboard/instagram/stories', icon: '⏳' },
  { label: 'Crescimento', href: '/dashboard/instagram/growth', icon: '📈' },
  { label: 'Audiencia', href: '/dashboard/instagram/audience', icon: '👥' },
  { label: 'Hashtags', href: '/dashboard/instagram/hashtags', icon: '🏷' },
  { label: 'Concorrentes', href: '/dashboard/instagram/competitors', icon: '🏆' },
  { label: 'Campanhas', href: '/dashboard/instagram/campaigns', icon: '🚀' },
  { label: 'Calendario', href: '/dashboard/instagram/calendar', icon: '📅' },
  { label: 'Comentarios', href: '/dashboard/instagram/comments', icon: '💭' },
  { label: 'Mensagens', href: '/dashboard/instagram/messages', icon: '💬' },
  { label: 'Mencoes', href: '/dashboard/instagram/mentions', icon: '📷' },
  { label: 'Relatorio', href: '/dashboard/instagram/report', icon: '📋' },
  { label: 'Config', href: '/dashboard/instagram/settings', icon: '⚙️' },
]

export default function InstagramLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  useSessionCheck()

  function toggleGroup(label: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }

  async function handleLogout() {
    const supabase = createBrowserSupabaseClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  function isActive(href: string) {
    if (href === '/dashboard/instagram') return pathname === '/dashboard/instagram'
    return pathname.startsWith(href)
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar desktop */}
      <aside className="hidden w-[260px] shrink-0 border-r border-border/50 bg-card md:flex md:flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-border/50 px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
            IG
          </div>
          <div>
            <Link href="/dashboard/instagram" className="text-base font-bold tracking-tight">
              DashIG
            </Link>
            <p className="text-[11px] text-muted-foreground leading-none">Welcome Weddings</p>
          </div>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>

        {/* Nav */}
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3" role="navigation" aria-label="Menu principal">
          {navGroups.map((group) => {
            const isCollapsed = collapsedGroups.has(group.label)
            const hasActiveItem = group.items.some((item) => isActive(item.href))

            return (
              <div key={group.label}>
                <button
                  onClick={() => toggleGroup(group.label)}
                  className="flex w-full items-center justify-between px-3 py-1.5 mb-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                  aria-expanded={!isCollapsed}
                >
                  {group.label}
                  <span className={cn('text-[10px] transition-transform', isCollapsed ? '-rotate-90' : '')}>
                    ▼
                  </span>
                </button>
                {!isCollapsed && (
                  <div className="flex flex-col gap-0.5 mb-2">
                    {group.items.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={isActive(item.href) ? 'page' : undefined}
                        className={cn(
                          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all',
                          isActive(item.href)
                            ? 'bg-primary/10 text-primary font-medium'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        )}
                      >
                        <span className="text-base" aria-hidden="true">{item.icon}</span>
                        {item.label}
                      </Link>
                    ))}
                  </div>
                )}
                {isCollapsed && hasActiveItem && (
                  <div className="h-0.5 mx-3 mb-2 rounded-full bg-primary/30" />
                )}
              </div>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-border/50 p-4 space-y-2">
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs font-medium text-foreground">@welcomeweddings</p>
            <p className="text-[11px] text-muted-foreground">Ultima sync: hoje</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Sair da conta"
          >
            <span aria-hidden="true">🚪</span>
            Sair
          </button>
        </div>
      </aside>

      {/* Mobile header + nav */}
      <div className="fixed top-0 left-0 right-0 z-50 border-b bg-card/95 backdrop-blur-sm md:hidden">
        <div className="flex h-14 items-center gap-2 px-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xs font-bold">
            IG
          </div>
          <span className="text-sm font-bold">DashIG</span>
          <button
            onClick={handleLogout}
            className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Sair da conta"
          >
            Sair
          </button>
        </div>
        <nav className="flex overflow-x-auto border-t px-2 py-1.5" role="navigation" aria-label="Menu principal">
          {mobileNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? 'page' : undefined}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs transition-colors',
                isActive(item.href)
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground'
              )}
            >
              <span aria-hidden="true">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-auto pt-[7.5rem] md:pt-0">
        <div className="mx-auto max-w-7xl p-4 md:p-8">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </div>
      </main>
    </div>
  )
}
