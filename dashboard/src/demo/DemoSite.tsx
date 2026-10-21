import { Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";

export function DemoSite() {
  return (
    <main className="mx-auto flex min-h-[80dvh] max-w-xl flex-col items-center justify-center gap-5 px-6 text-center">
      <CheckCircle2 className="size-12 text-accent" aria-hidden="true" />
      <h1 className="text-3xl font-semibold tracking-tight">
        Your demo app is ready
      </h1>
      <p className="text-muted">
        This sample page represents the result of a successful deployment. The
        interactive demo does not clone your repository or run its code.
      </p>
      <Link
        to="/"
        className="rounded-lg bg-accent px-4 py-2 font-medium text-white"
      >
        Back to Deployer
      </Link>
    </main>
  );
}
