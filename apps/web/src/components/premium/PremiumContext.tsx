import { useMutation, useQuery } from "@apollo/client";
import { DEFAULT_HOUSE, type HouseProfile } from "@shock/shared";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { HOUSE, RESET_HOUSE, SAVE_HOUSE, SPIN_RENEWAL, type House, type RenewalRun } from "../../premiumGraphql";

const HOUSE_KEY = "shock-wheel:house-id";

function readHouseId() {
  try {
    return localStorage.getItem(HOUSE_KEY);
  } catch {
    return null;
  }
}
function writeHouseId(id: string | null) {
  try {
    if (id) localStorage.setItem(HOUSE_KEY, id);
    else localStorage.removeItem(HOUSE_KEY);
  } catch {
    // Storage blocked: the house still works for this visit
  }
}

const PROFILE_KEYS = Object.keys(DEFAULT_HOUSE) as Array<keyof HouseProfile>;

/** Strip GraphQL __typename and anything else that isn't a profile field. */
export function cleanProfile(p: HouseProfile): HouseProfile {
  return Object.fromEntries(PROFILE_KEYS.map((k) => [k, p[k]])) as unknown as HouseProfile;
}

const sameProfile = (a: HouseProfile, b: HouseProfile) => JSON.stringify(cleanProfile(a)) === JSON.stringify(cleanProfile(b));

interface PremiumState {
  house: House | null;
  loading: boolean;
  draft: HouseProfile;
  setDraft: (p: HouseProfile) => void;
  /** Draft differs from what's saved (saving restarts the path) */
  dirty: boolean;
  spinning: boolean;
  setSpinning: (v: boolean) => void;
  /** The run the wheel last landed on in this session; results hold until it lands */
  landedRun: RenewalRun | null;
  latestRun: RenewalRun | null;
  /** Save the draft if needed, then price the next year. The caller animates the wheel. */
  requestSpin: (seed?: string) => Promise<RenewalRun>;
  land: (run: RenewalRun) => void;
  save: () => Promise<House>;
  startOver: () => Promise<void>;
}

const Ctx = createContext<PremiumState | null>(null);

export function PremiumProvider({ children }: { children: ReactNode }) {
  const [houseId, setHouseId] = useState<string | null>(readHouseId);
  const { data, loading, refetch } = useQuery(HOUSE, { variables: { id: houseId ?? "" }, skip: !houseId });
  const house = data?.house ?? null;
  const [draft, setDraft] = useState<HouseProfile>(DEFAULT_HOUSE);
  const [spinning, setSpinning] = useState(false);
  const [landedRun, setLandedRun] = useState<RenewalRun | null>(null);
  const [saveHouse] = useMutation(SAVE_HOUSE);
  const [spinRenewal] = useMutation(SPIN_RENEWAL);
  const [resetHouse] = useMutation(RESET_HOUSE);

  // A stored id for a house that no longer exists (e.g. after a reseed): start fresh
  useEffect(() => {
    if (houseId && data && data.house === null) {
      writeHouseId(null);
      setHouseId(null);
    }
  }, [houseId, data]);

  // Load the saved profile into the form once per house
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  useEffect(() => {
    if (house && loadedFor !== house.id) {
      setDraft(cleanProfile(house.initialProfile));
      setLoadedFor(house.id);
    }
  }, [house, loadedFor]);

  const dirty = !house || !sameProfile(draft, house.initialProfile);

  const save = useCallback(async () => {
    const { data: saved } = await saveHouse({ variables: { input: { ...cleanProfile(draft), id: house?.id } } });
    if (!saved) throw new Error("The server didn't return the house");
    writeHouseId(saved.saveHouse.id);
    setHouseId(saved.saveHouse.id);
    setLoadedFor(saved.saveHouse.id);
    setLandedRun(null);
    await refetch?.({ id: saved.saveHouse.id }).catch(() => undefined);
    return saved.saveHouse;
  }, [saveHouse, draft, house?.id, refetch]);

  const requestSpin = useCallback(
    async (seed?: string) => {
      const target = dirty ? await save() : house!;
      const { data: spun } = await spinRenewal({ variables: { houseId: target.id, seed: seed || undefined } });
      if (!spun) throw new Error("The server returned no renewal");
      return spun.spinRenewal;
    },
    [dirty, save, house, spinRenewal],
  );

  const land = useCallback(
    (run: RenewalRun) => {
      setLandedRun(run);
      void refetch();
    },
    [refetch],
  );

  const startOver = useCallback(async () => {
    if (!house) return;
    await resetHouse({ variables: { houseId: house.id } });
    setLandedRun(null);
    await refetch();
  }, [house, resetHouse, refetch]);

  const runs = house?.runs ?? [];
  const latestRun = spinning ? null : (landedRun ?? runs.at(-1) ?? null);

  const value = useMemo<PremiumState>(
    () => ({ house, loading, draft, setDraft, dirty, spinning, setSpinning, landedRun, latestRun, requestSpin, land, save, startOver }),
    [house, loading, draft, dirty, spinning, landedRun, latestRun, requestSpin, land, save, startOver],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePremium() {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePremium must be used inside PremiumProvider");
  return v;
}
