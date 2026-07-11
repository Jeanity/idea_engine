import type { Slide } from '../slide-kit'
import { FREE_LAUNCH } from './free-launch'
import { LAUNCH_DEAL } from './launch-deal'
import { EVERGREEN_COMPETITORS } from './evergreen-competitors'
import { EVERGREEN_VALIDATION } from './evergreen-validation'

export interface Campaign {
  name: string
  purpose: string
  slides: Slide[]
}

/** Slug → campaign. Slugs are the /ad/<slug>/<n> URL segments — changing one
 *  breaks any bookmarked capture URLs, so treat them as stable. */
export const CAMPAIGNS: Record<string, Campaign> = {
  'free-launch': FREE_LAUNCH,
  'launch-deal': LAUNCH_DEAL,
  'evergreen-competitors': EVERGREEN_COMPETITORS,
  'evergreen-validation': EVERGREEN_VALIDATION,
}
