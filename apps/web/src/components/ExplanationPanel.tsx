import { useQuery } from "@apollo/client";
import { Box, Group, Skeleton, Stack, Text, Title } from "@mantine/core";
import { money } from "../format";
import { RUN_EXCEPTIONS, type ScenarioRun } from "../graphql";
import { tokens } from "../theme";
import { PriorityBadge, SourceTag } from "./badges";

/** Bullets read as sentences even if a model hands back lower case. */
const sentenceStart = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

function EffectList({ title, items, ordered = false }: { title: string; items: string[]; ordered?: boolean }) {
  if (items.length === 0) return null;
  const List = ordered ? "ol" : "ul";
  return (
    <div>
      <Title order={3} fz={16} mb={8}>
        {title}
      </Title>
      <List className={`effect-list${ordered ? " is-ordered" : ""}`}>
        {items.map((item, i) => (
          <li key={i}>{sentenceStart(item)}</li>
        ))}
      </List>
    </div>
  );
}

interface Props {
  run: ScenarioRun | null;
  spinning: boolean;
  loading: boolean;
  onOpenAccount: (accountId: string, exceptionId: string | null) => void;
}

export function ExplanationPanel({ run, spinning, loading, onOpenAccount }: Props) {
  const runExceptions = useQuery(RUN_EXCEPTIONS, { variables: { runId: run?.id ?? "" }, skip: !run });
  const byAccount = new Map((runExceptions.data?.exceptions ?? []).map((e) => [e.account.id, e]));
  const explanation = run?.explanation;

  return (
    <Box component="section" aria-label="Run explanation" px={{ base: 16, sm: 24 }} py={24} className="explanation">
      {spinning || (loading && !run) ? (
        <Stack gap={10} maw={720}>
          <Skeleton h={24} w="80%" />
          <Skeleton h={16} />
          <Skeleton h={16} w="90%" />
          <Skeleton h={16} w="70%" />
        </Stack>
      ) : !run ? (
        <Text fz={15} c={tokens.steel} maw={640}>
          Spin the wheel to get a plain-language read on first- and second-order effects, including insurance angles, and
          which accounts need attention.
        </Text>
      ) : !explanation ? (
        <Text fz={15} c={tokens.steel}>
          No explanation was saved for this run.
        </Text>
      ) : (
        <Stack gap={32}>
          <div>
            <Group gap={12} mb={8} wrap="nowrap" align="center">
              <Text fz={13} c={tokens.steel}>
                {run.scenario.name}
              </Text>
              <SourceTag source={explanation.source} />
            </Group>
            <Title order={2} fz={19} lh={1.4} maw="75ch">
              {explanation.headline}
            </Title>
          </div>

          <div className="explanation-columns">
            <EffectList title="First-order effects" items={explanation.firstOrder} />
            <EffectList title="Second-order effects and insurance" items={explanation.secondOrder} />
          </div>

          <EffectList title="Ops actions" items={explanation.opsActions} ordered />

          <div>
            <Title order={3} fz={16} mb={8}>
              Accounts at risk
            </Title>
            {explanation.accountsAtRisk.length === 0 ? (
              <Text fz={15} c={tokens.steel}>
                No accounts breached maintenance in this run.
              </Text>
            ) : (
              <div className="table-scroll">
              <table className="detail-table risk-table">
                <thead>
                  <tr>
                    <th scope="col">Account</th>
                    <th scope="col">Why</th>
                    <th scope="col">Priority</th>
                    <th scope="col" className="r">
                      Deficit
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {explanation.accountsAtRisk.map((a) => {
                    const ex = byAccount.get(a.accountId);
                    const open = () => onOpenAccount(a.accountId, ex?.id ?? null);
                    return (
                      <tr
                        key={a.accountId}
                        className="queue-row"
                        tabIndex={0}
                        onClick={open}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            open();
                          }
                        }}
                        aria-label={`Open account ${ex?.account.name ?? a.accountId}`}
                      >
                        <td>
                          <div className="queue-account">
                            <span className="queue-account-name">{ex?.account.name ?? a.accountId}</span>
                            <span className="queue-meta num">{a.accountId}</span>
                          </div>
                        </td>
                        <td className="risk-why">{sentenceStart(a.why)}</td>
                        <td>{ex && <PriorityBadge priority={ex.priority} />}</td>
                        <td className="r num strong" style={{ color: tokens.breach }}>
                          {ex ? money(ex.deficit) : ""}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            )}
          </div>
        </Stack>
      )}
    </Box>
  );
}
