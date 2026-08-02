import { createFileRoute } from "@tanstack/react-router";
import { TransmittalDoc } from "@/components/print/transmittal-doc";
import { Button } from "@/components/ui/button";
import { useAppStore, useSelectedProject } from "@/lib/store";

export const Route = createFileRoute("/print/transmittal/$trId")({
  component: PrintTransmittalPage,
});

function PrintTransmittalPage() {
  const { trId } = Route.useParams();
  const project = useSelectedProject();
  const transmittals = useAppStore((s) => s.transmittals);
  const drawings = useAppStore((s) => s.drawings);
  const tr = transmittals.find((t) => t.id === trId);
  if (!project || !tr) {
    return <p className="p-8">Transmittal not found.</p>;
  }
  return (
    <div className="min-h-screen bg-neutral-200 print:bg-white">
      <div className="flex justify-end gap-2 p-4 print:hidden">
        <Button size="sm" onClick={() => window.print()}>
          Print / Save PDF
        </Button>
      </div>
      <TransmittalDoc
        project={project}
        tr={tr}
        drawings={drawings.filter((d) => d.projectId === project.id)}
      />
    </div>
  );
}
