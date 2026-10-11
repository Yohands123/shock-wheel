import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "./styles.css";

import { ApolloProvider } from "@apollo/client";
import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { client } from "./apollo";
import { App } from "./App";
import { cssVariablesResolver, theme } from "./theme";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ApolloProvider client={client}>
      <MantineProvider theme={theme} cssVariablesResolver={cssVariablesResolver} forceColorScheme="light">
        <Notifications position="top-right" />
        <App />
      </MantineProvider>
    </ApolloProvider>
  </StrictMode>,
);
