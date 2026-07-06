// Shared country list: common markets first, then alphabetical.
// The empty-code row renders as a disabled divider in selects.
export interface Country {
  code: string
  name: string
  currency: string
  symbol: string
}

export const COUNTRIES: Country[] = [
  { code: 'AU', name: 'Australia', currency: 'AUD', symbol: 'A$' },
  { code: 'CA', name: 'Canada', currency: 'CAD', symbol: 'CA$' },
  { code: 'IE', name: 'Ireland', currency: 'EUR', symbol: '€' },
  { code: 'IN', name: 'India', currency: 'INR', symbol: '₹' },
  { code: 'NZ', name: 'New Zealand', currency: 'NZD', symbol: 'NZ$' },
  { code: 'SG', name: 'Singapore', currency: 'SGD', symbol: 'S$' },
  { code: 'ZA', name: 'South Africa', currency: 'ZAR', symbol: 'R' },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP', symbol: '£' },
  { code: 'US', name: 'United States', currency: 'USD', symbol: '$' },
  { code: '', name: '─────────────', currency: '', symbol: '' },
  { code: 'AR', name: 'Argentina', currency: 'ARS', symbol: 'AR$' },
  { code: 'BR', name: 'Brazil', currency: 'BRL', symbol: 'R$' },
  { code: 'CN', name: 'China', currency: 'CNY', symbol: '¥' },
  { code: 'DE', name: 'Germany', currency: 'EUR', symbol: '€' },
  { code: 'EG', name: 'Egypt', currency: 'EGP', symbol: 'E£' },
  { code: 'ES', name: 'Spain', currency: 'EUR', symbol: '€' },
  { code: 'FR', name: 'France', currency: 'EUR', symbol: '€' },
  { code: 'GH', name: 'Ghana', currency: 'GHS', symbol: 'GH₵' },
  { code: 'ID', name: 'Indonesia', currency: 'IDR', symbol: 'Rp' },
  { code: 'IT', name: 'Italy', currency: 'EUR', symbol: '€' },
  { code: 'JP', name: 'Japan', currency: 'JPY', symbol: '¥' },
  { code: 'KE', name: 'Kenya', currency: 'KES', symbol: 'KSh' },
  { code: 'KR', name: 'South Korea', currency: 'KRW', symbol: '₩' },
  { code: 'MX', name: 'Mexico', currency: 'MXN', symbol: 'MX$' },
  { code: 'MY', name: 'Malaysia', currency: 'MYR', symbol: 'RM' },
  { code: 'NG', name: 'Nigeria', currency: 'NGN', symbol: '₦' },
  { code: 'NL', name: 'Netherlands', currency: 'EUR', symbol: '€' },
  { code: 'NO', name: 'Norway', currency: 'NOK', symbol: 'kr' },
  { code: 'NP', name: 'Nepal', currency: 'NPR', symbol: 'Rs' },
  { code: 'PH', name: 'Philippines', currency: 'PHP', symbol: '₱' },
  { code: 'PK', name: 'Pakistan', currency: 'PKR', symbol: 'Rs' },
  { code: 'PL', name: 'Poland', currency: 'PLN', symbol: 'zł' },
  { code: 'PT', name: 'Portugal', currency: 'EUR', symbol: '€' },
  { code: 'RU', name: 'Russia', currency: 'RUB', symbol: '₽' },
  { code: 'SE', name: 'Sweden', currency: 'SEK', symbol: 'kr' },
  { code: 'TH', name: 'Thailand', currency: 'THB', symbol: '฿' },
  { code: 'TR', name: 'Turkey', currency: 'TRY', symbol: '₺' },
  { code: 'TZ', name: 'Tanzania', currency: 'TZS', symbol: 'TSh' },
  { code: 'UA', name: 'Ukraine', currency: 'UAH', symbol: '₴' },
  { code: 'UG', name: 'Uganda', currency: 'UGX', symbol: 'USh' },
  { code: 'VN', name: 'Vietnam', currency: 'VND', symbol: '₫' },
  { code: 'ZW', name: 'Zimbabwe', currency: 'USD', symbol: '$' },
]

/** Currency code for a 2-letter country code; USD when unknown. */
export function currencyForCountry(countryCode: string | null | undefined): string {
  const c = COUNTRIES.find(c => c.code === (countryCode ?? '').toUpperCase())
  return c?.currency || 'USD'
}

/** Display symbol for a 2-letter country code; '$' when unknown. */
export function symbolForCountry(countryCode: string | null | undefined): string {
  const c = COUNTRIES.find(c => c.code === (countryCode ?? '').toUpperCase())
  return c?.symbol || '$'
}

/** Display symbol for a 3-letter currency code (e.g. report sections store the currency); falls back to the code itself. */
export function symbolForCurrency(currency: string | null | undefined): string {
  if (!currency) return '$'
  const c = COUNTRIES.find(c => c.currency === currency.toUpperCase())
  return c?.symbol || currency
}
