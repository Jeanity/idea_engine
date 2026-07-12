import type { Metadata } from 'next'
import { StaticPageShell } from '@/components/static-page-shell'
import { createDbClient } from '@/lib/db'
import { ContactForm } from './contact-form'

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Get in touch with HadIdea — feedback, questions, complaints, billing, or partnerships.',
}

async function getPrefill(): Promise<{ name: string; email: string }> {
  const supabase = await createDbClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { name: '', email: '' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, username')
    .eq('id', user.id)
    .single()

  return {
    name: profile?.display_name ?? profile?.username ?? '',
    email: user.email ?? '',
  }
}

const PRESELECTABLE = ['feedback', 'complaint', 'question', 'billing', 'partnership'] as const
type Preselectable = (typeof PRESELECTABLE)[number]

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>
}) {
  const prefill = await getPrefill()

  // ?category=billing preselects the reason — used by /support, the FAQ, and
  // (payments build) order-confirmation emails. Unknown values fall back to
  // the form's own default.
  const { category } = await searchParams
  const defaultCategory = PRESELECTABLE.includes(category as Preselectable)
    ? (category as Preselectable)
    : undefined

  return (
    <StaticPageShell
      title="Contact us"
      intro="Feedback, questions, complaints, billing & refunds, or partnership enquiries — we read everything."
    >
      <ContactForm defaultName={prefill.name} defaultEmail={prefill.email} defaultCategory={defaultCategory} />
    </StaticPageShell>
  )
}
