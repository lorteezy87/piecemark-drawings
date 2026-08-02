import { createFileRoute } from "@tanstack/react-router";
import { FieldPackageDoc } from "@/components/print/field-package-doc";
import { Button } from "@/components/ui/button";
import { useAppStore, useSelectedProject } from "@/lib/store";

export const Route = createFileRoute("/print/field")({
  component: PrintFieldPage,
});

function PrintFieldPage() {
  const project = useSelectedProject();
  const drawings = useAppStore((s) => s.drawings);
  const sequences = useAppStore((s) => s.sequences);
  if (!project) return <p className="p-8">No active job.</p>;
  const dwgs = drawings.filter((d) => d.projectId === project.id);
  const seqs = sequences.filter((s) => s.projectId === project.id);
  return (
    <div className="min-h-screen bg-neutral-200 print:bg-white">
      <div className="flex justify-end gap-2 p-4 print:hidden">
        <Button size="sm" onClick={() => window.print()}>
          Print / Save PDF
        </Button>
      </div>
      <FieldPackageDoc
        project={project}
        drawings={dwgs}
        sequences={seqs}
      />
    </div>
  );
}
