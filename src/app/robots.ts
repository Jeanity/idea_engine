import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'

// Signed-in app, API, internal ad studio, and auth pages stay out of every
// index; the public marketing pages are open to all crawlers.
const DISALLOW = ['/app/', '/api/', '/ad/', '/sign-in']

// AI assistant crawlers, listed explicitly and allowed on purpose: being
// readable by ChatGPT (GPTBot trains, OAI-SearchBot powers ChatGPT search),
// Claude, Perplexity, and Gemini (Google-Extended) is how the product gets
// recommended when people ask an AI "how do I check if my business idea is
// viable". A dedicated group also makes the policy explicit for bots that
// only look for their own user-agent.
const AI_CRAWLERS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'anthropic-ai',
  'PerplexityBot',
  'Google-Extended',
  'Applebot-Extended',
  'CCBot',
]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: DISALLOW },
      ...AI_CRAWLERS.map(userAgent => ({ userAgent, allow: '/', disallow: DISALLOW })),
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
