export const ALL_MAPS_TO_KEYS = [
  'idea.sales_channel','idea.time_commitment','idea.stage',
  'market.target_customer','market.differentiator','market.service_area_scope',
  'market.geographic_scope',
  'cost.production_location','cost.materials','cost.equipment_owned',
  'cost.equipment_wattage','cost.active_minutes_per_batch','cost.passive_minutes_per_batch',
  'cost.batch_yield','cost.hourly_rate','cost.packaging_per_unit',
  'cost.unit_cost_estimate','cost.fulfilment_model','cost.startup_capital',
  'price.model','price.target_price','price.take_rate_pct',
  'monetisation.primary_channel','monetisation.secondary_channel','monetisation.free_tier_shape',
  'resource.tech_capability','resource.existing_content','resource.audience_size',
  'ip.category','ip.status','ip.target_market',
  'fallback.problem','fallback.customer','fallback.money_model',
  'founder.success_definition','founder.location_country','founder.location_region',
] as const

export type MapsToKey = typeof ALL_MAPS_TO_KEYS[number]

export interface Question {
  key: string
  text: string
  subtext?: string | null
  // 'country' renders a native country dropdown and stores the 2-letter code;
  // it is only used by route-injected questions, never by dynamic generation.
  input_type: 'text' | 'select' | 'number' | 'multiselect' | 'country'
  options?: string[]
  required: boolean
  maps_to: string
}

export function validateQuestion(
  q: unknown,
  usedKeys: string[],
  usedMapsto: string[]
): Question | null {
  if (!q || typeof q !== 'object') return null
  const obj = q as Record<string, unknown>
  if (typeof obj.key !== 'string' || !/^[a-z][a-z0-9_]{0,79}$/.test(obj.key)) return null
  if (usedKeys.includes(obj.key)) return null
  if (typeof obj.text !== 'string' || obj.text.length < 6) return null
  if (!['text', 'select', 'number', 'multiselect'].includes(obj.input_type as string)) return null
  if (['select', 'multiselect'].includes(obj.input_type as string)) {
    if (!Array.isArray(obj.options) || obj.options.length < 2) return null
  }
  if (typeof obj.maps_to !== 'string') return null
  if (!(ALL_MAPS_TO_KEYS as readonly string[]).includes(obj.maps_to)) return null
  if (usedMapsto.includes(obj.maps_to)) return null
  return { ...(obj as unknown as Question), required: false }
}

export function firstUnansweredIndex(questions: Question[], answeredKeys: Set<string>): number {
  const idx = questions.findIndex(q => !answeredKeys.has(q.key))
  return idx === -1 ? Math.max(0, questions.length - 1) : idx
}
