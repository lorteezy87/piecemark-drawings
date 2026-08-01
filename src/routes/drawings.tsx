import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/drawings")({
  component: DrawingsLayout,
});

function DrawingsLayout() {
  return <Outlet />;
}
