'use client'

import { useEffect, useState, type ComponentType } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  LineChart,
  Users,
  Handshake,
  Tag,
  MessageSquare,
  BookOpen,
  Mail,
  ClipboardList,
  DollarSign,
  AlertTriangle,
  Bug,
  Sprout,
  Settings,
  UserCircle,
  LayoutTemplate,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
  Sparkles,
  ChevronDown,
  type LucideProps,
} from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'
import SignOutButton from '@/app/app/sign-out-button'
import { SectionLabel } from '@/components/admin/section-label'
import { ADMIN_NAV_SEEN_EVENT } from '@/lib/admin-nav-events'

// ---------------------------------------------------------------------------
// Nav config — grouped, icon + label. `exact` matches only the exact path
// (Dashboard, whose href is a prefix of every sibling). `noActive` items link
// somewhere real but never own the active pill (Analytics = the dashboard's
// growth section). Errors (R4) is a real page once migration 009 is run.
// `children` makes an item an expandable dropdown (Surveys): the parent row
// toggles open/closed, children own the active pill, and the parent shows a
// subdued highlight while any child route is active. Collapsed (icon-only)
// mode renders just the parent icon, linking to the first child.
// ---------------------------------------------------------------------------
type NavChild = {
  href: string
  label: string
  exact?: boolean
}
type NavItem = {
  href: string
  label: string
  icon: ComponentType<LucideProps>
  exact?: boolean
  noActive?: boolean
  children?: NavChild[]
}
type NavGroup = { label: string; items: NavItem[] }

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { href: '/app/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
      { href: '/app/admin#growth', label: 'Analytics', icon: LineChart, noActive: true },
    ],
  },
  {
    label: 'Management',
    items: [
      { href: '/app/admin/users', label: 'Users', icon: Users },
      { href: '/app/admin/affiliates', label: 'Affiliates', icon: Handshake },
      { href: '/app/admin/offers', label: 'Offers', icon: Tag },
      { href: '/app/admin/samples', label: 'Samples', icon: BookOpen },
      {
        href: '/app/admin/surveys',
        label: 'Surveys',
        icon: ClipboardList,
        children: [
          { href: '/app/admin/surveys', label: 'Create survey', exact: true },
          { href: '/app/admin/surveys/analytics', label: 'Analytics' },
        ],
      },
      { href: '/app/admin/feedback', label: 'Feedback', icon: MessageSquare },
      { href: '/app/admin/contact', label: 'Contact', icon: Mail },
      { href: '/app/admin/templates', label: 'Templates', icon: LayoutTemplate },
    ],
  },
  {
    label: 'Finance',
    items: [{ href: '/app/admin/sales', label: 'Sales', icon: DollarSign }],
  },
  {
    label: 'System',
    items: [
      { href: '/app/admin/errors', label: 'Errors', icon: AlertTriangle },
      { href: '/app/admin/bugs', label: 'Bugs', icon: Bug },
      { href: '/app/admin/evergreen', label: 'Evergreen', icon: Sprout },
      { href: '/app/admin/settings', label: 'Settings', icon: Settings },
      { href: '/app/account', label: 'My account', icon: UserCircle, noActive: true },
    ],
  },
]

function isItemActive(item: NavItem, pathname: string): boolean {
  if (item.noActive) return false
  if (item.exact) return pathname === item.href
  return pathname === item.href || pathname.startsWith(item.href + '/')
}

function isChildActive(child: NavChild, pathname: string): boolean {
  if (child.exact) return pathname === child.href
  return pathname === child.href || pathname.startsWith(child.href + '/')
}

// ---------------------------------------------------------------------------
// Live nav status (GET /api/admin/nav-status) — survey-active dot on Surveys,
// and "new since I last visited that page" count badges on Contact, Feedback,
// Bugs, and Errors (migration 023, admin_seen). Fetched on mount, on every
// route change (so the queues feel live as Danny works through them), and on
// a 60s poll — plus once more whenever a MarkSeen component finishes marking
// a page seen (see admin-nav-events.ts) so the badge for the page you just
// opened clears immediately rather than waiting for the next poll. Any fetch
// failure is silent — no badges, no error UI.
// ---------------------------------------------------------------------------

interface NavStatus {
  surveyActive: boolean
  contactCount: number
  feedbackCount: number
  bugsCount: number
  errorsCount: number
  evergreenCount: number
}

const EMPTY_NAV_STATUS: NavStatus = {
  surveyActive: false,
  contactCount: 0,
  feedbackCount: 0,
  bugsCount: 0,
  errorsCount: 0,
  evergreenCount: 0,
}
const NAV_STATUS_POLL_MS = 60_000

type BadgeKind = 'none' | 'dot-emerald' | 'count-amber' | 'count-red'

