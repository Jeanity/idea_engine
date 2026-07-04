// Deterministic cost calculator for physical_product archetype.
// All values derived from wizard answers via maps_to keys.

const ELECTRICITY_RATES_PER_KWH: Record<string, number> = {
  AU: 0.30, NZ: 0.30,
  US: 0.15, CA: 0.12,
  GB: 0.35, IE: 0.40,
  DE: 0.38, FR: 0.22,
}

const CURRENCIES: Record<string, string> = {
  AU: 'AUD', NZ: 'NZD',
  US: 'USD', CA: 'CAD',
  GB: 'GBP', IE: 'EUR',
  DE: 'EUR', FR: 'EUR',
}

function kwh(country: string): number {
  return ELECTRICITY_RATES_PER_KWH[country] ?? 0.20
}

export function currencyFor(country: string): string {
  return CURRENCIES[country] ?? 'USD'
}

export interface CostInputs {
  location_country: string
  // maps_to answers — all optional since wizard answers may be incomplete
  materials_batch_cost?: number | null         // cost.materials
  packaging_per_unit?: number | null           // cost.packaging_per_unit
  equipment_wattage?: number | null            // cost.equipment_wattage
  active_minutes_per_batch?: number | null     // cost.active_minutes_per_batch
  passive_minutes_per_batch?: number | null    // cost.passive_minutes_per_batch
  batch_yield?: number | null                  // cost.batch_yield
  hourly_rate?: number | null                  // cost.hourly_rate
  unit_cost_estimate?: number | null           // cost.unit_cost_estimate (fallback)
}

export interface CostResult {
  per_unit: {
    materials: number | null
    packaging: number | null
    power: number | null
    active_labour: number | null
    passive_labour: number | null
    total_cogs: number | null
  }
  suggested_price: number | null
  gross_margin_pct: number | null
  currency: string
  notes: string
  estimation_flags: Record<string, 'user_provided' | 'estimated' | 'not_applicable'>
}

export function calculateCosts(inputs: CostInputs): CostResult {
  const currency = currencyFor(inputs.location_country)
  const kwhRate = kwh(inputs.location_country)
  const yield_ = inputs.batch_yield ?? null
  const notes: string[] = []
  const flags: CostResult['estimation_flags'] = {}

  // Materials per unit
  let materials: number | null = null
  if (inputs.materials_batch_cost != null && yield_) {
    materials = round2(inputs.materials_batch_cost / yield_)
    flags.materials = 'user_provided'
  } else if (inputs.unit_cost_estimate != null) {
    materials = inputs.unit_cost_estimate
    flags.materials = 'estimated'
    notes.push('Using unit cost estimate as materials proxy.')
  } else {
    flags.materials = 'estimated'
    notes.push('Materials cost not provided — omitted from total.')
  }

  // Packaging
  let packaging: number | null = null
  if (inputs.packaging_per_unit != null) {
    packaging = round2(inputs.packaging_per_unit)
    flags.packaging = 'user_provided'
  } else {
    flags.packaging = 'estimated'
    notes.push('Packaging cost not provided.')
  }

  // Power: (watts/1000) × (passive_mins/60) × rate / yield
  let power: number | null = null
  if (inputs.equipment_wattage != null && inputs.passive_minutes_per_batch != null && yield_) {
    power = round2((inputs.equipment_wattage / 1000) * (inputs.passive_minutes_per_batch / 60) * kwhRate / yield_)
    flags.power = 'user_provided'
    notes.push(`Power cost uses ${currency === 'AUD' ? 'AUD' : ''} $${kwhRate}/kWh (${inputs.location_country} average).`)
  } else {
    power = null
    flags.power = 'not_applicable'
  }

  // Active labour: (active_mins/60) × rate / yield
  let active_labour: number | null = null
  if (inputs.active_minutes_per_batch != null && inputs.hourly_rate != null && yield_) {
    active_labour = round2((inputs.active_minutes_per_batch / 60) * inputs.hourly_rate / yield_)
    flags.active_labour = 'user_provided'
  } else {
    flags.active_labour = 'not_applicable'
  }

  // Passive labour (machine-on time — tracked separately, may not deserve full rate)
  let passive_labour: number | null = null
  if (inputs.passive_minutes_per_batch != null && inputs.hourly_rate != null && yield_) {
    passive_labour = round2((inputs.passive_minutes_per_batch / 60) * inputs.hourly_rate / yield_)
    flags.passive_labour = 'user_provided'
    notes.push('Active and passive labour shown separately — passive time is machine-on time where other tasks are possible.')
  } else {
    flags.passive_labour = 'not_applicable'
  }

  // Total COGS
  const components = [materials, packaging, power, active_labour, passive_labour].filter((v): v is number => v !== null)
  const total_cogs = components.length > 0 ? round2(components.reduce((a, b) => a + b, 0)) : null

  // Suggested price: 3× COGS (standard retail markup) or 4× for market/online
  const suggested_price = total_cogs != null ? round2(total_cogs * 3.5) : null
  const gross_margin_pct = total_cogs != null && suggested_price != null
    ? round2((1 - total_cogs / suggested_price) * 100)
    : null

  return {
    per_unit: { materials, packaging, power, active_labour, passive_labour, total_cogs },
    suggested_price,
    gross_margin_pct,
    currency,
    notes: notes.join(' ') || 'All figures calculated from user inputs.',
    estimation_flags: flags,
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function parseNumber(s: string | undefined | null): number | null {
  if (!s) return null
  const n = parseFloat(s.replace(/[^0-9.-]/g, ''))
  return isNaN(n) ? null : n
}
