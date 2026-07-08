import { describe, it, expect } from 'vitest'
import { toPublicDisplayName } from '@/lib/public-name'

describe('toPublicDisplayName', () => {
  it('formats a full name as first name + last initial', () => {
    expect(toPublicDisplayName('Jane Doe')).toBe('Jane D.')
  })

  it('uses the last word as the initial for multi-part names', () => {
    expect(toPublicDisplayName('Jane van Doe')).toBe('Jane D.')
  })

  it('leaves a single-word name unchanged', () => {
    expect(toPublicDisplayName('Jane')).toBe('Jane')
  })

  it('trims surrounding whitespace and collapses internal spacing', () => {
    expect(toPublicDisplayName('  Jane   Doe  ')).toBe('Jane D.')
  })

  it('falls back for null/blank names', () => {
    expect(toPublicDisplayName(null)).toBe('Verified founder')
    expect(toPublicDisplayName('   ')).toBe('Verified founder')
    expect(toPublicDisplayName(undefined, 'Anonymous')).toBe('Anonymous')
  })
})
