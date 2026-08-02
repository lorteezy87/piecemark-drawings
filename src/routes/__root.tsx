import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { Toaster } from "sonner";
import {
  DefaultErrorComponent,
  NotFoundComponent,
} from "@/components/system/error-boundary";
import { AuthProvider } from "@/lib/auth/provider";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      {
        title: "PieceMark — Steel Drawings Control",
      },
      {
        name: "description",
        content:
          "Drawings management for steel erection and fabrication subcontractors: register, revisions, RFIs, submittals, and erection sequences.",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  component: RootDocument,
  errorComponent: ({ error, reset }) => (
    <DefaultErrorComponent error={error as Error} reset={reset} />
  ),
  notFoundComponent: () => <NotFoundComponent />,
});

function RootDocument() {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <AuthProvider>
          <Outlet />
          <Toaster
            theme="dark"
            position="bottom-right"
            toastOptions={{
              style: {
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                color: "var(--color-fg)",
              },
            }}
          />
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  );
}
