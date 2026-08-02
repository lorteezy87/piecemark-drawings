import { createRouter } from "@tanstack/react-router";
import {
  DefaultErrorComponent,
  NotFoundComponent,
} from "@/components/system/error-boundary";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  return createRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultErrorComponent: ({ error, reset }) => (
      <DefaultErrorComponent error={error as Error} reset={reset} />
    ),
    defaultNotFoundComponent: () => <NotFoundComponent />,
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
