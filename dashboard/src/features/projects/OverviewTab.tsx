import { Link } from "react-router-dom";
import { GitBranch, Rocket, Users } from "lucide-react";
import { Card } from "../../components/ui/States";
import { formatDate } from "../../lib/format";
import { ROLE_LABELS } from "../../lib/roles";
import { DeploysTab } from "../deploys/DeploysTab";
import { useProjectContext } from "./project-context";

export function OverviewTab() {
  const { project } = useProjectContext();
  const base = `/projects/${project.id}`;
  return (
    <div className="space-y-6">
      <Card title="Project overview">
        <p className="text-sm text-muted">{project.description || "Your repositories, builds and production apps in one place."}</p>
        <dl className="mt-4 flex flex-wrap gap-x-10 gap-y-3 text-sm">
          <div><dt className="text-xs text-muted">Project</dt><dd className="font-mono">{project.slug}</dd></div>
          <div><dt className="text-xs text-muted">Created</dt><dd>{formatDate(project.created_at)}</dd></div>
          <div><dt className="text-xs text-muted">Your role</dt><dd>{ROLE_LABELS[project.my_role]}</dd></div>
        </dl>
      </Card>
      <section aria-labelledby="apps-heading" className="space-y-3">
        <h2 id="apps-heading" className="flex items-center gap-2 text-lg font-semibold"><Rocket className="size-4" /> Apps</h2>
        <DeploysTab />
      </section>
      <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-4 text-sm text-muted">
        <span className="inline-flex items-center gap-2"><GitBranch className="size-4" /> Push to your production branch to publish an update.</span>
        <Link to={`${base}/members`} className="inline-flex items-center gap-2 text-accent hover:underline"><Users className="size-4" /> Manage team</Link>
      </div>
    </div>
  );
}
