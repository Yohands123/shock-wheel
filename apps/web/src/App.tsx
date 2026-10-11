import { useApolloClient, useQuery } from "@apollo/client";
import { Box, SegmentedControl, Tabs } from "@mantine/core";
import { useCallback, useEffect, useState } from "react";
import { QUEUE_QUERIES, setActor } from "./apollo";
import { AccountDrawer, type DrawerTarget } from "./components/AccountDrawer";
import { AppHeader } from "./components/AppHeader";
import { ExplanationPanel } from "./components/ExplanationPanel";
import { QueuePanel } from "./components/QueuePanel";
import { WheelPanel } from "./components/WheelPanel";
import { HomePremiumPanel } from "./components/premium/HomePremiumPanel";
import { PremiumProvider } from "./components/premium/PremiumContext";
import { RenewalRail } from "./components/premium/RenewalRail";
import { LATEST_RUN, type ScenarioRun } from "./graphql";

const USER_KEY = "shock-wheel:user";

type Tab = "queue" | "explanation" | "premium";
const TABS: Array<{ value: Tab; label: string; short: string }> = [
  { value: "queue", label: "Queue", short: "Queue" },
  { value: "explanation", label: "Run explanation", short: "Explanation" },
  { value: "premium", label: "Home premium", short: "Premium" },
];

function readStoredUser() {
  try {
    return localStorage.getItem(USER_KEY) ?? "u-maya";
  } catch {
    return "u-maya";
  }
}

export function App() {
  const client = useApolloClient();
  const [userId, setUserId] = useState(() => {
    const id = readStoredUser();
    setActor(id);
    return id;
  });
  const [landedRun, setLandedRun] = useState<ScenarioRun | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [drawer, setDrawer] = useState<DrawerTarget | null>(null);
  const [tab, setTab] = useState<Tab>("queue");

  const latest = useQuery(LATEST_RUN);
  // A run landed in this session wins; otherwise show the most recent run from the server
  const run = landedRun ?? latest.data?.scenarioRuns[0] ?? null;

  useEffect(() => {
    setActor(userId);
    try {
      localStorage.setItem(USER_KEY, userId);
    } catch {
      // Private mode or blocked storage: the switcher still works for this session
    }
  }, [userId]);

  const handleLanded = useCallback(
    (r: ScenarioRun) => {
      setLandedRun(r);
      setSpinning(false);
      // Hold queue updates until the wheel stops so the table doesn't give the result away
      void client.refetchQueries({ include: QUEUE_QUERIES });
    },
    [client],
  );

  return (
    <PremiumProvider>
      <AppHeader userId={userId} onUserChange={setUserId} />
      <div className="shell">
        <aside className="rail">
          {tab === "premium" ? (
            <RenewalRail />
          ) : (
            <WheelPanel
              run={run}
              runLoading={latest.loading && !latest.data}
              spinning={spinning}
              onSpinStart={() => setSpinning(true)}
              onSpinFailed={() => setSpinning(false)}
              onLanded={handleLanded}
            />
          )}
        </aside>

        <main className="workspace">
          <Tabs value={tab} onChange={(v) => v && setTab(v as Tab)} keepMounted={false} className="workspace-tabs">
            <Tabs.List visibleFrom="sm" className="workspace-tablist">
              {TABS.map((t) => (
                <Tabs.Tab key={t.value} value={t.value}>
                  {t.label}
                </Tabs.Tab>
              ))}
            </Tabs.List>
            <Box hiddenFrom="sm" p={16} pb={0}>
              <SegmentedControl
                fullWidth
                value={tab}
                onChange={(v) => setTab(v as Tab)}
                data={TABS.map((t) => ({ value: t.value, label: t.short }))}
                aria-label="Workspace section"
              />
            </Box>

            <Tabs.Panel value="queue" className="workspace-panel">
              <QueuePanel
                latestRunId={run?.id ?? null}
                onOpen={(row) =>
                  setDrawer({ accountId: row.account.id, exceptionId: row.id, runId: row.scenarioRun?.id ?? null })
                }
              />
            </Tabs.Panel>
            <Tabs.Panel value="premium" className="workspace-panel">
              <HomePremiumPanel />
            </Tabs.Panel>
            <Tabs.Panel value="explanation" className="workspace-panel">
              <ExplanationPanel
                run={spinning ? null : run}
                spinning={spinning}
                loading={latest.loading && !latest.data}
                onOpenAccount={(accountId, exceptionId) => setDrawer({ accountId, exceptionId, runId: run?.id ?? null })}
              />
            </Tabs.Panel>
          </Tabs>
        </main>
      </div>
      <AccountDrawer target={drawer} onClose={() => setDrawer(null)} />
    </PremiumProvider>
  );
}
