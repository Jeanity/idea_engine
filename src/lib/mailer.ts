import nodemailer, { type Transporter } from 'nodemailer'
import { logError } from '@/lib/log-error'

export interface SendMailInput {
  to: string
  subject: string
  /** Inner content HTML — gets wrapped in the branded shell by buildEmail(). */
  html: string
  /** Plain-text fallback for the same content — every send must have one. */
  text: string
  /** Lets a reply land in Danny's inbox directly (e.g. the submitter's address). */
  replyTo?: string
}

export interface SendMailResult {
  sent: boolean
}

interface MailerEnv {
  host: string
  port: number
  user: string
  pass: string
  from: string
}

// All five must be set or we treat mail as unconfigured — a partial config
// (e.g. host+user but no pass) is just as broken as none, so it gets the same
// no-op treatment rather than a confusing runtime auth failure.
function readMailerEnv(): MailerEnv | null {
  const host = process.env.SMTP_HOST
  const portRaw = process.env.SMTP_PORT
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  const from = process.env.MAIL_FROM
  if (!host || !portRaw || !user || !pass || !from) return null
  const port = Number(portRaw)
  if (!Number.isFinite(port)) return null
  return { host, port, user, pass, from }
}

/** True when every SMTP env var is present and well-formed. */
export function isMailerConfigured(): boolean {
  return readMailerEnv() !== null
}

/** Base URL for links inside emails — never hardcode hadidea.com inline in a template. */
export function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || 'https://hadidea.com'
}

const FOOTER_TEXT = "You're receiving this because of activity on your Idea Engine account."

/**
 * Pure — wraps a content block in the branded Idea Engine shell (wordmark +
 * content + muted footer) and produces the matching text fallback. Table-free
 * HTML so it renders consistently across mail clients. Exported standalone so
 * it can be unit-tested without touching SMTP.
 */
export function buildEmail(input: { bodyHtml: string; bodyText: string }): { html: string; text: string } {
  const html = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; background: #f8fafc; padding: 32px 24px;">
  <div style="font-size: 18px; font-weight: 700; color: #0f172a; margin-bottom: 24px;">Idea Engine</div>
  <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; color: #1e293b; font-size: 15px; line-height: 1.6;">
    ${input.bodyHtml}
  </div>
  <div style="color: #94a3b8; font-size: 12px; margin-top: 24px; line-height: 1.5;">
    ${FOOTER_TEXT}
  </div>
</div>`

  const text = `Idea Engine\n\n${input.bodyText}\n\n---\n${FOOTER_TEXT}`

  return { html, text }
}

let cachedTransport: Transporter | null = null
let cachedTransportKey: string | null = null

function getTransport(env: MailerEnv): Transporter {
  // Cache key covers every field that changes what the transport connects
  // as — cheap guard against a stale transport after env vars change (e.g.
  // between test runs or a hot-reloaded dev server).
  const key = `${env.host}:${env.port}:${env.user}`
  if (cachedTransport && cachedTransportKey === key) return cachedTransport
  cachedTransport = nodemailer.createTransport({
    host: env.host,
    port: env.port,
    secure: env.port === 465,
    auth: { user: env.user, pass: env.pass },
  })
  cachedTransportKey = key
  return cachedTransport
}

/**
 * Sends one email. If SMTP isn't configured, logs a single console.warn and
 * resolves { sent: false } — never throws, never blocks. Every failure path
 * is swallowed and reported via logError(source: 'mailer') so callers can
 * safely `void sendMail(...)` (fire-and-forget) or `await` it without a
 * try/catch of their own.
 */
export async function sendMail(input: SendMailInput): Promise<SendMailResult> {
  const env = readMailerEnv()
  if (!env) {
    console.warn(`[mailer] SMTP not configured — skipping email "${input.subject}" to ${input.to}`)
    return { sent: false }
  }

  try {
    const transport = getTransport(env)
    await transport.sendMail({
      from: env.from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      replyTo: input.replyTo,
    })
    return { sent: true }
  } catch (err) {
    await logError({
      source: 'mailer',
      message: `sendMail failed: ${input.subject}`,
      detail: err,
      path: input.to,
    })
    return { sent: false }
  }
}
