import type { Scenario } from "./types";

/**
 * Wheel slices. Shock sizes are illustrative stress parameters, not forecasts.
 * Order matters: the slice index from spinOutcome() indexes into this array.
 */
export const SCENARIOS: Scenario[] = [
  {
    id: "hormuz-closure",
    name: "Strait of Hormuz closure",
    blurb: "Tanker traffic through the strait halts after a naval standoff.",
    sectorShocks: {
      ENERGY: 0.35, TANKERS: 0.5, DEFENSE: 0.12, AIRLINES: -0.25, CRUISE: -0.2,
      CHEMICALS: -0.15, INSURANCE: -0.1, TECH: -0.06, SEMIS: -0.07, BROAD_MARKET: -0.05,
    },
    houseMarginBump: 0.1,
    factors: [
      "A large share of seaborne crude and LNG passes through the strait",
      "Marine war-risk cover is typically cancellable on short notice for listed areas",
      "Hull and cargo premiums reprice; some voyages become uninsurable",
      "Short positions in oil and tankers are squeezed",
      "Jet fuel costs hit airline margins immediately",
      "Implied volatility spikes, so the house raises maintenance requirements",
      "SIPC protects against broker failure, not market losses",
    ],
    color: "#2C3E57",
  },
  {
    id: "fed-surprise-hike",
    name: "Surprise 75bp Fed hike",
    blurb: "An unscheduled meeting delivers a hike nobody priced in.",
    sectorShocks: {
      BANKS: 0.04, TECH: -0.14, SEMIS: -0.16, CRYPTO: -0.25, UTILITIES: -0.09,
      INSURANCE: 0.02, BROAD_MARKET: -0.07,
    },
    houseMarginBump: 0.05,
    factors: [
      "Long-duration growth stocks reprice hardest when discount rates jump",
      "Bank net interest margins widen, but unrealized bond losses grow",
      "Insurers' fixed-income portfolios mark down while reinvestment yields improve",
      "Margin loan rates rise, increasing carry cost on leveraged accounts",
      "Crypto trades as a high-beta liquidity asset",
    ],
    color: "#8A5A2B",
  },
  {
    id: "chip-export-ban",
    name: "Sweeping chip export ban",
    blurb: "New controls cut advanced semiconductors off from a major market.",
    sectorShocks: {
      SEMIS: -0.3, TECH: -0.12, DEFENSE: 0.05, BROAD_MARKET: -0.04,
    },
    houseMarginBump: 0.08,
    factors: [
      "Revenue concentration in one geography becomes a single point of failure",
      "Semiconductor equipment makers lose backlog overnight",
      "Concentrated semis books breach first; diversified books absorb it",
      "Trade credit and political-risk insurance claims may rise for exporters",
      "Index rebalancing amplifies selling in mega-cap tech",
    ],
    color: "#3F6B5C",
  },
  {
    id: "crypto-exchange-collapse",
    name: "Major crypto exchange collapse",
    blurb: "A top exchange freezes withdrawals and files for bankruptcy.",
    sectorShocks: {
      CRYPTO: -0.55, BANKS: -0.04, TECH: -0.05, BROAD_MARKET: -0.02,
    },
    houseMarginBump: 0.08,
    factors: [
      "Customer assets at the exchange may be frozen in bankruptcy",
      "Crypto held off-platform is not covered by SIPC",
      "Crypto-adjacent equities and banks with crypto deposits sell off",
      "Contagion risk to lenders and market makers",
      "House raises requirements on crypto-linked ETFs",
    ],
    color: "#6B3A4A",
  },
  {
    id: "heat-dome-grid",
    name: "Heat dome grid failure",
    blurb: "Rolling blackouts across three states during record heat.",
    sectorShocks: {
      UTILITIES: -0.18, ENERGY: 0.12, INSURANCE: -0.08, TECH: -0.03, BROAD_MARKET: -0.02,
    },
    houseMarginBump: 0.04,
    factors: [
      "Utilities face liability claims and regulatory penalties",
      "Natural gas peaker demand pushes energy prices up",
      "Business-interruption claims depend on whether policies cover utility outages",
      "Data centres with weak backup power report downtime",
      "Utility stocks are often held as low-risk; concentrated holders get surprised",
    ],
    color: "#4A5A7A",
  },
  {
    id: "gulf-hurricane",
    name: "Category 5 Gulf hurricane",
    blurb: "A direct hit on refining and chemical plants along the coast.",
    sectorShocks: {
      INSURANCE: -0.18, ENERGY: 0.1, CHEMICALS: -0.12, CRUISE: -0.15, UTILITIES: -0.06,
      BROAD_MARKET: -0.02,
    },
    houseMarginBump: 0.05,
    factors: [
      "Property and casualty insurers absorb large catastrophe losses",
      "Reinsurers and catastrophe bonds take the tail of the loss",
      "Refinery outages lift gasoline prices regionally",
      "Flood damage is often excluded from standard homeowners policies",
      "Cruise itineraries are cancelled and ports close",
    ],
    color: "#9C6B30",
  },
  {
    id: "global-it-outage",
    name: "Global IT outage",
    blurb: "A bad security update bricks millions of machines worldwide.",
    sectorShocks: {
      AIRLINES: -0.12, TECH: -0.08, INSURANCE: -0.06, BANKS: -0.03, BROAD_MARKET: -0.02,
    },
    houseMarginBump: 0.03,
    factors: [
      "Airlines ground flights and face rebooking and compensation costs",
      "Cyber policies may not cover non-malicious outages",
      "Vendor contracts often cap liability at fees paid",
      "Trading platforms degrade, delaying margin call fulfilment",
      "Concentration in one vendor becomes visible as systemic risk",
    ],
    color: "#2F5E6E",
  },
  {
    id: "pandemic-variant",
    name: "Aggressive pandemic variant",
    blurb: "Border closures return as a new variant spreads fast.",
    sectorShocks: {
      AIRLINES: -0.35, CRUISE: -0.45, ENERGY: -0.2, TECH: 0.05, BANKS: -0.1,
      INSURANCE: -0.07, BROAD_MARKET: -0.1,
    },
    houseMarginBump: 0.12,
    factors: [
      "Travel demand collapses, hitting airlines and cruise lines hardest",
      "Oil demand drops as mobility falls",
      "Event cancellation and business-interruption coverage often exclude communicable disease",
      "Remote work beneficiaries rally",
      "Volatility spike triggers house margin increases across the board",
    ],
    color: "#5C4B6E",
  },
];

export function scenarioById(id: string): Scenario {
  const s = SCENARIOS.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown scenario: ${id}`);
  return s;
}
