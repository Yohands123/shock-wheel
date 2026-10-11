const usd2 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const usd0 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const qtyFmt = new Intl.NumberFormat("en-US");

export const money = (n: number) => usd2.format(n);
export const moneyWhole = (n: number) => usd0.format(n);
export const qty = (n: number) => qtyFmt.format(n);
const sign = (n: number) => (n > 0 ? "+" : n < 0 ? "−" : "");
export const signedPct = (n: number) => `${sign(n)}${Math.abs(n * 100).toFixed(1)}%`;
export const signedMoney = (n: number) => `${sign(n)}${usd2.format(Math.abs(n))}`;

/** "ENERGY" -> "Energy", "BROAD_MARKET" -> "Broad market" */
export const sentence = (s: string) => {
  const lower = s.replace(/_/g, " ").toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
};

export function age(iso: string, now = Date.now()) {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d`;
}

export const dateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

interface GraphQLErrorLike { message: string; extensions?: { code?: unknown } }
interface ApolloErrorLike { graphQLErrors?: readonly GraphQLErrorLike[]; networkError?: unknown }

/** Prefer the server's GraphQL message (e.g. CONFLICT) over Apollo's generic wrapper. */
export function errorMessage(err: unknown): { title: string; message: string } {
  const apollo = (typeof err === "object" && err !== null ? err : {}) as ApolloErrorLike;
  const gqlErr = apollo.graphQLErrors?.[0];
  if (gqlErr) {
    const code = typeof gqlErr.extensions?.code === "string" ? gqlErr.extensions.code : undefined;
    return { title: code ? sentence(code) : "Request failed", message: gqlErr.message };
  }
  if (apollo.networkError) return { title: "Can't reach the API", message: "Check that the API is running on port 4000." };
  return { title: "Something went wrong", message: err instanceof Error ? err.message : String(err) };
}
