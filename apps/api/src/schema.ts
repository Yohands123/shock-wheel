export const typeDefs = /* GraphQL */ `
  enum ExceptionStatus { OPEN ASSIGNED ESCALATED RESOLVED }
  enum ExceptionPriority { LOW MEDIUM HIGH CRITICAL }
  enum ExceptionSource { SWEEP SCENARIO }

  type User { id: ID! name: String! role: String! }

  type SectorShock { sector: String! pct: Float! }
  type Scenario {
    id: ID!
    name: String!
    "Wheel label, max 14 characters"
    shortLabel: String!
    blurb: String!
    color: String!
    houseMarginBump: Float!
    factors: [String!]!
    shocks: [SectorShock!]!
  }

  type AccountRisk { accountId: ID! why: String! }
  type Explanation {
    headline: String!
    firstOrder: [String!]!
    secondOrder: [String!]!
    accountsAtRisk: [AccountRisk!]!
    opsActions: [String!]!
    source: String!
  }

  type ScenarioRun {
    id: ID!
    scenario: Scenario!
    severityLabel: String!
    severity: Float!
    seed: String!
    sliceIndex: Int!
    createdAt: String!
    createdBy: User
    explanation: Explanation
    breachCount: Int!
    totalDeficit: Float!
  }

  type Position {
    symbol: String!
    name: String!
    sector: String!
    qty: Int!
    price: Float!
    marketValue: Float!
    shockPct: Float
    shockedPrice: Float
    pnl: Float
  }

  type MarginSnapshot {
    equity: Float!
    maintenanceRequirement: Float!
    deficit: Float!
    breached: Boolean!
    equityRatio: Float
    longMarketValue: Float!
    shortMarketValue: Float!
  }

  type MarginView {
    before: MarginSnapshot!
    "Present when viewed through a scenario run"
    after: MarginSnapshot
    positions: [Position!]!
  }

  type Account {
    id: ID!
    name: String!
    owner: String!
    riskProfile: String!
    cash: Float!
    margin(scenarioRunId: ID): MarginView!
    exceptions: [Exception!]!
  }

  type AuditEntry {
    id: ID!
    action: String!
    actor: User!
    payload: String!
    createdAt: String!
  }

  type Exception {
    id: ID!
    account: Account!
    status: ExceptionStatus!
    priority: ExceptionPriority!
    source: ExceptionSource!
    equity: Float!
    maintenanceRequirement: Float!
    deficit: Float!
    scenarioRun: ScenarioRun
    assignee: User
    resolutionNote: String
    escalationReason: String
    createdAt: String!
    updatedAt: String!
    audit: [AuditEntry!]!
  }

  input ExceptionFilter {
    status: [ExceptionStatus!]
    priority: [ExceptionPriority!]
    source: ExceptionSource
    scenarioRunId: ID
    assigneeId: ID
    search: String
  }

  type QueueStats {
    open: Int!
    assigned: Int!
    escalated: Int!
    resolved: Int!
    openDeficit: Float!
  }

  type SweepResult { checked: Int! breaches: Int! created: Int! skippedLocked: Boolean! }


  # ---------- Renewal roulette (illustrative premium model, not a quote) ----------

  enum Construction { WOOD_FRAME MASONRY CONCRETE }
  enum Endorsement { OVERLAND_FLOOD SEWER_BACKUP EARTHQUAKE }
  enum RenewalEventKind { PERIL MARKET PERSONAL }
  enum NonRenewalRisk { LOW MEDIUM HIGH }

  type PerilScore { peril: String! label: String! score: Float! }

  type Region {
    id: ID!
    name: String!
    country: String!
    "Illustrative hazard scores, 0-1"
    hazards: [PerilScore!]!
  }

  type RenewalEvent {
    id: ID!
    "Wheel label, max 14 characters"
    shortLabel: String!
    name: String!
    blurb: String!
    color: String!
    kind: RenewalEventKind!
    lowersPremium: Boolean!
  }

  type HouseProfile {
    label: String!
    "Region id, e.g. SOUTHERN_ONTARIO"
    region: String!
    areaNote: String!
    replacementCost: Float!
    yearBuilt: Int!
    roofAgeYears: Int!
    construction: Construction!
    "UNDER_500M, 500M_TO_2KM or OVER_2KM"
    distanceToWater: String!
    wildlandInterface: Boolean!
    claimsLast5Years: Int!
    deductible: Float!
    currentAnnualPremium: Float!
    endorsements: [Endorsement!]!
  }

  type Driver { label: String! amount: Float! }
  type CoverageGap { peril: String! endorsement: Endorsement! message: String! }

  type RenewalExplanation {
    headline: String!
    whyItMoved: [String!]!
    askYourBroker: [String!]!
    mitigation: [String!]!
    coverageGaps: [String!]!
    source: String!
  }

  type RenewalRun {
    id: ID!
    year: Int!
    seed: String!
    event: RenewalEvent!
    severityLabel: String!
    severity: Float!
    sliceIndex: Int!
    premiumBefore: Float!
    premiumAfter: Float!
    changePct: Float!
    "Sum exactly to premiumAfter - premiumBefore"
    drivers: [Driver!]!
    nonRenewalRisk: NonRenewalRisk!
    coverageGaps: [CoverageGap!]!
    explanation: RenewalExplanation
    disclaimer: String!
    createdAt: String!
  }

  type House {
    id: ID!
    label: String!
    "Current profile, after the latest renewal"
    profile: HouseProfile!
    "As saved; Start over returns here"
    initialProfile: HouseProfile!
    "Year N spins with seed <pathSeed>:<N> unless a seed is passed"
    pathSeed: String!
    "Renewals priced so far"
    year: Int!
    region: Region!
    exposure: [PerilScore!]!
    coverageGaps: [CoverageGap!]!
    runs: [RenewalRun!]!
    createdAt: String!
  }

  input HouseInput {
    "Omit to create. Saving an existing house restarts its path."
    id: ID
    label: String!
    region: String!
    areaNote: String
    replacementCost: Float!
    yearBuilt: Int!
    roofAgeYears: Int!
    construction: Construction!
    distanceToWater: String!
    wildlandInterface: Boolean!
    claimsLast5Years: Int!
    deductible: Float!
    currentAnnualPremium: Float!
    endorsements: [Endorsement!]!
    "Replay a path: year N uses <pathSeed>:<N>"
    pathSeed: String
  }

  type Query {
    me: User
    users: [User!]!
    scenarios: [Scenario!]!
    exceptions(filter: ExceptionFilter, limit: Int = 200): [Exception!]!
    exception(id: ID!): Exception
    account(id: ID!): Account
    scenarioRuns(limit: Int = 10): [ScenarioRun!]!
    scenarioRun(id: ID!): ScenarioRun
    queueStats: QueueStats!
    regions: [Region!]!
    renewalEvents: [RenewalEvent!]!
    houses: [House!]!
    house(id: ID!): House
    renewalPath(houseId: ID!): [RenewalRun!]!
  }

  type Mutation {
    "Spin the shock wheel. Pass a seed to replay an earlier run exactly."
    spinWheel(seed: String): ScenarioRun!
    assignException(id: ID!, userId: ID!): Exception!
    resolveException(id: ID!, note: String!): Exception!
    escalateException(id: ID!, reason: String!): Exception!
    runMarginSweep(tick: Boolean = false): SweepResult!
    saveHouse(input: HouseInput!): House!
    "Advance one renewal year. The server picks the event from the seed."
    spinRenewal(houseId: ID!, seed: String): RenewalRun!
    resetHouse(houseId: ID!): House!
  }
`;
