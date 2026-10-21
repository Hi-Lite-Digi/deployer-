import type { AppPreset } from "../../api/types";
import { Checkbox, Field, Input, Select } from "../../components/ui/Input";
import { TargetChooser } from "./TargetChooser";
import { FIELD_LABELS, PRESETS, REQUIRED_FIELDS, slugify, type AppDraft } from "./deploys";

const PRESET_ORDER: AppPreset[] = ["static", "node", "python", "dockerfile"];

/** `owner/repo` of a GitHub https URL, for the token instructions; null when it isn't one. */
function githubRepo(url: string): string | null {
  const m = /^https:\/\/github\.com\/([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/i.exec(url.trim());
  return m ? `${m[1]}/${m[2]}` : null;
}

/** Step-by-step for a read-only fine-grained token limited to this one repository. */
function RepoTokenSteps({ repoUrl }: { repoUrl: string }) {
  const repo = githubRepo(repoUrl);
  const link = "https://github.com/settings/personal-access-tokens/new";
  return (
    <div className="rounded-xl border border-border bg-surface-2 p-3 text-sm">
      <p className="font-medium">How to create the token (about 1 minute)</p>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted">
        <li>
          Open{" "}
          <a href={link} target="_blank" rel="noreferrer" className="font-medium text-accent hover:underline">
            GitHub → Fine-grained personal access tokens → Generate new token
          </a>{" "}
          (sign in as the repository's owner, or someone with access).
        </li>
        <li>
          <span className="text-fg">Token name:</span> e.g. “Deployer {repo ?? "deploy"}”. <span className="text-fg">Expiration:</span> pick
          a date you'll remember — when it expires, deploys fail until you paste a new one here.
        </li>
        <li>
          <span className="text-fg">Resource owner:</span> the account or organisation that owns the repository.{" "}
          <span className="text-fg">Repository access:</span> <em>Only select repositories</em> →{" "}
          {repo ? <code className="font-mono text-fg">{repo}</code> : "your repository"}.
        </li>
        <li>
          <span className="text-fg">Permissions → Repository permissions → Contents:</span> <em>Read-only</em>. Leave everything else at{" "}
          <em>No access</em> (Metadata: Read-only is added automatically).
        </li>
        <li>
          Click <span className="text-fg">Generate token</span>, copy it (GitHub shows it once) and paste it below. Deployer stores it encrypted
          and only uses it to clone.
        </li>
      </ol>
    </div>
  );
}

/** All app fields except env (edited separately); shared by the New app dialog and Settings. */
export function AppFormFields({
  projectId,
  draft,
  errors,
  onChange,
  isAdmin,
  disabled = false,
  hasRepoToken = false,
  showSlug = true,
  hideRepoAccess = false,
}: {
  projectId: string;
  draft: AppDraft;
  errors: Partial<Record<keyof AppDraft, string>>;
  onChange: (patch: Partial<AppDraft>) => void;
  isAdmin: boolean;
  disabled?: boolean;
  /** Settings: a token is stored, so the field is optional ("leave blank to keep"). */
  hasRepoToken?: boolean;
  showSlug?: boolean;
  /** Cloned through the creator's GitHub connection: no private-repository/token fields. */
  hideRepoAccess?: boolean;
}) {
  const preset = PRESETS[draft.preset];
  const required = new Set(REQUIRED_FIELDS[draft.preset] ?? []);
  const slug = slugify(draft.name);

  return (
    <div className="space-y-4">
      <Field
        label="Name"
        error={errors.name}
        hint={showSlug ? (slug ? <>Slug: <code className="font-mono">{slug}</code> — used for container and image names.</> : "Letters and digits become the slug.") : undefined}
      >
        {(id) => <Input id={id} value={draft.name} onChange={(e) => onChange({ name: e.target.value })} placeholder="My shop" disabled={disabled} data-autofocus />}
      </Field>

      <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
        <Field label="Repository URL" error={errors.repo_url} hint="A GitHub https:// URL; SSH URLs are not supported.">
          {(id) => (
            <Input id={id} value={draft.repo_url} onChange={(e) => onChange({ repo_url: e.target.value })} placeholder="https://github.com/you/repo" disabled={disabled} spellCheck={false} />
          )}
        </Field>
        <Field label="Branch" error={errors.branch}>
          {(id) => <Input id={id} value={draft.branch} onChange={(e) => onChange({ branch: e.target.value })} disabled={disabled} spellCheck={false} />}
        </Field>
      </div>

      {!hideRepoAccess && (
        <Checkbox
          label="Private repository"
          description="Deployer clones with a GitHub fine-grained token (Repository permissions → Contents: Read). It is stored encrypted and never logged."
          checked={draft.private_repo}
          onChange={(e) => onChange({ private_repo: e.target.checked })}
          disabled={disabled}
        />
      )}
      {!hideRepoAccess && draft.private_repo && (
        <>
          <RepoTokenSteps repoUrl={draft.repo_url} />
          <Field label="GitHub token" optional={hasRepoToken} hint={hasRepoToken ? "A token is stored. Leave blank to keep it." : undefined}>
            {(id) => (
              <Input id={id} type="password" value={draft.repo_token} onChange={(e) => onChange({ repo_token: e.target.value })} placeholder="github_pat_…" autoComplete="off" disabled={disabled} />
            )}
          </Field>
        </>
      )}

      <Field label="Preset" hint={preset.description}>
        {(id) => (
          <Select id={id} value={draft.preset} onChange={(e) => onChange({ preset: e.target.value as AppPreset })} disabled={disabled}>
            {PRESET_ORDER.map((p) => (
              <option key={p} value={p}>
                {PRESETS[p].label}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        {preset.fields.map((f) => (
          <Field key={f} label={FIELD_LABELS[f].label} optional={!required.has(f)} error={errors[f]} hint={FIELD_LABELS[f].hint}>
            {(id) => (
              <Input
                id={id}
                value={draft[f]}
                onChange={(e) => onChange({ [f]: e.target.value })}
                placeholder={preset.placeholders[f]}
                inputMode={f === "container_port" ? "numeric" : undefined}
                className="font-mono text-sm"
                spellCheck={false}
                disabled={disabled}
              />
            )}
          </Field>
        ))}
        <Field label="Root directory" optional hint="Folder inside the repository to build from (monorepos).">
          {(id) => <Input id={id} value={draft.root_dir} onChange={(e) => onChange({ root_dir: e.target.value })} placeholder="." className="font-mono text-sm" spellCheck={false} disabled={disabled} />}
        </Field>
      </div>

      <TargetChooser projectId={projectId} draft={draft} onChange={onChange} isAdmin={isAdmin} error={errors.target} disabled={disabled} />

      <p className="text-xs text-muted">Pushes to the selected branch automatically build and deploy your app. Connect external services using environment variables.</p>
    </div>
  );
}
