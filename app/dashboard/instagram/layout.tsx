'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Image as ImageIcon,
  Film,
  Clock,
  TrendingUp,
  Users,
  Hash,
  Search,
  Trophy,
  FileText,
  Rocket,
  Calendar,
  Brain,
  MessageCircle,
  MessageSquare,
  AtSign,
  Settings,
  Smartphone,
  Lock,
  Activity,
  Monitor,
  LogOut,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  Check,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ThemeToggle } from '@/components/ThemeToggle'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { useSessionCheck } from '@/hooks/useSessionCheck'
import { useNotificationBadges } from '@/hooks/useNotificationBadges'
import { useCurrentAccount } from '@/hooks/useCurrentAccount'
import { PeriodSelector } from '@/components/PeriodSelector'

interface NavItem {
  label: string
  href: string
  icon: LucideIcon
}

interface NavGroup {
  label: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    label: 'Analytics',
    items: [
      { label: 'Visao Geral', href: '/dashboard/instagram', icon: LayoutDashboard },
      { label: 'Posts', href: '/dashboard/instagram/posts', icon: ImageIcon },
      { label: 'Reels', href: '/dashboard/instagram/reels', icon: Film },
      { label: 'Stories', href: '/dashboard/instagram/stories', icon: Clock },
      { label: 'Crescimento', href: '/dashboard/instagram/growth', icon: TrendingUp },
      { label: 'Audiencia', href: '/dashboard/instagram/audience', icon: Users },
      { label: 'Hashtags', href: '/dashboard/instagram/hashtags', icon: Hash },
      { label: 'Hashtag Monitor', href: '/dashboard/instagram/hashtag-monitor', icon: Search },
      { label: 'Concorrentes', href: '/dashboard/instagram/competitors', icon: Trophy },
      { label: 'Relatorio', href: '/dashboard/instagram/report', icon: FileText },
    ],
  },
  {
    label: 'Producao',
    items: [
      { label: 'Campanhas', href: '/dashboard/instagram/campaigns', icon: Rocket },
      { label: 'Calendario', href: '/dashboard/instagram/calendar', icon: Calendar },
      { label: 'Knowledge Base', href: '/dashboard/instagram/knowledge', icon: Brain },
    ],
  },
  {
    label: 'Engajamento',
    items: [
      { label: 'Comentarios', href: '/dashboard/instagram/comments', icon: MessageCircle },
      { label: 'Mensagens', href: '/dashboard/instagram/messages', icon: MessageSquare },
      { label: 'Mencoes', href: '/dashboard/instagram/mentions', icon: AtSign },
    ],
  },
  {
    label: 'Administracao',
    items: [
      { label: 'Configuracoes', href: '/dashboard/instagram/settings', icon: Settings },
      { label: 'Contas', href: '/dashboard/instagram/settings/accounts', icon: Smartphone },
      { label: 'Usuarios', href: '/dashboard/instagram/settings/users', icon: Lock },
      { label: 'Atividades', href: '/dashboard/instagram/settings/activity', icon: Activity },
      { label: 'Sistema', href: '/dashboard/instagram/settings/system', icon: Monitor },
    ],
  },
]

// Flat list for mobile drawer
const mobileNavItems: NavItem[] = [
  { label: 'Inicio', href: '/dashboard/instagram', icon: LayoutDashboard },
  { label: 'Posts', href: '/dashboard/instagram/posts', icon: ImageIcon },
  { label: 'Reels', href: '/dashboard/instagram/reels', icon: Film },
  { label: 'Stories', href: '/dashboard/instagram/stories', icon: Clock },
  { label: 'Crescimento', href: '/dashboard/instagram/growth', icon: TrendingUp },
  { label: 'Audiencia', href: '/dashboard/instagram/audience', icon: Users },
  { label: 'Hashtags', href: '/dashboard/instagram/hashtags', icon: Hash },
  { label: 'Concorrentes', href: '/dashboard/instagram/competitors', icon: Trophy },
  { label: 'Campanhas', href: '/dashboard/instagram/campaigns', icon: Rocket },
  { label: 'Calendario', href: '/dashboard/instagram/calendar', icon: Calendar },
  { label: 'Comentarios', href: '/dashboard/instagram/comments', icon: MessageCircle },
  { label: 'Mensagens', href: '/dashboard/instagram/messages', icon: MessageSquare },
  { label: 'Mencoes', href: '/dashboard/instagram/mentions', icon: AtSign },
  { label: 'Relatorio', href: '/dashboard/instagram/report', icon: FileText },
  { label: 'Config', href: '/dashboard/instagram/settings', icon: Settings },
]

