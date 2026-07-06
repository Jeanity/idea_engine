// The public sample report — shown to potential customers at /sample-report.
//
// EVERYTHING here is example content, hand-curated to match the exact section
// schemas the real pipeline produces (see docs/REPORT_SPEC lineage in
// generate-report.ts). Competitor names are fictional. All URLs are '#' by
// design: the sample page disables links and says so — a public page must
// never carry fabricated or link-rotted URLs.
//
// Voice rules apply here doubly (persona.ts): facts not verdicts, no
// discouragement, no AI-isms.

export const SAMPLE_IDEA = {
  restatement:
    'A mobile specialty coffee van serving weekend markets, sports fields, and local events — Sydney, Australia.',
  archetype: 'local_service',
}

export const SAMPLE_REPORT_SECTIONS: Record<string, unknown> = {
  summary: {
    text:
      'A coffee van in Sydney enters a crowded market — and that is not the problem it first appears to be. Cafés cluster around weekday foot traffic, which leaves early-morning weekend venues (junior sport, parkruns, markets before 8am) consistently underserved. The economics of mobile coffee are strong: roughly $1.55 in per-cup costs against a $5.50 Sydney flat white, with most of the risk sitting in site access rather than demand. The venues you can lock in — not the coffee itself — will decide whether this runs at a weekend-hobby scale or replaces a salary.',
  },

  viability_snapshot: {
    scores: {
      market_opportunity: {
        score: 4,
        rationale:
          'Sydney weekend sport and market foot traffic is large and recurring; the gap is time-and-place, not demand.',
      },
      execution_difficulty: {
        score: 3,
        rationale:
          'Coffee craft is learnable in weeks; the real work is winning and keeping 2–3 recurring site agreements.',
      },
      capital_required: {
        score: 3,
        rationale:
          'A fitted van runs $20k–$45k, but a cart-first pilot cuts entry to under $10k while sites are proven.',
      },
      time_to_revenue: {
        score: 2,
        rationale:
          'Once the food business registration and first site agreement are in place, revenue starts the following weekend.',
      },
    },
    overall_verdict:
      'This idea works if you treat it as a site-acquisition business that happens to sell coffee. Demand and margins are proven; the operators who struggle are the ones who bought the van before securing anywhere to park it. Pilot with a cart at one venue, prove the numbers, then scale into the van with revenue behind you.',
  },

  competitors: [
    {
      name: 'Bean There Espresso Van',
      url: '#',
      location: 'Inner West Sydney',
      pricing_summary: 'Flat white $5.00–$5.50; batch brew $4.00; event minimums ~$450',
      positioning_angle:
        'Established weekend-market van with a loyal following at two inner-west markets; strong Instagram presence.',
      gap_notes:
        'Booked out most weekends and turns down small sports clubs — exactly the venues left open for a new operator.',
    },
    {
      name: 'The Third Wave Cart Co.',
      url: '#',
      location: 'Sydney CBD / event hire',
      pricing_summary: 'Corporate event packages from $600 half-day; per-cup $5.50–$6.50',
      positioning_angle:
        'Premium cart hire aimed at corporate functions and weddings; polished branding, higher price point.',
      gap_notes:
        'No recurring public-venue presence — they chase one-off events, leaving weekly community sites uncontested.',
    },
    {
      name: 'Grindhouse Coffee (fixed café benchmark)',
      url: '#',
      location: 'Suburban Sydney (typical of café clusters)',
      pricing_summary: 'Flat white $5.20; opens 7am weekends',
      positioning_angle:
        'Quality suburban café — the default alternative your customers compare you against.',
      gap_notes:
        'Opens after junior sport starts and is a drive from playing fields — mobile wins on place and time, not on beans.',
    },
    {
      name: 'Kiosk & Canteen operators',
      url: '#',
      location: 'Sports grounds, Sydney-wide',
      pricing_summary: 'Instant coffee $2–$3 via volunteer-run canteens',
      positioning_angle: 'Cheap, convenient, already on-site at many grounds.',
      gap_notes:
        'Instant coffee from an urn is the incumbent at most grounds — a specialty van beside it converts parents at $5+ without hurting canteen sales, which makes club committees receptive.',
    },
    {
      name: 'Velo Espresso (e-bike cart)',
      url: '#',
      location: 'Eastern beaches, Sydney',
      pricing_summary: 'Flat white $5.50; cash-free only',
      positioning_angle:
        'Ultra-low-overhead e-bike cart working beach paths and parkruns; proof the cart-first model earns.',
      gap_notes:
        'Limited capacity (~60 cups/session) and fair-weather only — shows the ceiling of cart-scale and why the van upgrade path exists.',
    },
    {
      name: 'National chain drive-throughs',
      url: '#',
      location: 'Sydney-wide',
      pricing_summary: 'Flat white $4.50–$5.00; loyalty app discounts',
      positioning_angle: 'Speed and consistency for commuters; heavy brand recognition.',
      gap_notes:
        'Anchored to weekday commuter corridors — no presence at the weekend community venues this idea targets.',
    },
  ],

  cost_breakdown: {
    currency: 'AUD',
    per_unit: {
      materials: 1.0,
      packaging: 0.38,
      power: 0.09,
      active_labour: null,
      passive_labour: null,
      total_cogs: 1.47,
    },
    suggested_price: 5.5,
    gross_margin_pct: 73.3,
    notes:
      'Per-cup figures assume a double-shot flat white: specialty beans at wholesale (~$0.55/shot pair), milk (~$0.45), cup/lid/tray (~$0.38), and LPG/battery draw (~$0.09). Labour is deliberately excluded from per-cup COGS for an owner-operator — your wage is the margin. At 150 cups on a weekend day, gross profit is roughly $600/day before site fees. All figures are AI estimates to validate against your own supplier quotes.',
    estimation_flags: {
      materials: 'estimated',
      packaging: 'estimated',
      power: 'estimated',
      active_labour: 'not_applicable',
      passive_labour: 'not_applicable',
    },
    startup_costs: [
      {
        item: 'Fitted coffee van (secondhand) OR cart-first pilot',
        estimate_low: 8000,
        estimate_high: 45000,
        note:
          'The single biggest decision. A proven secondhand fitted van runs $20k–$45k; a quality cart pilot (espresso machine, grinder, benching) enters at $8k–$12k and most of the equipment carries over to the van later.',
      },
      {
        item: 'Espresso machine + grinder (if not included in fitout)',
        estimate_low: 4000,
        estimate_high: 9500,
        note: 'Dual-boiler machine capable of 100+ cups/session; buy refurbished from a roaster with a service contract.',
      },
      {
        item: 'Council + food registration, insurances',
        estimate_low: 1200,
        estimate_high: 3000,
        note: 'Food business registration, mobile vending approvals (varies by council), public liability ($10–20M cover — most venues require the certificate before you trade).',
      },
      {
        item: 'Branding, wrap/signage, menus',
        estimate_low: 800,
        estimate_high: 4000,
        note: 'A memorable name and wrap is your only ad at 60km/h; skimping here is a false economy once the van exists.',
      },
      {
        item: 'Opening stock + POS',
        estimate_low: 700,
        estimate_high: 1500,
        note: 'Beans, milk, cups, syrups for the first month plus a tap-to-pay terminal — weekend venues are near-cashless.',
      },
    ],
    ongoing_costs: [
      { item: 'Site fees / market stall rents', estimate_monthly: 600, note: 'Typically $60–$120 per market day or 10% of takings; sports clubs often trade site access for a canteen donation.' },
      { item: 'Insurance (public liability + vehicle)', estimate_monthly: 180, note: 'Certificate of currency requested by nearly every venue.' },
      { item: 'Fuel + LPG', estimate_monthly: 260, note: 'Assumes 2–3 sites per weekend within a 25km radius.' },
      { item: 'Machine servicing + water filters', estimate_monthly: 120, note: 'Non-negotiable — a machine failure mid-market is a zero-revenue day.' },
      { item: 'Phone, POS fees, booking tools', estimate_monthly: 90, note: 'POS transaction fees ~1.6% are the biggest slice at volume.' },
    ],
  },

  pricing_recommendation: {
    model: 'Per-cup retail + event minimums',
    suggested_price_or_range: '$5.00–$5.50 per flat white; event bookings from $500 half-day minimum',
    rationale:
      'Sydney weekend buyers do not blink at $5.50 from a specialty van — pricing under the local café benchmark ($5.20 in the suburbs) buys you nothing at a venue where you are the only specialty option. The margin lever is add-ons: batch brew for volume, $1 syrups, and pastries from a local bakery at keystone markup.',
    comparable_market_rates:
      'Fictional-but-typical Sydney comparables above cluster at $5.00–$6.50 per cup; corporate cart hire runs $600+ per half-day.',
  },

  funding_options: [
    {
      name: 'Self-Employment Assistance (Workforce Australia)',
      type: 'grant',
      jurisdiction: 'Federal, Australia',
      summary:
        'Federal program offering small business training, business plan support, and up to 12 months of allowance while you establish — designed exactly for first-time operators leaving employment.',
      eligibility: 'Australian resident, not currently in full-time study, business must be assessed as viable and new.',
      url: '#',
      fit_note: 'Bridges personal income during the cart-pilot months so revenue can be reinvested into the van.',
    },
    {
      name: 'Equipment finance (chattel mortgage)',
      type: 'loan',
      jurisdiction: 'Australia — major banks and equipment lenders',
      summary:
        'Standard vehicle/equipment lending secured against the van and machine; preserves cash for stock and site fees rather than sinking savings into the vehicle.',
      eligibility: 'ABN holders; new businesses typically need a deposit (10–20%) or director guarantee.',
      url: '#',
      fit_note: 'Turns the $20k–$45k van decision into ~$450–$900/month once the pilot has proven weekend revenue.',
    },
    {
      name: 'Staged approach: cart-first pilot',
      type: 'staged_approach',
      jurisdiction: '—',
      summary:
        'Not a funding program — a way to need less funding. Enter at under $10k with a cart at one committed venue; the espresso machine, grinder, and registrations all carry over to the van.',
      eligibility: 'Requires one venue agreement and a tow-capable or van-loadable cart setup.',
      url: '#',
      fit_note: 'Cuts the capital gap by ~75% and generates the trading history lenders ask a new business for.',
    },
  ],

  legal_compliance: [
    {
      item: 'Food business registration + council mobile vending approval',
      jurisdiction: 'NSW, Australia (varies by local council)',
      severity: 'required',
      official_source_url: '#',
      summary:
        'Mobile food vendors register the food business and hold approval for each council area they trade in; many Sydney councils also require a mobile vending permit per location.',
    },
    {
      item: 'Food Safety Supervisor certificate',
      jurisdiction: 'NSW, Australia',
      severity: 'required',
      official_source_url: '#',
      summary: 'At least one certified Food Safety Supervisor must be associated with the business; the certificate is a short accredited course.',
    },
    {
      item: 'ABN registration (and GST if turnover exceeds $75k)',
      jurisdiction: 'Federal, Australia',
      severity: 'required',
      official_source_url: '#',
      summary: 'Free to obtain; GST registration becomes mandatory once projected turnover passes $75,000 — a 150-cup weekend pace crosses that line.',
    },
    {
      item: 'Public liability insurance ($10–20M)',
      jurisdiction: 'Australia — venue/market requirement',
      severity: 'recommended',
      official_source_url: '#',
      summary: 'Not legislated, but effectively mandatory: markets, councils, and sports clubs request a certificate of currency before you set up.',
    },
    {
      item: 'Mobile food vehicle construction standards',
      jurisdiction: 'NSW, Australia',
      severity: 'recommended',
      official_source_url: '#',
      summary: 'Van fitouts must meet food-transport vehicle standards (surfaces, water, waste) — verify before buying a secondhand fitout, not after.',
    },
  ],

  risks: [
    {
      title: 'Site access decides everything',
      description:
        'The Sydney coffee-van field is competitive for the best pitches: established operators hold multi-year relationships with the strongest markets, and premium venues charge accordingly.',
      mitigation:
        'Target venues incumbents ignore — junior sport, parkruns, trade yards at dawn. Get two recurring agreements in writing before committing to the van.',
    },
    {
      title: 'Winter and weather revenue dips',
      description:
        'Outdoor-venue revenue drops in sustained rain, and some markets pause in winter — annual revenue is not weekly revenue × 52.',
      mitigation:
        'Book indoor/corporate work for the winter calendar, and model the year at 40 trading weekends, not 52.',
    },
    {
      title: 'One machine, one van — single points of failure',
      description:
        'A machine fault or a van breakdown on a Saturday morning is a zero-revenue day plus a reputation cost at a venue you fought to win.',
      mitigation:
        'Service contract with a same-week response, a backup battery/gas plan, and a portable pour-over kit that keeps *something* selling while the machine is down.',
    },
    {
      title: 'Owner-operator hours are the real price',
      description:
        'The margin looks strong because your labour is unpaid: 4:30am starts, weekend-long shifts, and midweek restocking are the actual cost of the $600 gross days.',
      mitigation:
        'Decide the hours budget up front and price events (not per-cup trade) as the growth lever — one $600 corporate booking equals a full market day without the 10-hour shift.',
    },
  ],

  next_steps: [
    {
      action: 'Work three weekend shifts on an existing van or market cart',
      timeframe: 'Week 1–2',
      rationale: 'The fastest, cheapest validation there is: you learn the workflow, the volumes, and whether you actually enjoy the 4:30am version of this idea.',
    },
    {
      action: 'Shortlist five venues and talk to their operators/committees',
      timeframe: 'Week 2–4',
      rationale: 'Site conversations cost nothing and are the real feasibility test — two warm agreements in principle change every number in this report.',
    },
    {
      action: 'Complete the Food Safety Supervisor course and map council requirements for your target venues',
      timeframe: 'Week 3–4',
      rationale: 'Short, cheap, and unblocks trading; council approval timelines are the long pole, so start them before buying equipment.',
    },
    {
      action: 'Run a 6-weekend cart pilot at one committed venue',
      timeframe: 'Month 2–3',
      rationale: 'Under $10k in, real cups-per-hour data out. This is the evidence that justifies (or kills) the van purchase with facts instead of hope.',
    },
    {
      action: 'Make the van decision with pilot data and financing quotes side by side',
      timeframe: 'Month 4',
      rationale: 'If the pilot clears ~120 cups/day, equipment finance turns the van into a monthly cost the revenue already covers.',
    },
  ],
}
