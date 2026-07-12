'use client'

import { useEffect, useState, type ComponentType } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  PlusCircle,
  ListChecks,
  Newspaper,
  FileText,
  MessageSquare,
  Settings,
  ShieldCheck,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
  Sparkles,
  HelpCircle,
  Mail,
  LifeBuoy,
  type LucideProps,
} from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'
import SignOutButton from '@/app/app/sign-out-button'
import { SectionLabel } from '@/components/admin/section-label'

// ---------------------------------------------------------------------------
// Nav config — grouped, icon + label, modeled on admin-shell.tsx. "Coming
// soon" items are inert placeholders (no href, disabled styling) — they must
// never navigate anywhere per the account-area plan.
// ---------------------------------------------------------------------------
type NavItem = {
  href: string
  label: string
  icon: ComponentType<LucideProps>
  exact?: boolean
}
type ComingSoonItem = { label: string; icon: ComponentType<LucideProps> }
type NavGroup =
  | { label: string; items: NavItem[]; comingSoon?: undefined }
  | { label: string; comingSoon: ComingSoonItem[]; items?: undefined }

const BASE_NAV_GROUPS: NavGroup[] = [
  {
    label: 'Ideas',
    items: [
      { href: '/app', label: 'New idea', icon: PlusCircle },
      { href: '/app/account', label: 'My ideas', icon: ListChecks, exact: true },
    ],
  },
  {
    label: 'Coming soon',
    comingSoon: [
      { label: 'Blog', icon: Newspaper },
      { label: 'Articles', icon: FileText },
      { label: 'Forum', icon: MessageSquare },
    ],
  },
  {
    label: 'Account',
    items: [{ href: '/app/account/settings', label: 'Settings', icon: Settings }],
  },
  {
    // Public help pages, reachable without leaving the account area's nav —
    // on mobile these live in the same hamburger drawer as everything else.
    label: 'Help',
    items: [
      { href: '/faq', label: 'FAQ', icon: HelpCircle },
      { href: '/contact', label: 'Contact', icon: Mail },
      { href: '/support', label: 'Support', icon: LifeBuoy },
    ],
  },
]

function getNavGroups(isAdmin: boolean): NavGroup[] {
  const groups = [...BASE_NAV_GROUPS]
  if (isAdmin) {
    groups.push({
      label: 'Admin',
      items: [{ href: '/app/admin', label: 'Admin panel', icon: ShieldCheck }],
    })
  }
  return groups
}

function isItemActive(item: NavItem, pathname: string): boolean {
  if (item.exact) return pathname === item.href
  return pathname === item.href || pathname.startsWith(item.href + '/')
}

/** Human page title for the top bar, derived from the route. */
function pageTitle(pathname: string): string {
  if (pathname === '/app/account/settings') return 'Settings'
  if (pathname.startsWith('/app/account/ideas/') && pathname.endsWith('/report')) return 'Report'
  return 'My ideas'
}

const STORAGE_KEY = 'account.sidebar.collapsed'

// ---------------------------------------------------------------------------

export function AccountShell({
  email,
  identityName,
  isAdmin,
  children,
}: {
  email: string
  identityName: string
  isAdmin: boolean
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  // Restore persisted collapse preference post-mount (SSR renders expanded).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCollapsed(localStorage.getItem(STORAGE_KEY) === '1')
  }, [])

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobileOpen(false)
  }, [pathname])

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
      } catch {
        /* ignore private-mode storage failures */
      }
      return next
    })
  }

  return (
    <div className="min-h-screen bg-slate-950 light:bg-gray-50">
      {/* Mobile drawer backdrop */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden"
        />
      )}

      <Sidebar
        pathname={pathname}
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        email={email}
        identityName={identityName}
        isAdmin={isAdmin}
        onCloseMobile={() => setMobileOpen(false)}
      />

      {/* Main column — offset by the sidebar width on lg+ only. */}
      <div className={`min-h-screen ${collapsed ? 'lg:pl-16' : 'lg:pl-60'} transition-[padding] duration-200`}>
        <TopBar
          title={pageTitle(pathname)}
          identityName={identityName}
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
          onOpenMobile={() => setMobileOpen(true)}
        />
        <main className="px-6 py-6">{children}</main>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