export default function InstagramLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false)
  const accountDropdownRef = useRef<HTMLDivElement>(null)

  useSessionCheck()
  const badges = useNotificationBadges()
  const { accounts, currentAccount, setCurrentAccount, loading: accountsLoading } = useCurrentAccount()
  const activeAccounts = accounts.filter((a) => a.is_active)

  // Auto-collapse sidebar to icon rail on viewports < 1280px
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 1279px)')
    const apply = () => setSidebarCollapsed(mql.matches)
    apply()
    mql.addEventListener('change', apply)
    return () => mql.removeEventListener('change', apply)
  }, [])

  // Close account dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (accountDropdownRef.current && !accountDropdownRef.current.contains(e.target as Node)) {
        setAccountDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function getBadgeForItem(label: string): { count: number; type: 'count' | 'dot' } | null {
    switch (label) {
      case 'Comentarios':
        return badges.comments > 0 ? { count: badges.comments, type: 'count' } : null
      case 'Campanhas':
        return badges.campaigns > 0 ? { count: badges.campaigns, type: 'count' } : null
      case 'Mensagens':
        return badges.messages > 0 ? { count: badges.messages, type: 'count' } : null
      case 'Configuracoes':
        return badges.tokenExpiring ? { count: 0, type: 'dot' } : null
      default:
        return null
    }
  }

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

  const sidebarWidth = sidebarCollapsed ? 'w-[68px]' : 'w-[244px]'

  return (
    <div className="flex min-h-dvh bg-background">
      {/* Sidebar — desktop only (md+) */}
      <aside
        className={cn(
          'hidden shrink-0 border-r border-border bg-card md:flex md:flex-col transition-[width] duration-200 ease-out',
          sidebarWidth
        )}
      >
        {/* Logo / Brand */}
        <div className="flex h-16 items-center gap-3 border-b border-border px-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground font-serif text-sm font-semibold">
            DI
          </div>
          {!sidebarCollapsed && (
            <>
              <div className="min-w-0 flex-1">
                <Link href="/dashboard/instagram" className="block font-serif text-base font-semibold tracking-tight">
                  DashIG
                </Link>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground leading-none mt-0.5">
                  Welcome Weddings
                </p>
              </div>
              <ThemeToggle />
            </>
          )}
        </div>

        {/* Nav */}
        <nav
          className="flex flex-1 flex-col gap-1 overflow-y-auto px-2 py-4"
          role="navigation"
          aria-label="Menu principal"
        >
          {navGroups.map((group) => {
            const isCollapsed = collapsedGroups.has(group.label)
            const hasActiveItem = group.items.some((item) => isActive(item.href))

            return (
              <div key={group.label} className="mb-2">
                {!sidebarCollapsed && (
                  <button
                    onClick={() => toggleGroup(group.label)}
                    className="flex w-full items-center justify-between px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
                    aria-expanded={!isCollapsed}
                  >
                    {group.label}
                    <ChevronDown
                      className={cn(
                        'h-3 w-3 transition-transform',
                        isCollapsed ? '-rotate-90' : ''
                      )}
                    />
                  </button>
                )}
                {sidebarCollapsed && hasActiveItem && (
                  <div className="mx-3 mb-1 h-px bg-border" />
                )}
                {(!isCollapsed || sidebarCollapsed) && (
                  <div className="flex flex-col gap-0.5">
                    {group.items.map((item) => {
                      const badge = getBadgeForItem(item.label)
                      const Icon = item.icon
                      const active = isActive(item.href)
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          aria-current={active ? 'page' : undefined}
                          title={sidebarCollapsed ? item.label : undefined}
                          className={cn(
                            'group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                            active
                              ? 'bg-muted text-foreground font-medium'
                              : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                            sidebarCollapsed && 'justify-center px-0'
                          )}
                        >
                          {/* Active indicator bar */}
                          {active && (
                            <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-foreground" />
                          )}
                          <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                          {!sidebarCollapsed && (
                            <>
                              <span className="truncate">{item.label}</span>
                              {badge && badge.type === 'count' && (
                                <span className="ml-auto rounded-full bg-destructive px-1.5 py-0.5 text-[9px] font-semibold text-destructive-foreground tabular-nums">
                                  {badge.count > 99 ? '99+' : badge.count}
                                </span>
                              )}
                              {badge && badge.type === 'dot' && (
                                <span className="ml-auto h-2 w-2 rounded-full bg-accent" aria-label="Atencao" />
                              )}
                            </>
                          )}
                          {sidebarCollapsed && badge && (
                            <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-destructive" aria-label="Notificacao" />
                          )}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        {/* Footer — Account Selector */}
        <div className="border-t border-border p-2 space-y-1">
          <div className="relative" ref={accountDropdownRef}>
            <button
              onClick={() => activeAccounts.length > 1 && setAccountDropdownOpen((v) => !v)}
              className={cn(
                'flex w-full items-center gap-3 rounded-md p-2 text-left transition-colors hover:bg-muted',
                sidebarCollapsed && 'justify-center'
              )}
              aria-haspopup={activeAccounts.length > 1 ? 'listbox' : undefined}
              aria-expanded={accountDropdownOpen}
              title={sidebarCollapsed && currentAccount ? currentAccount.label : undefined}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-foreground text-[10px] font-semibold">
                IG
              </div>
              {!sidebarCollapsed && (
                <>
                  <div className="flex-1 min-w-0">
                    {accountsLoading ? (
                      <p className="text-xs font-medium">Carregando...</p>
                    ) : currentAccount ? (
                      <>
                        <p className="text-xs font-medium truncate">{currentAccount.label}</p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {currentAccount.username ? `@${currentAccount.username}` : currentAccount.ig_user_id}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-xs font-medium">Nenhuma conta</p>
                        <p className="text-[10px] text-muted-foreground">Configure em Contas</p>
                      </>
                    )}
                  </div>
                  {activeAccounts.length > 1 && (
                    <ChevronDown
                      className={cn(
                        'h-3 w-3 shrink-0 text-muted-foreground transition-transform',
                        accountDropdownOpen && 'rotate-180'
                      )}
                    />
                  )}
                </>
              )}
            </button>

            {accountDropdownOpen && activeAccounts.length > 1 && (
              <div
                className="absolute bottom-full left-0 right-0 mb-1 max-h-48 overflow-y-auto rounded-md border border-border bg-popover shadow-md z-50"
                role="listbox"
                aria-label="Selecionar conta Instagram"
              >
                {activeAccounts.map((account) => (
                  <button
                    key={account.id}
                    role="option"
                    aria-selected={account.id === currentAccount?.id}
                    onClick={() => {
                      setCurrentAccount(account.id)
                      setAccountDropdownOpen(false)
                      window.location.reload()
                    }}
                    className={cn(
                      'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted',
                      account.id === currentAccount?.id && 'bg-muted/60'
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{account.label}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {account.username ? `@${account.username}` : account.ig_user_id}
                      </p>
                    </div>
                    {account.id === currentAccount?.id && (
                      <Check className="h-3 w-3 text-foreground" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Collapse toggle (visible only on lg+ where user can choose) */}
          <button
            onClick={() => setSidebarCollapsed((v) => !v)}
            className={cn(
              'hidden xl:flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors',
              sidebarCollapsed && 'justify-center px-0'
            )}
            aria-label={sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            {sidebarCollapsed ? (
              <ChevronsRight className="h-4 w-4" strokeWidth={1.75} />
            ) : (
              <>
                <ChevronsLeft className="h-4 w-4" strokeWidth={1.75} />
                Recolher
              </>
            )}
          </button>

          <button
            onClick={handleLogout}
            className={cn(
              'flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors',
              sidebarCollapsed && 'justify-center px-0'
            )}
            aria-label="Sair da conta"
            title={sidebarCollapsed ? 'Sair' : undefined}
          >
            <LogOut className="h-4 w-4" strokeWidth={1.75} />
            {!sidebarCollapsed && 'Sair'}
          </button>
        </div>
      </aside>

      {/* Mobile header + horizontal nav */}
      <div className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-card/95 backdrop-blur-sm md:hidden">
        <div className="flex h-14 items-center gap-2 px-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground font-serif text-xs font-semibold">
            DI
          </div>
          <span className="font-serif text-base font-semibold">DashIG</span>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <button
              onClick={handleLogout}
              className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="Sair da conta"
            >
              <LogOut className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </div>
        </div>
        <nav
          className="flex overflow-x-auto border-t border-border px-2 py-1.5"
          role="navigation"
          aria-label="Menu principal"
        >
          {mobileNavItems.map((item) => {
            const badge = getBadgeForItem(item.label)
            const Icon = item.icon
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs transition-colors',
                  active
                    ? 'bg-muted text-foreground font-medium'
                    : 'text-muted-foreground'
                )}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                {item.label}
                {badge && badge.type === 'count' && (
                  <span className="ml-0.5 rounded-full bg-destructive px-1.5 text-[9px] font-semibold text-destructive-foreground tabular-nums">
                    {badge.count > 99 ? '99+' : badge.count}
                  </span>
                )}
                {badge && badge.type === 'dot' && (
                  <span className="ml-0.5 h-2 w-2 rounded-full bg-accent" aria-label="Atencao" />
                )}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Main content — fluid canvas, no max-width */}
      <main className="flex-1 overflow-auto pt-[7.5rem] md:pt-0">
        <div className="px-4 py-6 md:px-8 md:py-8 3xl:px-12">
          <div className="mb-6 flex justify-end">
            <PeriodSelector />
          </div>
          <ErrorBoundary>{children}</ErrorBoundary>
        </div>
      </main>
    </div>
  )
}
