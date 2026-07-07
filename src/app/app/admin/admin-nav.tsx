'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/app/admin', label: 'Dashboard' },
  { href: '/app/admin/affiliates', label: 'Affiliates' },
  { href: '/app/admin/users', label: 'Users' },
  { href: '/app/admin/offers', label: 'Offers' },
  { href: '/app/admin/sales', label: 'Sales' },
  { href: '/app/admin/feedback', label: 'Feedback' },
]

export function AdminNav() {
  const pathname = usePathname()

  return (
    <nav className="border-b border-white/10 light:border-gray-200 px-6">
      <div className="max-w-5xl mx-auto flex items-center gap-6 overflow-x-auto">
        {TABS.map((tab) => {
          // Dashboard's href ('/app/admin') is a prefix of every other tab's
          // href, so it needs an exact match; the rest can match their subtree
          // (e.g. /app/admin/users/[id]) with a simple startsWith.
          const isActive =
            tab.href === '/app/admin'
              ? pathname === '/app/admin'
              : pathname.startsWith(tab.href)

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`whitespace-nowrap text-sm font-medium py-3 border-b-2 transition-colors ${
                isActive
                  ? 'border-indigo-500 text-white light:text-gray-900'
                  : 'border-transparent text-slate-400 light:text-gray-500 hover:text-white light:hover:text-gray-900'
              }`}
            >
              {tab.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
