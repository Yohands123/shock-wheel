import { useQuery } from "@apollo/client";
import { Box, Group, Skeleton, Stack, Text, Title, UnstyledButton } from "@mantine/core";
import { IconChevronRight } from "@tabler/icons-react";
import { money } from "../format";
import { RUN_EXCEPTIONS, type ScenarioRun } from "../graphql";
import { PriorityBadge, SourceTag } from "./badges";

function EffectGroup({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <Title order={3} fz="md" mb={6}>
        {title}
      </Title>
      <ul className="effect-list">
        {items.map((item, i) => (
          <li key={i}>
            <Text fz="sm" component="span">
              {item}
            </Text>
          </li>
        ))}
      </ul>
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
    <Box className="surface" p={{ base: "md", sm: "lg" }} component="section" aria-labelledby="explanation-title">
      <Group justify="space-between" align="center" mb="sm">
        <Title order={2} fz="h3" id="explanation-title">
          What this means
        </Title>
        {explanation && <SourceTag source={explanation.source} />}
      </Group>

      {spinning || (loading && !run) ? (
        <Stack gap="xs">
          <Skeleton h={20} />
          <Skeleton h={14} w="90%" />
          <Skeleton h={14} w="80%" />
          <Skeleton h={14} w="85%" />
        </Stack>
      ) : !run ? (
        <Text fz="sm" c="dimmed">
          Spin the wheel to get a plain-language read on first- and second-order effects, including insurance angles,
          and which accounts need attention.
        </Text>
      ) : !explanation ? (
        <Text fz="sm" c="dimmed">
          No explanation was saved for this run.
        </Text>
      ) : (
        <Stack gap="lg">
          <Text fw={600} fz="md" lh={1.45}>
            {explanation.headline}
          </Text>
          <EffectGroup title="First-order effects" items={explanation.firstOrder} />
          <EffectGroup title="Second-order effects and insurance" items={explanation.secondOrder} />
          <EffectGroup title="Ops actions" items={explanation.opsActions} />

          <div>
            <Title order={3} fz="md" mb={6}>
              Accounts at risk
            </Title>
            {explanation.accountsAtRisk.length === 0 ? (
              <Text fz="sm" c="dimmed">
                No accounts breached maintenance in this run.
              </Text>
            ) : (
              <Box style={{ borderBottom: "1px solid var(--sw-line)" }}>
                {explanation.accountsAtRisk.map((a) => {
                  const ex = byAccount.get(a.accountId);
                  return (
                    <UnstyledButton
                      key={a.accountId}
                      className="risk-row"
                      onClick={() => onOpenAccount(a.accountId, ex?.id ?? null)}
                      aria-label={`Open account ${ex?.account.name ?? a.accountId}`}
                    >
                      <Group justify="space-between" wrap="nowrap" gap="sm" align="flex-start">
                        <div style={{ minWidth: 0 }}>
                          <Group gap={8} wrap="wrap">
                            <Text fw={600} fz="sm">
                              {ex?.account.name ?? a.accountId}
                            </Text>
                            <Text fz="xs" c="dimmed" className="num">
                              {a.accountId}
                            </Text>
                            {ex && <PriorityBadge priority={ex.priority} />}
                          </Group>
                          <Text fz="sm" c="dimmed" mt={2}>
                            {a.why}
                          </Text>
                        </div>
                        <Group gap={4} wrap="nowrap">
                          {ex && (
                            <Text fz="sm" fw={600} className="num" c="breach.7">
                              {money(ex.deficit)}
                            </Text>
                          )}
                          <IconChevronRight size={16} color="var(--sw-steel)" aria-hidden />
                        </Group>
                      </Group>
                    </UnstyledButton>
                  );
                })}
              </Box>
            )}
          </div>
        </Stack>
      )}
    </Box>
  );
}
