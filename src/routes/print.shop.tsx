import { createFileRoute } from "@tanstack/react-router";
import { ShopPackageDoc } from "@/components/print/shop-package-doc";
import { Button } from "@/components/ui/button";
import { useAppStore, useSelectedProject } from "@/lib/store";

export const Route = createFileRoute("/print/shop")({
  component: PrintShopPage,
});

function PrintShopPage() {
  const project = useSelectedProject();
  const drawings = useAppStore((s) => s.drawings);
  const sequences = useAppStore((s) => s.sequences);
  if (!project) return <p className="p-8">No active job.</p>;
  return (
    <div className="min-h-screen bg-neutral-200 print:bg-white">
      <div className="flex justify-end gap-2 p-4 print:hidden">
        <Button size="sm" onClick={() => window.print()}>
          Print / Save PDF
        </Button>
      </div>
      <ShopPackageDoc
        project={project}
        drawings={drawings.filter((d) => d.projectId === project.id)}
        sequences={sequences.filter((s) => s.projectId === project.id)}
      />
    </div>
  );
}
