'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const navItems = [
  { label: 'Visao Geral', href: '/dashboard/instagram', icon: '📊' },
  { label: 'Posts', href: '/dashboard/instagram/posts', icon: '📸' },
  { label: 'Reels', href: '/dashboard/instagram/reels', icon: '🎬' },
  { label: 'Stories', href: '/dashboard/instagram/stories', icon: '⏳' },
  { label: 'Crescimento', href: '/dashboard/instagram/growth', icon: '📈' },
  { label: 'Audiencia', href: '/dashboard/instagram/audience', icon: '👥' },
  { label: 'Hashtags', href: '/dashboard/instagram/hashtags', icon: '🏷' },
  { label: 'Concorrentes', href: '/dashboard/instagram/competitors', icon: '🏆' },
  { label: 'Calendario', href: '/dashboard/instagram/calendar', icon: '📅' },
  { label: 'Campanhas', href: '/dashboard/instagram/campaigns', icon: '🚀' },
  { label: 'Mensagens', href: '/dashboard/instagram/messages', icon: '💬' },
  { label: 'Comentarios', href: '/dashboard/instagram/comments', icon: '💭' },
  { label: 'Mencoes', href: '/dashboard/instagram/mentions', icon: '📷' },
  { label: 'Knowledge Base', href: '/dashboard/instagram/knowledge', icon: '🧠' },
  { label: 'Relatorio', href: '/dashboard/instagram/report', icon: '📋' },
]

export default function InstagramLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

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
        </div>

        {/* Nav */}
        <nav className="flex flex-1 flex-col gap-0.5 p-3">
          <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Menu
          </p>
          {navItems.map((item) => {
            const isActive =
              item.href === '/dashboard/instagram'
                ? pathname === '/dashboard/instagram'
                : pathname.startsWith(item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all',
                  isActive
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <span className="text-base">{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-border/50 p-4">
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs font-medium text-foreground">@welcomeweddings</p>
            <p className="text-[11px] text-muted-foreground">Ultima sync: hoje</p>
          </div>
        </div>
      </aside>

      {/* Mobile header + nav */}
      <div className="fixed top-0 left-0 right-0 z-50 border-b bg-card/95 backdrop-blur-sm md:hidden">
        <div className="flex h-14 items-center gap-2 px-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xs font-bold">
            IG
          </div>
          <span className="text-sm font-bold">DashIG</span>
        </div>
        <nav className="flex overflow-x-auto border-t px-2 py-1.5">
          {navItems.map((item) => {
            const isActive =
              item.href === '/dashboard/instagram'
                ? pathname === '/dashboard/instagram'
                : pathname.startsWith(item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground'
                )}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-auto pt-[7.5rem] md:pt-0">
        <div className="mx-auto max-w-7xl p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