/** Badge state for a single nav item — at most one kind applies per item. */
function getNavBadge(href: string, status: NavStatus): { kind: BadgeKind; count: number } {
  if (href === '/app/admin/surveys') return { kind: status.surveyActive ? 'dot-emerald' : 'none', count: 0 }
  if (href === '/app/admin/contact') return { kind: status.contactCount > 0 ? 'count-amber' : 'none', count: status.contactCount }
  if (href === '/app/admin/feedback') return { kind: status.feedbackCount > 0 ? 'count-amber' : 'none', count: status.feedbackCount }
  if (href === '/app/admin/bugs') return { kind: status.bugsCount > 0 ? 'count-amber' : 'none', count: status.bugsCount }
  if (href === '/app/admin/errors') return { kind: status.errorsCount > 0 ? 'count-red' : 'none', count: status.errorsCount }
  if (href === '/app/admin/evergreen') return { kind: status.evergreenCount > 0 ? 'count-amber' : 'none', count: status.evergreenCount }
  return { kind: 'none', count: 0 }
}

/** Human-readable suffix appended to the link's title/aria-label — keeps the badge non-colour-only. */
function badgeDescription(href: string, status: NavStatus): string {
  if (href === '/app/admin/surveys' && status.surveyActive) return ' — survey active'
  if (href === '/app/admin/contact' && status.contactCount > 0) return ` — ${status.contactCount} new since last visit`
  if (href === '/app/admin/feedback' && status.feedbackCount > 0) return ` — ${status.feedbackCount} new since last visit`
  if (href === '/app/admin/bugs' && status.bugsCount > 0) return ` — ${status.bugsCount} new since last visit`
  if (href === '/app/admin/errors' && status.errorsCount > 0) return ` — ${status.errorsCount} new since last visit`
  // State-based, not seen-based: reflects rows awaiting review right now.
  if (href === '/app/admin/evergreen' && status.evergreenCount > 0) return ` — ${status.evergreenCount} awaiting review`
  return ''
}

/** Worst-case severity across every section — red > amber > emerald — used for
 *  the single combined dot on the mobile hamburger button, the only spot
 *  where the per-item indicators below are literally invisible (drawer closed). */
function overallSeverity(status: NavStatus): 'red' | 'amber' | 'emerald' | null {
  if (status.errorsCount > 0) return 'red'
  if (status.bugsCount > 0 || status.contactCount > 0 || status.feedbackCount > 0 || status.evergreenCount > 0) return 'amber'
  if (status.surveyActive) return 'emerald'
  return null
}

function useNavStatus(pathname: string): NavStatus {
  const [status, setStatus] = useState<NavStatus>(EMPTY_NAV_STATUS)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = await fetch('/api/admin/nav-status')
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setStatus({
          surveyActive: !!data.surveyActive,
          contactCount: Number.isFinite(data.contactCount) ? data.contactCount : 0,
          feedbackCount: Number.isFinite(data.feedbackCount) ? data.feedbackCount : 0,
          bugsCount: Number.isFinite(data.bugsCount) ? data.bugsCount : 0,
          errorsCount: Number.isFinite(data.errorsCount) ? data.errorsCount : 0,
          evergreenCount: Number.isFinite(data.evergreenCount) ? data.evergreenCount : 0,
        })
      } catch {
        /* silent — no badges on failure */
      }
    }

    load()
    const interval = setInterval(load, NAV_STATUS_POLL_MS)
    // See admin-nav-events.ts: MarkSeen (mounted on the 4 badge-bearing pages)
    // dispatches this once its mark-seen POST settles, so the badge for the
    // page just visited clears right away instead of on the next 60s poll.
    window.addEventListener(ADMIN_NAV_SEEN_EVENT, load)
    return () => {
      cancelled = true
      clearInterval(interval)
      window.removeEventListener(ADMIN_NAV_SEEN_EVENT, load)
    }
    // Refetch whenever the route changes, in addition to the mount fetch + poll above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  return status
}

/** Human page title for the top bar, derived from the route. */
function pageTitle(pathname: string): string {
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (item.noActive) continue
      // Children first: the parent's index route keeps the parent label,
      // deeper children read as "Parent — Child" (Surveys — Analytics).
      for (const child of item.children ?? []) {
        if (isChildActive(child, pathname)) {
          return child.href === item.href ? item.label : `${item.label} — ${child.label}`
        }
      }
      if (isItemActive(item, pathname)) {
        // A user detail page reads better as "User detail" than "Users".
        if (item.href === '/app/admin/users' && pathname !== '/app/admin/users') {
          return 'User detail'
        }
        return item.label
      }
    }
  }
  return 'Admin'
}

const STORAGE_KEY = 'admin.sidebar.collapsed'

