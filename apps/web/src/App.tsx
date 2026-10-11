import { useApolloClient, useQuery } from "@apollo/client";
import { Container, Grid, Stack } from "@mantine/core";
import { useCallback, useEffect, useState } from "react";
import { QUEUE_QUERIES, setActor } from "./apollo";
import { AccountDrawer, type DrawerTarget } from "./components/AccountDrawer";
import { AppHeader } from "./components/AppHeader";
import { ExplanationPanel } from "./components/ExplanationPanel";
import { QueuePanel } from "./components/QueuePanel";
import { WheelPanel } from "./components/WheelPanel";
import { LATEST_RUN, type ScenarioRun } from "./graphql";

const USER_KEY = "shock-wheel:user";

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
    <>
      <AppHeader userId={userId} onUserChange={setUserId} />
      <Container size={1440} px={{ base: "md", md: "xl" }} py={{ base: "md", md: "xl" }}>
        <Grid gutter={{ base: "md", lg: "xl" }}>
          <Grid.Col span={{ base: 12, md: 5, xl: 4 }}>
            <Stack gap="md">
              <WheelPanel
                run={run}
                runLoading={latest.loading && !latest.data}
                spinning={spinning}
                onSpinStart={() => setSpinning(true)}
                onSpinFailed={() => setSpinning(false)}
                onLanded={handleLanded}
              />
              <ExplanationPanel
                run={spinning ? null : run}
                spinning={spinning}
                loading={latest.loading && !latest.data}
                onOpenAccount={(accountId, exceptionId) =>
                  setDrawer({ accountId, exceptionId, runId: run?.id ?? null })
                }
              />
            </Stack>
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 7, xl: 8 }}>
            <QueuePanel
              latestRunId={run?.id ?? null}
              onOpen={(row) =>
                setDrawer({ accountId: row.account.id, exceptionId: row.id, runId: row.scenarioRun?.id ?? null })
              }
            />
          </Grid.Col>
        </Grid>
      </Container>
      <AccountDrawer target={drawer} onClose={() => setDrawer(null)} />
    </>
  );
}
