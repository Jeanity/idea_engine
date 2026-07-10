import type { Metadata } from 'next'
import { StaticPageShell } from '@/components/static-page-shell'
import { createDbClient } from '@/lib/db'
import { ContactForm } from './contact-form'

export const metadata: Metadata = {
  title: 'Contact — Idea Engine',
  description: 'Get in touch — feedback, questions, complaints, billing, or partnerships.',
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

export default async function ContactPage() {
  const prefill = await getPrefill()

  return (
    <StaticPageShell
      title="Contact us"
      intro="Feedback, questions, complaints, billing & refunds, or partnership enquiries — we read everything."
    >
      <ContactForm defaultName={prefill.name} defaultEmail={prefill.email} />
    </StaticPageShell>
  )
}
