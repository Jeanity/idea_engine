import { describe, it, expect } from 'vitest'
import { splitCiteSegments, hasCiteMarkers, stripCiteMarkers } from '@/lib/cite'

describe('cite markers', () => {
  it('splits a well-formed <cite> span (Sonnet style)', () => {
    expect(splitCiteSegments('before <cite index="5-30,5-31">quoted text</cite> after')).toEqual([
      { text: 'before ', cited: false },
      { text: 'quoted text', cited: true },
      { text: ' after', cited: false },
    ])
  })

  it('handles Haiku-mangled <ancite>…</anite> variants (live incident 2026-07-08)', () => {
    expect(splitCiteSegments('problem: <ancite index="3-24">women aged 18-34 account for 60%</anite> of activity')).toEqual([
      { text: 'problem: ', cited: false },
      { text: 'women aged 18-34 account for 60%', cited: true },
      { text: ' of activity', cited: false },
    ])
  })

  it('strips stray/unbalanced close tags instead of rendering them', () => {
    expect(splitCiteSegments('58% conversion rates</anite> prove the target')).toEqual([
      { text: '58% conversion rates prove the target', cited: false },
    ])
  })

  it('passes plain strings through untouched', () => {
    expect(splitCiteSegments('no markers here')).toEqual([{ text: 'no markers here', cited: false }])
    expect(hasCiteMarkers('no markers here')).toBe(false)
  })

  it('detects any variant', () => {
    expect(hasCiteMarkers('a <cite index="1-2">b</cite>')).toBe(true)
    expect(hasCiteMarkers('a <ancite index="1-2">b</anite>')).toBe(true)
    expect(hasCiteMarkers('stray close</anite> only')).toBe(true)
  })

  it('stripCiteMarkers removes every variant, keeps quoted text', () => {
    expect(stripCiteMarkers('a <ancite index="15-2">b</anite> c <cite index="1-1">d</cite></anite>')).toBe('a b c d')
  })
})