// ---------------------------------------------------------------------------

export function AdminShell({ email, children }: { email: string; children: React.ReactNode }) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const navStatus = useNavStatus(pathname)

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
        navStatus={navStatus}
        onCloseMobile={() => setMobileOpen(false)}
      />

      {/* Main column — offset by the sidebar width on lg+ only. */}
      <div className={`min-h-screen ${collapsed ? 'lg:pl-16' : 'lg:pl-60'} transition-[padding] duration-200`}>
        <TopBar
          title={pageTitle(pathname)}
          email={email}
          collapsed={collapsed}
          navStatus={navStatus}
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
  navStatus,
  onCloseMobile,
}: {
  pathname: string
  collapsed: boolean
  mobileOpen: boolean
  email: string
  navStatus: NavStatus
  onCloseMobile: () => void
}) {
  // Dropdown items (Surveys): explicit open/closed choices per parent href.
  // Absent an explicit choice, a parent auto-opens while one of its child
  // routes is active.
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({})

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
            Admin
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
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <SectionLabel className={`px-2 pb-2 ${collapsed ? 'lg:sr-only' : ''}`}>{group.label}</SectionLabel>
            <ul className="space-y-1">
              {group.items.map((item) => {
                const active = isItemActive(item, pathname)
                const Icon = item.icon
                const badge = getNavBadge(item.href, navStatus)
                const hasIndicator = badge.kind !== 'none'
                const desc = badgeDescription(item.href, navStatus)
                const linkLabel = desc ? `${item.label}${desc}` : undefined

                if (item.children) {
                  const childIsActive = item.children.some((c) => isChildActive(c, pathname))
                  const open = openItems[item.href] ?? childIsActive
                  const rowClass = `group flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
                    childIsActive
                      ? 'text-indigo-300 light:text-indigo-700'
                      : 'text-slate-400 hover:bg-white/5 hover:text-white light:text-gray-600 light:hover:bg-gray-100 light:hover:text-gray-900'
                  }`
                  return (
                    <li key={item.href}>
                      {/* Expanded (and the always-expanded mobile drawer): a toggle row. */}
                      <button
                        type="button"
                        onClick={() => setOpenItems((prev) => ({ ...prev, [item.href]: !open }))}
                        aria-expanded={open}
                        aria-label={linkLabel}
                        title={linkLabel}
                        className={`${collapsed ? 'lg:hidden' : ''} ${rowClass}`}
                      >
                        <span className="relative shrink-0">
                          <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                        </span>
                        <span>{item.label}</span>
                        {badge.kind === 'dot-emerald' && (
                          <span
                            className="animate-pulse-dot ml-auto h-2 w-2 shrink-0 rounded-full bg-emerald-400 light:bg-emerald-500"
                            aria-hidden="true"
                          />
                        )}
                        <ChevronDown
                          className={`h-4 w-4 shrink-0 transition-transform ${badge.kind === 'dot-emerald' ? '' : 'ml-auto'} ${open ? '' : '-rotate-90'}`}
                          aria-hidden="true"
                        />
                      </button>
                      {/* Collapsed desktop: icon-only link to the first child. */}
                      <Link
                        href={item.children[0].href}
                        title={linkLabel ?? item.label}
                        aria-label={linkLabel ?? item.label}
                        aria-current={childIsActive ? 'page' : undefined}
                        className={`hidden ${collapsed ? 'lg:flex' : ''} items-center justify-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
                          childIsActive
                            ? 'bg-indigo-500/15 text-indigo-300 light:bg-indigo-50 light:text-indigo-700'
                            : 'text-slate-400 hover:bg-white/5 hover:text-white light:text-gray-600 light:hover:bg-gray-100 light:hover:text-gray-900'
                        }`}
                      >
                        <span className="relative shrink-0">
                          <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                          {hasIndicator && (
                            <span
                              className="absolute -right-1 -top-1 h-2 w-2 rounded-full ring-2 ring-slate-900 light:ring-white bg-emerald-400 light:bg-emerald-500"
                              aria-hidden="true"
                            />
                          )}
                        </span>
                      </Link>
                      {open && (
                        <ul className={`${collapsed ? 'lg:hidden' : ''} mt-1 space-y-1`}>
                          {item.children.map((child) => {
                            const cActive = isChildActive(child, pathname)
                            return (
                              <li key={child.href}>
                                <Link
                                  href={child.href}
                                  aria-current={cActive ? 'page' : undefined}
                                  className={`flex items-center rounded-lg py-1.5 pl-[42px] pr-2.5 text-sm font-medium transition-colors ${
                                    cActive
                                      ? 'bg-indigo-500/15 text-indigo-300 light:bg-indigo-50 light:text-indigo-700'
                                      : 'text-slate-400 hover:bg-white/5 hover:text-white light:text-gray-600 light:hover:bg-gray-100 light:hover:text-gray-900'
                                  }`}
                                >
                                  {child.label}
                                </Link>
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    </li>
                  )
                }

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      title={linkLabel ?? (collapsed ? item.label : undefined)}
                      aria-label={linkLabel}
                      aria-current={active ? 'page' : undefined}
                      className={`group flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
                        collapsed ? 'lg:justify-center' : ''
                      } ${
                        active
                          ? 'bg-indigo-500/15 text-indigo-300 light:bg-indigo-50 light:text-indigo-700'
                          : 'text-slate-400 hover:bg-white/5 hover:text-white light:text-gray-600 light:hover:bg-gray-100 light:hover:text-gray-900'
                      }`}
                    >
                      <span className="relative shrink-0">
                        <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                        {/* Collapsed (icon-only) mode: counts don't fit, so a corner dot
                            stands in for "there's something to see" — dot itself carries
                            no meaning beyond that, but the link's title/aria-label above
                            always spells out what changed. */}
                        {collapsed && hasIndicator && (
                          <span
                            className={`absolute -right-1 -top-1 h-2 w-2 rounded-full ring-2 ring-slate-900 light:ring-white ${
                              badge.kind === 'dot-emerald'
                                ? 'bg-emerald-400 light:bg-emerald-500'
                                : badge.kind === 'count-red'
                                  ? 'bg-red-400 light:bg-red-500'
                                  : 'bg-amber-400 light:bg-amber-500'
                            }`}
                            aria-hidden="true"
                          />
                        )}
                      </span>
                      <span className={collapsed ? 'lg:hidden' : ''}>{item.label}</span>
                      {!collapsed && badge.kind === 'dot-emerald' && (
                        <span
                          className="animate-pulse-dot ml-auto h-2 w-2 shrink-0 rounded-full bg-emerald-400 light:bg-emerald-500"
                          aria-hidden="true"
                        />
                      )}
                      {!collapsed && badge.kind === 'count-amber' && badge.count > 0 && (
                        <span
                          className="ml-auto inline-flex min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-amber-300 light:bg-amber-100 light:text-amber-700"
                          aria-hidden="true"
                        >
                          {badge.count > 99 ? '99+' : badge.count}
                        </span>
                      )}
                      {!collapsed && badge.kind === 'count-red' && badge.count > 0 && (
                        <span
                          className="ml-auto inline-flex min-w-[1.5rem] shrink-0 items-center justify-center rounded-full bg-red-500/15 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-red-300 light:bg-red-100 light:text-red-700"
                          aria-hidden="true"
                        >
                          !{badge.count > 99 ? '99+' : badge.count}
                        </span>
                      )}
                    </Link>
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
            {email.charAt(0)}
          </span>
          <div className={`min-w-0 flex-1 ${collapsed ? 'lg:hidden' : ''}`}>
            <p className="truncate text-xs font-medium text-white light:text-gray-900" title={email}>
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
  email,
  collapsed,
  navStatus,
  onToggleCollapsed,
  onOpenMobile,
}: {
  title: string
  email: string
  collapsed: boolean
  navStatus: NavStatus
  onToggleCollapsed: () => void
  onOpenMobile: () => void
}) {
  // On mobile the drawer (and every per-item indicator inside it) is fully
  // hidden until this button is tapped, so this is the one spot that needs a
  // single combined dot summarising ALL sections — hence the severity
  // precedence (red > amber > emerald) in overallSeverity().
  const severity = overallSeverity(navStatus)

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-white/10 bg-slate-950/80 px-6 backdrop-blur light:border-gray-200 light:bg-gray-50/80">
      {/* Mobile: open drawer */}
      <button
        type="button"
        aria-label={severity ? 'Open menu — new activity to review' : 'Open menu'}
        onClick={onOpenMobile}
        className="relative rounded-lg p-2 text-slate-300 hover:bg-white/5 hover:text-white light:text-gray-500 light:hover:bg-gray-100 light:hover:text-gray-900 lg:hidden"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
        {severity && (
          <span
            className={`absolute right-1 top-1 h-2 w-2 rounded-full ring-2 ring-slate-950 light:ring-gray-50 ${
              severity === 'red'
                ? 'bg-red-400 light:bg-red-500'
                : severity === 'amber'
                  ? 'bg-amber-400 light:bg-amber-500'
                  : 'bg-emerald-400 light:bg-emerald-500'
            }`}
            aria-hidden="true"
          />
        )}
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
            {email.charAt(0)}
          </span>
          <span className="hidden max-w-[180px] truncate text-xs font-medium text-slate-300 light:text-gray-600 sm:block">
            {email}
          </span>
        </div>
      </div>
    </header>
  )
}
