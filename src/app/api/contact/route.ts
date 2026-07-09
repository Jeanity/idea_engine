import { createDbClient } from '@/lib/db'
import { logError } from '@/lib/log-error'
import { buildEmail, sendMail } from '@/lib/mailer'
import { NextResponse, type NextRequest } from 'next/server'
import type { ContactCategory } from '@/lib/database.types'

const VALID_CATEGORIES: ContactCategory[] = ['feedback', 'complaint', 'question', 'partnership']
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Postgres 42P01 = undefined_table (the error code when a query somehow hits
// Postgres directly), and PostgREST's PGRST205 = "table not found in schema
// cache" (what Supabase's REST layer actually returns in practice, verified
// live against a database where migration 012 hadn't been run yet) — both
// mean the same thing here: migration 012 hasn't been run.
function isMissingTable(error: { code?: string } | null | undefined): boolean {
  return error?.code === '42P01' || error?.code === 'PGRST205'
}

// Public contact form submission. Uses the per-request client (respects RLS)
// rather than the service client — the "contact_submissions: public insert"
// policy from migration 012 is what actually authorises this write, not app
// code. Signed-in submitters get user_id attached automatically via auth.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))

  // Honeypot: a hidden field real users never fill. Any value here means a
  // bot — return a fake success so it doesn't learn to adapt, but skip the
  // insert entirely.
  if (typeof body.website === 'string' && body.website.trim() !== '') {
    return NextResponse.json({ ok: true })
  }

  const category = typeof body.category === 'string' ? body.category : ''
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim() : ''
  const message = typeof body.message === 'string' ? body.message.trim() : ''

  if (!VALID_CATEGORIES.includes(category as ContactCategory)) {
    return NextResponse.json({ error: 'Please choose a valid category.' }, { status: 400 })
  }
  if (!name || name.length > 200) {
    return NextResponse.json({ error: 'Name is required (max 200 characters).' }, { status: 400 })
  }
  if (!email || email.length > 200 || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 })
  }
  if (!message || message.length > 5000) {
    return NextResponse.json({ error: 'Message is required (max 5000 characters).' }, { status: 400 })
  }

  const supabase = await createDbClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { error } = await supabase.from('contact_submissions').insert({
    category: category as ContactCategory,
    name,
    email,
    message,
    user_id: user?.id ?? null,
  })

  if (error) {
    if (isMissingTable(error)) {
      return NextResponse.json(
        { error: "Contact form isn't available right now — please try again later." },
        { status: 503 }
      )
    }
    console.error('Error inserting contact submission:', error)
    await logError({
      source: 'api:contact',
      message: `Contact submission failed: ${error.message}`,
      detail: error,
      path: 'POST /api/contact',
      userId: user?.id ?? null,
    })
    return NextResponse.json({ error: 'Something went wrong — please try again.' }, { status: 500 })
  }

  // Fire-and-forget admin notification — never blocks the submitter's response
  // and never throws (sendMail swallows its own failures, logging via
  // logError source 'mailer').
  const adminEmail = process.env.ADMIN_NOTIFY_EMAIL
  if (adminEmail) {
    const isPartnership = category === 'partnership'
    const subjectPrefix = isPartnership ? '[Contact — PARTNERSHIP]' : '[Contact]'
    const { html, text } = buildEmail({
      bodyHtml: `<p><strong>Category:</strong> ${category}</p>
<p><strong>Name:</strong> ${name}</p>
<p><strong>Email:</strong> ${email}</p>
<p><strong>Message:</strong></p>
<p>${message.replace(/\n/g, '<br />')}</p>`,
      bodyText: `Category: ${category}\nName: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
    })
    void sendMail({
      to: adminEmail,
      subject: `${subjectPrefix} ${category}: ${name}`,
      html,
      text,
      replyTo: email,
    })
  }

  return NextResponse.json({ ok: true })
}
