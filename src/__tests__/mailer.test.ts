import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { buildEmail, isMailerConfigured, getSiteUrl, sendMail } from '@/lib/mailer'

const SMTP_KEYS = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'MAIL_FROM'] as const

function clearSmtpEnv() {
  for (const key of SMTP_KEYS) delete process.env[key]
}

describe('buildEmail', () => {
  it('wraps the body in the branded shell with the HadIdea wordmark', () => {
    const { html } = buildEmail({ bodyHtml: '<p>hello</p>', bodyText: 'hello' })
    expect(html).toContain('HadIdea')
    expect(html).toContain('<p>hello</p>')
  })

  it('includes the wordmark as a link to the site URL', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://example.com'
    const { html } = buildEmail({ bodyHtml: '<p>test</p>', bodyText: 'test' })
    expect(html).toContain('<a href="https://example.com"')
    expect(html).toContain('HadIdea</a>')
    delete process.env.NEXT_PUBLIC_SITE_URL
  })

  it('includes footer links to site, contact, and privacy', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://example.com'
    const { html } = buildEmail({ bodyHtml: '<p>test</p>', bodyText: 'test' })
    expect(html).toContain('https://example.com')
    expect(html).toContain('https://example.com/contact')
    expect(html).toContain('https://example.com/privacy')
    delete process.env.NEXT_PUBLIC_SITE_URL
  })

  it('includes the team signature line in the footer', () => {
    const { html, text } = buildEmail({ bodyHtml: '<p>x</p>', bodyText: 'x' })
    expect(html).toContain('— The HadIdea team')
    expect(text).toContain('— The HadIdea team')
  })

  it('includes the current year in the copyright line', () => {
    const { html, text } = buildEmail({ bodyHtml: '<p>x</p>', bodyText: 'x' })
    const currentYear = new Date().getFullYear()
    expect(html).toContain(`© ${currentYear} HadIdea`)
    expect(text).toContain(`© ${currentYear}`)
  })

  it('includes the muted footer line in both html and text', () => {
    const { html, text } = buildEmail({ bodyHtml: '<p>x</p>', bodyText: 'x' })
    const footer = "You're receiving this because of activity on your HadIdea account."
    expect(html).toContain(footer)
    expect(text).toContain(footer)
  })

  it('produces a text fallback containing the plain body', () => {
    const { text } = buildEmail({ bodyHtml: '<p>hi <strong>there</strong></p>', bodyText: 'hi there' })
    expect(text).toContain('hi there')
  })

  it('is pure — same input always produces the same output', () => {
    const a = buildEmail({ bodyHtml: '<p>a</p>', bodyText: 'a' })
    const b = buildEmail({ bodyHtml: '<p>a</p>', bodyText: 'a' })
    expect(a).toEqual(b)
  })
})

describe('getSiteUrl', () => {
  const original = process.env.NEXT_PUBLIC_SITE_URL

  afterEach(() => {
    if (original === undefined) delete process.env.NEXT_PUBLIC_SITE_URL
    else process.env.NEXT_PUBLIC_SITE_URL = original
  })

  it('defaults to https://hadidea.com when unset', () => {
    delete process.env.NEXT_PUBLIC_SITE_URL
    expect(getSiteUrl()).toBe('https://hadidea.com')
  })

  it('uses NEXT_PUBLIC_SITE_URL when set', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://staging.example.com'
    expect(getSiteUrl()).toBe('https://staging.example.com')
  })
})

