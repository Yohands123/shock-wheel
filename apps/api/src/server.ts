import { ApolloServer } from "@apollo/server";
import { typeDefs } from "./schema";
import { resolvers } from "./resolvers";
import type { Context } from "./context";

export function createServer() {
  return new ApolloServer<Context>({ typeDefs, resolvers });
}
