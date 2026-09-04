import { Select } from "@/components/ui/select";
import { useAppStore } from "@/lib/store";

/**
 * Job scope selector. Every PM tracker page defaults to the whole portfolio —
 * a PM running four jobs needs "what is hot everywhere" before "what is hot
 * on this job".
 */
export function JobScopeSelect({
  value,
  onChange,
  className,
}: {
  value: string | "all";
  onChange: (v: string | "all") => void;
  className?: string;
}) {
  const projects = useAppStore((s) => s.projects);
  return (
    <Select
      aria-label="Job scope"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className}
    >
      <option value="all">All jobs ({projects.length})</option>
      {projects.map((p) => (
        <option key={p.id} value={p.id}>
          {p.jobNumber} — {p.name.split("—")[0].trim()}
        </option>
      ))}
    </Select>
  );
}