describe('isMailerConfigured', () => {
  const originalEnv: Record<string, string | undefined> = {}

  beforeEach(() => {
    for (const key of SMTP_KEYS) originalEnv[key] = process.env[key]
    clearSmtpEnv()
  })

  afterEach(() => {
    for (const key of SMTP_KEYS) {
      if (originalEnv[key] === undefined) delete process.env[key]
      else process.env[key] = originalEnv[key]
    }
  })

  it('is false when no SMTP env vars are set', () => {
    expect(isMailerConfigured()).toBe(false)
  })

  it('is false when only some SMTP env vars are set (partial config)', () => {
    process.env.SMTP_HOST = 'smtp.ionos.com'
    process.env.SMTP_USER = 'me@example.com'
    // SMTP_PORT, SMTP_PASS, MAIL_FROM intentionally left unset
    expect(isMailerConfigured()).toBe(false)
  })

  it('is false when SMTP_PORT is not a valid number', () => {
    process.env.SMTP_HOST = 'smtp.ionos.com'
    process.env.SMTP_PORT = 'not-a-number'
    process.env.SMTP_USER = 'me@example.com'
    process.env.SMTP_PASS = 'secret'
    process.env.MAIL_FROM = 'HadIdea <reports@hadidea.com>'
    expect(isMailerConfigured()).toBe(false)
  })

  it('is true when every SMTP env var is present and well-formed', () => {
    process.env.SMTP_HOST = 'smtp.ionos.com'
    process.env.SMTP_PORT = '587'
    process.env.SMTP_USER = 'me@example.com'
    process.env.SMTP_PASS = 'secret'
    process.env.MAIL_FROM = 'HadIdea <reports@hadidea.com>'
    expect(isMailerConfigured()).toBe(true)
  })
})

describe('sendMail — no-op guard when unconfigured', () => {
  const originalEnv: Record<string, string | undefined> = {}

  beforeEach(() => {
    for (const key of SMTP_KEYS) originalEnv[key] = process.env[key]
    clearSmtpEnv()
  })

  afterEach(() => {
    for (const key of SMTP_KEYS) {
      if (originalEnv[key] === undefined) delete process.env[key]
      else process.env[key] = originalEnv[key]
    }
    vi.restoreAllMocks()
  })

  it('never throws and resolves { sent: false } when SMTP is unconfigured', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = await sendMail({ to: 'someone@example.com', subject: 'test', html: '<p>x</p>', text: 'x' })
    expect(result).toEqual({ sent: false })
    expect(warnSpy).toHaveBeenCalledTimes(1)
  })
})

describe('buildEmail with custom chrome', () => {
  const chrome = {
    header_title: 'hadidea',
    signature: '— Danny at hadidea',
    footer_note: 'You asked us to email you this report.',
  }

  it('renders the custom header title in the wordmark and © line', () => {
    const { html, text } = buildEmail({ bodyHtml: '<p>x</p>', bodyText: 'x' }, chrome)
    expect(html).toContain('>hadidea</a>')
    expect(html).toMatch(/© \d{4} hadidea/)
    expect(html).not.toContain('HadIdea')
    expect(text.startsWith('hadidea\n')).toBe(true)
  })

  it('renders the custom signature and footer note in both versions', () => {
    const { html, text } = buildEmail({ bodyHtml: '<p>x</p>', bodyText: 'x' }, chrome)
    expect(html).toContain('— Danny at hadidea')
    expect(html).toContain('You asked us to email you this report.')
    expect(text).toContain('— Danny at hadidea')
    expect(text).toContain('You asked us to email you this report.')
  })

  it('omits the signature and footer note lines when empty', () => {
    const { html, text } = buildEmail(
      { bodyHtml: '<p>x</p>', bodyText: 'x' },
      { header_title: 'hadidea', signature: '', footer_note: '' }
    )
    expect(html).not.toContain('— The HadIdea team')
    expect(text).not.toContain('— The HadIdea team')
    expect(html).not.toContain("You're receiving this")
    expect(text).not.toContain("You're receiving this")
  })

  it('HTML-escapes chrome text but leaves the plain-text version raw', () => {
    const { html, text } = buildEmail(
      { bodyHtml: '<p>x</p>', bodyText: 'x' },
      { header_title: 'A & B <Co>', signature: '', footer_note: '' }
    )
    expect(html).toContain('A &amp; B &lt;Co&gt;')
    expect(html).not.toContain('<Co>')
    expect(text).toContain('A & B <Co>')
  })

  it('defaults produce the same output as calling without chrome', () => {
    const a = buildEmail({ bodyHtml: '<p>x</p>', bodyText: 'x' })
    const b = buildEmail({ bodyHtml: '<p>x</p>', bodyText: 'x' }, {
      header_title: 'HadIdea',
      signature: '— The HadIdea team',
      footer_note: "You're receiving this because of activity on your HadIdea account.",
    })
    expect(a).toEqual(b)
  })
})