function Sidebar({
  pathname,
  collapsed,
  mobileOpen,
  email,
  identityName,
  isAdmin,
  onCloseMobile,
}: {
  pathname: string
  collapsed: boolean
  mobileOpen: boolean
  email: string
  identityName: string
  isAdmin: boolean
  onCloseMobile: () => void
}) {
  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-white/10 bg-slate-900 light:border-gray-200 light:bg-white transition-transform duration-200 lg:transition-[width]
        ${collapsed ? 'lg:w-16' : 'lg:w-60'}
        w-60
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
    >
      {/* Brand */}
      <div className={`flex h-16 items-center gap-2.5 border-b border-white/10 light:border-gray-200 ${collapsed ? 'lg:justify-center lg:px-0' : ''} px-4`}>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-sm">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className={`min-w-0 ${collapsed ? 'lg:hidden' : ''}`}>
          <span className="block truncate text-sm font-semibold text-white light:text-gray-900">HadIdea</span>
          <span className="block text-[11px] font-medium uppercase tracking-wider text-indigo-300 light:text-indigo-500">
            Account
          </span>
        </span>
        {/* Close button — mobile drawer only */}
        <button
          type="button"
          aria-label="Close menu"
          onClick={onCloseMobile}
          className="ml-auto rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white light:text-gray-500 light:hover:bg-gray-100 light:hover:text-gray-900 lg:hidden"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-5">
        {getNavGroups(isAdmin).map((group) => (
          <div key={group.label}>
            <SectionLabel className={`px-2 pb-2 ${collapsed ? 'lg:sr-only' : ''}`}>{group.label}</SectionLabel>
            <ul className="space-y-1">
              {group.items?.map((item) => {
                const active = isItemActive(item, pathname)
                const Icon = item.icon
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      title={collapsed ? item.label : undefined}
                      aria-current={active ? 'page' : undefined}
                      className={`group flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
                        collapsed ? 'lg:justify-center' : ''
                      } ${
                        active
                          ? 'bg-indigo-500/15 text-indigo-300 light:bg-indigo-50 light:text-indigo-700'
                          : 'text-slate-400 hover:bg-white/5 hover:text-white light:text-gray-600 light:hover:bg-gray-100 light:hover:text-gray-900'
                      }`}
                    >
                      <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                      <span className={collapsed ? 'lg:hidden' : ''}>{item.label}</span>
                    </Link>
                  </li>
                )
              })}
              {group.comingSoon?.map((item) => {
                const Icon = item.icon
                return (
                  <li key={item.label}>
                    <span
                      title={collapsed ? `${item.label} — coming soon` : undefined}
                      aria-disabled="true"
                      className={`flex cursor-not-allowed items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium text-slate-600 light:text-gray-400 ${
                        collapsed ? 'lg:justify-center' : ''
                      }`}
                    >
                      <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                      <span className={`flex flex-1 items-center justify-between gap-2 ${collapsed ? 'lg:hidden' : ''}`}>
                        {item.label}
                        <span className="rounded-full bg-white/5 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 light:bg-gray-100 light:text-gray-400">
                          Soon
                        </span>
                      </span>
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Pinned identity + sign-out */}
      <div className="border-t border-white/10 p-3 light:border-gray-200">
        <div className={`flex items-center gap-3 rounded-lg px-2 py-2 ${collapsed ? 'lg:justify-center lg:px-0' : ''}`}>
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-sm font-semibold uppercase text-indigo-300 light:bg-indigo-100 light:text-indigo-700"
            aria-hidden="true"
          >
            {identityName.charAt(0)}
          </span>
          <div className={`min-w-0 flex-1 ${collapsed ? 'lg:hidden' : ''}`}>
            <p className="truncate text-xs font-medium text-white light:text-gray-900" title={identityName}>
              {identityName}
            </p>
            <p className="truncate text-[11px] text-slate-500 light:text-gray-400" title={email}>
              {email}
            </p>
            <SignOutButton />
          </div>
        </div>
      </div>
    </aside>
  )
}

// ---------------------------------------------------------------------------

function TopBar({
  title,
  identityName,
  collapsed,
  onToggleCollapsed,
  onOpenMobile,
}: {
  title: string
  identityName: string
  collapsed: boolean
  onToggleCollapsed: () => void
  onOpenMobile: () => void
}) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-white/10 bg-slate-950/80 px-6 backdrop-blur light:border-gray-200 light:bg-gray-50/80">
      {/* Mobile: open drawer */}
      <button
        type="button"
        aria-label="Open menu"
        onClick={onOpenMobile}
        className="rounded-lg p-2 text-slate-300 hover:bg-white/5 hover:text-white light:text-gray-500 light:hover:bg-gray-100 light:hover:text-gray-900 lg:hidden"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>

      {/* Desktop: collapse toggle */}
      <button
        type="button"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        onClick={onToggleCollapsed}
        className="hidden rounded-lg p-2 text-slate-300 hover:bg-white/5 hover:text-white light:text-gray-500 light:hover:bg-gray-100 light:hover:text-gray-900 lg:inline-flex"
      >
        {collapsed ? (
          <PanelLeftOpen className="h-5 w-5" aria-hidden="true" />
        ) : (
          <PanelLeftClose className="h-5 w-5" aria-hidden="true" />
        )}
      </button>

      <h1 className="truncate text-base font-semibold text-white light:text-gray-900">{title}</h1>

      <div className="ml-auto flex items-center gap-3">
        <ThemeToggle />
        <div className="flex items-center gap-2 rounded-full border border-white/10 py-1 pl-1 pr-3 light:border-gray-200">
          <span
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-xs font-semibold uppercase text-indigo-300 light:bg-indigo-100 light:text-indigo-700"
            aria-hidden="true"
          >
            {identityName.charAt(0)}
          </span>
          <span className="hidden max-w-[180px] truncate text-xs font-medium text-slate-300 light:text-gray-600 sm:block">
            {identityName}
          </span>
        </div>
      </div>
    </header>
  )
}
