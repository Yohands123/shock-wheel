import { gql, type TypedDocumentNode } from "@apollo/client";
import type { ExceptionPriority, SeverityLabel } from "@shock/shared";

// Hand-written result types for the documents below; they mirror apps/api/src/schema.ts.

export type ExceptionStatus = "OPEN" | "ASSIGNED" | "ESCALATED" | "RESOLVED";
export type ExceptionSource = "SWEEP" | "SCENARIO";
export type { ExceptionPriority, SeverityLabel };

export interface User { id: string; name: string; role: string }
export interface Scenario { id: string; name: string; blurb: string; color: string }
export interface AccountRisk { accountId: string; why: string }
export interface Explanation {
  headline: string;
  firstOrder: string[];
  secondOrder: string[];
  accountsAtRisk: AccountRisk[];
  opsActions: string[];
  source: string;
}
export interface ScenarioRun {
  id: string;
  sliceIndex: number;
  seed: string;
  severityLabel: SeverityLabel;
  severity: number;
  breachCount: number;
  totalDeficit: number;
  createdAt: string;
  scenario: Scenario;
  explanation: Explanation | null;
}
export interface QueueStats { open: number; assigned: number; escalated: number; resolved: number; openDeficit: number }
export interface ExceptionRow {
  id: string;
  status: ExceptionStatus;
  priority: ExceptionPriority;
  source: ExceptionSource;
  equity: number;
  maintenanceRequirement: number;
  deficit: number;
  createdAt: string;
  account: { id: string; name: string };
  assignee: User | null;
  scenarioRun: { id: string } | null;
}
export interface ExceptionFilter {
  status?: ExceptionStatus[];
  priority?: ExceptionPriority[];
  source?: ExceptionSource;
  scenarioRunId?: string;
  search?: string;
}
export interface MarginSnapshot { equity: number; maintenanceRequirement: number; deficit: number; breached: boolean }
export interface Position {
  symbol: string;
  name: string;
  sector: string;
  qty: number;
  price: number;
  marketValue: number;
  shockPct: number | null;
  shockedPrice: number | null;
  pnl: number | null;
}
export interface AuditEntry { id: string; action: string; payload: string; createdAt: string; actor: User }
export interface AccountException extends ExceptionRow {
  resolutionNote: string | null;
  escalationReason: string | null;
  audit: AuditEntry[];
}
export interface AccountDetail {
  id: string;
  name: string;
  owner: string;
  riskProfile: string;
  margin: { before: MarginSnapshot; after: MarginSnapshot | null; positions: Position[] };
  exceptions: AccountException[];
}

const RUN_FIELDS = gql`
  fragment RunFields on ScenarioRun {
    id
    sliceIndex
    seed
    severityLabel
    severity
    breachCount
    totalDeficit
    createdAt
    scenario { id name blurb color }
    explanation {
      headline
      firstOrder
      secondOrder
      accountsAtRisk { accountId why }
      opsActions
      source
    }
  }
`;

const EXCEPTION_FIELDS = gql`
  fragment ExceptionFields on Exception {
    id
    status
    priority
    source
    equity
    maintenanceRequirement
    deficit
    createdAt
    account { id name }
    assignee { id name role }
    scenarioRun { id }
  }
`;

export const USERS: TypedDocumentNode<{ users: User[] }> = gql`
  query Users { users { id name role } }
`;

export const SCENARIOS: TypedDocumentNode<{ scenarios: Scenario[] }> = gql`
  query Scenarios { scenarios { id name blurb color } }
`;

export const QUEUE_STATS: TypedDocumentNode<{ queueStats: QueueStats }> = gql`
  query QueueStats { queueStats { open assigned escalated resolved openDeficit } }
`;

export const LATEST_RUN: TypedDocumentNode<{ scenarioRuns: ScenarioRun[] }> = gql`
  ${RUN_FIELDS}
  query LatestRun { scenarioRuns(limit: 1) { ...RunFields } }
`;

export const EXCEPTIONS: TypedDocumentNode<{ exceptions: ExceptionRow[] }, { filter: ExceptionFilter }> = gql`
  ${EXCEPTION_FIELDS}
  query Exceptions($filter: ExceptionFilter) { exceptions(filter: $filter) { ...ExceptionFields } }
`;

export const RUN_EXCEPTIONS: TypedDocumentNode<{ exceptions: ExceptionRow[] }, { runId: string }> = gql`
  ${EXCEPTION_FIELDS}
  query RunExceptions($runId: ID!) { exceptions(filter: { scenarioRunId: $runId }) { ...ExceptionFields } }
`;

export const ACCOUNT_DETAIL: TypedDocumentNode<{ account: AccountDetail | null }, { id: string; runId: string | null }> = gql`
  ${EXCEPTION_FIELDS}
  query AccountDetail($id: ID!, $runId: ID) {
    account(id: $id) {
      id
      name
      owner
      riskProfile
      margin(scenarioRunId: $runId) {
        before { equity maintenanceRequirement deficit breached }
        after { equity maintenanceRequirement deficit breached }
        positions { symbol name sector qty price marketValue shockPct shockedPrice pnl }
      }
      exceptions {
        ...ExceptionFields
        resolutionNote
        escalationReason
        audit { id action payload createdAt actor { id name role } }
      }
    }
  }
`;

export const SPIN_WHEEL: TypedDocumentNode<{ spinWheel: ScenarioRun }, { seed?: string }> = gql`
  ${RUN_FIELDS}
  mutation SpinWheel($seed: String) { spinWheel(seed: $seed) { ...RunFields } }
`;

export interface SweepResult { checked: number; breaches: number; created: number; skippedLocked: boolean }
export const RUN_SWEEP: TypedDocumentNode<{ runMarginSweep: SweepResult }> = gql`
  mutation RunMarginSweep { runMarginSweep(tick: true) { checked breaches created skippedLocked } }
`;

export const ASSIGN: TypedDocumentNode<{ assignException: { id: string } }, { id: string; userId: string }> = gql`
  mutation AssignException($id: ID!, $userId: ID!) {
    assignException(id: $id, userId: $userId) { id status assignee { id name role } }
  }
`;

export const ESCALATE: TypedDocumentNode<{ escalateException: { id: string } }, { id: string; reason: string }> = gql`
  mutation EscalateException($id: ID!, $reason: String!) {
    escalateException(id: $id, reason: $reason) { id status escalationReason }
  }
`;

export const RESOLVE: TypedDocumentNode<{ resolveException: { id: string } }, { id: string; note: string }> = gql`
  mutation ResolveException($id: ID!, $note: String!) {
    resolveException(id: $id, note: $note) { id status resolutionNote }
  }
`;
