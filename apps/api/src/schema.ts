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
  }

  type Mutation {
    "Spin the shock wheel. Pass a seed to replay an earlier run exactly."
    spinWheel(seed: String): ScenarioRun!
    assignException(id: ID!, userId: ID!): Exception!
    resolveException(id: ID!, note: String!): Exception!
    escalateException(id: ID!, reason: String!): Exception!
    runMarginSweep(tick: Boolean = false): SweepResult!
  }
`;
