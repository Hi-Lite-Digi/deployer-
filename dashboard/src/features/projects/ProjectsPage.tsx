import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FolderPlus, Plus } from "lucide-react";
import { errorMessage } from "../../api/client";
import { api, qk } from "../../api/endpoints";
import { useProjects } from "../../api/hooks";
import type { Project } from "../../api/types";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Dialog } from "../../components/ui/Dialog";
import { Field, Input, Textarea } from "../../components/ui/Input";
import { PageSpinner } from "../../components/ui/Spinner";
import { Alert, EmptyState, ErrorState, PageHeader } from "../../components/ui/States";
import { useToast } from "../../components/ui/toast-context";
import { relativeTime } from "../../lib/format";
import { ROLE_LABELS } from "../../lib/roles";

export function ProjectsPage() {
  const projects = useProjects();
  const [creating, setCreating] = useState(false);

  return (
    <>
      <PageHeader
        title="Projects"
        description="Connect repositories, deploy apps and manage your team."
        actions={
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
            New project
          </Button>
        }
      />
      {projects.isPending ? (
        <PageSpinner />
      ) : projects.isError ? (
        <ErrorState error={projects.error} onRetry={() => void projects.refetch()} />
      ) : projects.data.length === 0 ? (
        <EmptyState
          icon={<FolderPlus className="size-5" />}
          title="No projects yet"
          description="Create a project, import a GitHub repository and deploy your first app."
          action={
            <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
              Create your first project
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.data.map((p) => (
            <li key={p.id}>
              <ProjectCard project={p} />
            </li>
          ))}
        </ul>
      )}
      <NewProjectDialog open={creating} onClose={() => setCreating(false)} />
    </>
  );
}

function ProjectCard({ project }: { project: Project }) {
  return (
    <Link
      to={`/projects/${project.id}`}
      className="flex h-full flex-col rounded-xl border border-border bg-surface p-4 shadow-xs transition-colors hover:border-accent"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate font-semibold">{project.name}</h2>
          <p className="truncate font-mono text-xs text-muted">{project.slug}</p>
        </div>
        <Badge tone={project.my_role === "owner" ? "accent" : "neutral"}>{ROLE_LABELS[project.my_role]}</Badge>
      </div>
      <p className="mt-2 line-clamp-2 flex-1 text-sm text-muted">{project.description || "No description"}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted">
        <span className="ml-auto">Updated {relativeTime(project.updated_at)}</span>
      </div>
    </Link>
  );
}

function NewProjectDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return <NewProjectForm onClose={onClose} />;
}

function NewProjectForm({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const create = useMutation({
    mutationFn: api.projects.create,
    onSuccess: (project) => {
      queryClient.setQueryData<Project[]>(qk.projects, (list) => (list ? [project, ...list] : [project]));
      toast.success(`Project “${project.name}” created.`);
      onClose();
      navigate(`/projects/${project.id}/deploys?new=1`);
    },
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
    });
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title="New project"
      description="Give your apps a home. Connect a repository in the next step."
      dismissible={!create.isPending}
      footer={
        <>
          <Button onClick={onClose} disabled={create.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="new-project" variant="primary" loading={create.isPending} disabled={!name.trim()}>
            Create project
          </Button>
        </>
      }
    >
      <form id="new-project" className="space-y-4" onSubmit={onSubmit}>
        <Field label="Name">
          {(id) => (
            <Input id={id} required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
          )}
        </Field>
        <Field label="Description" optional>
          {(id) => (
            <Textarea
              id={id}
              rows={2}
              className="min-h-16"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          )}
        </Field>
        {create.error && <Alert tone="danger">{errorMessage(create.error)}</Alert>}
      </form>
    </Dialog>
  );
}
