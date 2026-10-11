import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "./styles.css";

import { ApolloProvider } from "@apollo/client";
import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { client } from "./apollo";
import { App } from "./App";
import { cssVariablesResolver, theme } from "./theme";

// import.meta.env.DEV is a build-time constant, so production bundles drop the lab entirely
const DesignLab =
  import.meta.env.DEV && window.location.pathname === "/design-lab"
    ? lazy(() => import("./design-lab/DesignLab").then((m) => ({ default: m.DesignLab })))
    : null;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ApolloProvider client={client}>
      <MantineProvider theme={theme} cssVariablesResolver={cssVariablesResolver} forceColorScheme="light">
        <Notifications position="top-right" />
        {DesignLab ? (
          <Suspense fallback={null}>
            <DesignLab />
          </Suspense>
        ) : (
          <App />
        )}
      </MantineProvider>
    </ApolloProvider>
  </StrictMode>,
);
