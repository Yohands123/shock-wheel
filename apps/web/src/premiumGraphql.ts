import { gql, type TypedDocumentNode } from "@apollo/client";
import type { Construction, DistanceToWater, Endorsement, HouseProfile, NonRenewalRisk, RegionId } from "@shock/shared";

// Hand-written result types for Renewal roulette; they mirror apps/api/src/schema.ts.

export interface PerilScore { peril: string; label: string; score: number }
export interface Region { id: RegionId; name: string; country: string; hazards: PerilScore[] }
export interface RenewalEvent {
  id: string;
  shortLabel: string;
  name: string;
  blurb: string;
  color: string;
  kind: "PERIL" | "MARKET" | "PERSONAL";
  lowersPremium: boolean;
}
export interface Driver { label: string; amount: number }
export interface CoverageGap { peril: string; endorsement: Endorsement; message: string }
export interface RenewalExplanation {
  headline: string;
  whyItMoved: string[];
  askYourBroker: string[];
  mitigation: string[];
  coverageGaps: string[];
  source: string;
}
export interface RenewalRun {
  id: string;
  year: number;
  seed: string;
  event: RenewalEvent;
  severityLabel: "MILD" | "SEVERE" | "TAIL";
  severity: number;
  sliceIndex: number;
  premiumBefore: number;
  premiumAfter: number;
  changePct: number;
  drivers: Driver[];
  nonRenewalRisk: NonRenewalRisk;
  coverageGaps: CoverageGap[];
  explanation: RenewalExplanation | null;
  disclaimer: string;
  createdAt: string;
}
export interface House {
  id: string;
  label: string;
  pathSeed: string;
  year: number;
  profile: HouseProfile;
  initialProfile: HouseProfile;
  region: Region;
  exposure: PerilScore[];
  coverageGaps: CoverageGap[];
  runs: RenewalRun[];
}

export type HouseInput = HouseProfile & { id?: string; pathSeed?: string };
export type { Construction, DistanceToWater, Endorsement, HouseProfile, NonRenewalRisk, RegionId };

const PROFILE_FIELDS = `label region areaNote replacementCost yearBuilt roofAgeYears construction distanceToWater
  wildlandInterface claimsLast5Years deductible currentAnnualPremium endorsements`;

const RUN_FIELDS = gql`
  fragment RenewalRunFields on RenewalRun {
    id
    year
    seed
    event { id shortLabel name blurb color kind lowersPremium }
    severityLabel
    severity
    sliceIndex
    premiumBefore
    premiumAfter
    changePct
    drivers { label amount }
    nonRenewalRisk
    coverageGaps { peril endorsement message }
    explanation { headline whyItMoved askYourBroker mitigation coverageGaps source }
    disclaimer
    createdAt
  }
`;

const HOUSE_FIELDS = gql`
  ${RUN_FIELDS}
  fragment HouseFields on House {
    id
    label
    pathSeed
    year
    profile { ${PROFILE_FIELDS} }
    initialProfile { ${PROFILE_FIELDS} }
    region { id name country hazards { peril label score } }
    exposure { peril label score }
    coverageGaps { peril endorsement message }
    runs { ...RenewalRunFields }
  }
`;

export const REGIONS_AND_EVENTS: TypedDocumentNode<{ regions: Region[]; renewalEvents: RenewalEvent[] }> = gql`
  query RegionsAndEvents {
    regions { id name country hazards { peril label score } }
    renewalEvents { id shortLabel name blurb color kind lowersPremium }
  }
`;

export const HOUSE: TypedDocumentNode<{ house: House | null }, { id: string }> = gql`
  ${HOUSE_FIELDS}
  query House($id: ID!) { house(id: $id) { ...HouseFields } }
`;

export const SAVE_HOUSE: TypedDocumentNode<{ saveHouse: House }, { input: HouseInput }> = gql`
  ${HOUSE_FIELDS}
  mutation SaveHouse($input: HouseInput!) { saveHouse(input: $input) { ...HouseFields } }
`;

export const SPIN_RENEWAL: TypedDocumentNode<{ spinRenewal: RenewalRun }, { houseId: string; seed?: string }> = gql`
  ${RUN_FIELDS}
  mutation SpinRenewal($houseId: ID!, $seed: String) { spinRenewal(houseId: $houseId, seed: $seed) { ...RenewalRunFields } }
`;

export const RESET_HOUSE: TypedDocumentNode<{ resetHouse: House }, { houseId: string }> = gql`
  ${HOUSE_FIELDS}
  mutation ResetHouse($houseId: ID!) { resetHouse(houseId: $houseId) { ...HouseFields } }
`;
