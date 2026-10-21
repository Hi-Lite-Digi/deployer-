import { FlaskConical, RotateCcw } from "lucide-react";

export function DemoBanner() {
  const reset = () => {
    try {
      localStorage.removeItem("deployer-demo-v1");
    } catch {
      /* Storage may be unavailable. */
    }
    window.location.assign("/");
  };
  return (
    <aside
      aria-label="Interactive demo notice"
      className="fixed inset-x-0 bottom-0 z-50 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface px-4 py-3 text-sm shadow-sm sm:px-6"
    >
      <div className="flex items-start gap-2">
        <FlaskConical
          className="mt-0.5 size-4 shrink-0 text-accent"
          aria-hidden="true"
        />
        <p>
          <strong>Interactive demo.</strong> Builds are simulated. Data stays in
          this browser; use sample values.
        </p>
      </div>
      <button
        type="button"
        onClick={reset}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 font-medium text-accent hover:bg-accent/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <RotateCcw className="size-3.5" aria-hidden="true" /> Reset demo
      </button>
    </aside>
  );
}
