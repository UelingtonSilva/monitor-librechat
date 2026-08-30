import type { ReactNode } from "react";
import { Info } from "lucide-react";

export function PhaseNotice({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border-l-2 border-primary bg-primary/5 px-4 py-3 text-sm text-foreground">
      <Info size={16} className="mt-0.5 shrink-0 text-primary" />
      <div>{children}</div>
    </div>
  );
}
