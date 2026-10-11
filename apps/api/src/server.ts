import { ApolloServer } from "@apollo/server";
import { typeDefs } from "./schema";
import { resolvers } from "./resolvers";
import { renewalResolvers } from "./renewalResolvers";
import type { Context } from "./context";

export function createServer() {
  // Plain merge: the two resolver maps don't share type names except Query and Mutation
  const merged = {
    ...resolvers,
    ...renewalResolvers,
    Query: { ...resolvers.Query, ...renewalResolvers.Query },
    Mutation: { ...resolvers.Mutation, ...renewalResolvers.Mutation },
  };
  return new ApolloServer<Context>({ typeDefs, resolvers: merged });
}
