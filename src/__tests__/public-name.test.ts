import { describe, it, expect } from 'vitest'
import { toPublicDisplayName } from '@/lib/public-name'

describe('toPublicDisplayName', () => {
  it('prefers username over display_name', () => {
    expect(toPublicDisplayName('jdoe', 'Jane Doe')).toBe('jdoe')
  })

  it('falls back to display_name (first name + last initial) when username is absent', () => {
    expect(toPublicDisplayName(null, 'Jane Doe')).toBe('Jane D.')
    expect(toPublicDisplayName(undefined, 'Jane Doe')).toBe('Jane D.')
    expect(toPublicDisplayName('  ', 'Jane Doe')).toBe('Jane D.')
  })

  it('uses the last word as the initial for multi-part names', () => {
    expect(toPublicDisplayName(null, 'Jane van Doe')).toBe('Jane D.')
  })

  it('leaves a single-word display name unchanged', () => {
    expect(toPublicDisplayName(null, 'Jane')).toBe('Jane')
  })

  it('trims surrounding whitespace and collapses internal spacing', () => {
    expect(toPublicDisplayName(null, '  Jane   Doe  ')).toBe('Jane D.')
  })

  it('falls back for null/blank username and display name', () => {
    expect(toPublicDisplayName(null, null)).toBe('Verified founder')
    expect(toPublicDisplayName('   ', '   ')).toBe('Verified founder')
    expect(toPublicDisplayName(undefined, undefined, 'Anonymous')).toBe('Anonymous')
  })
})
