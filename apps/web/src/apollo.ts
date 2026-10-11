import { ApolloClient, HttpLink, InMemoryCache, from } from "@apollo/client";
import { setContext } from "@apollo/client/link/context";

export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

// The user switcher writes here; every request reads it at send time.
let currentUserId = "u-maya";
export const setActor = (id: string) => {
  currentUserId = id;
};

const actorLink = setContext((_, { headers }) => ({
  headers: { ...(headers as Record<string, string> | undefined), "x-user-id": currentUserId },
}));

export const client = new ApolloClient({
  link: from([actorLink, new HttpLink({ uri: API_URL })]),
  cache: new InMemoryCache({
    typePolicies: {
      Account: { fields: { margin: { merge: true } } },
    },
  }),
  defaultOptions: { watchQuery: { fetchPolicy: "cache-and-network" } },
});

/** Queries that depend on exception state; refetched after every mutation. */
export const QUEUE_QUERIES = ["Exceptions", "QueueStats", "RunExceptions", "AccountDetail", "LatestRun"];
