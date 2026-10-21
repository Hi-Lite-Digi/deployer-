import { createBrowserRouter, Link, RouterProvider, useRouteError } from "react-router-dom";
import { RedirectIfAuthed, RequireAuth, RequireInstanceOwner, SetupGate } from "./auth/guards";
import { AppLayout, AuthShell } from "./components/layout/AppLayout";
import { EmptyState, ErrorState } from "./components/ui/States";
import { AuthCompletePage } from "./features/auth/AuthCompletePage";
import { InvitePage } from "./features/auth/InvitePage";
import { LoginPage } from "./features/auth/LoginPage";
import { SignupPage } from "./features/auth/SignupPage";
import { AppPage } from "./features/deploys/AppPage";
import { DeploysTab } from "./features/deploys/DeploysTab";
import { GitHubDonePage } from "./features/deploys/GitHubConnect";
import { MembersTab } from "./features/projects/MembersTab";
import { OverviewTab } from "./features/projects/OverviewTab";
import { ProjectLayout } from "./features/projects/ProjectLayout";
import { ProjectSettingsTab } from "./features/projects/ProjectSettingsTab";
import { ProjectsPage } from "./features/projects/ProjectsPage";
import { AccountSettingsPage } from "./features/settings/AccountSettingsPage";
import { CloudAccountsPage } from "./features/settings/CloudAccountsPage";
import { InstanceSettingsPage } from "./features/settings/InstanceSettingsPage";
import { MonitoringPage } from "./features/monitoring/MonitoringPage";
import { RemoteAccessPage } from "./features/remote-access/RemoteAccessPage";
import { SetupWizard } from "./features/setup/SetupWizard";

function RouteError() {
  const error = useRouteError();
  return (
    <AuthShell wide>
      <ErrorState title="Something went wrong" error={error} onRetry={() => window.location.reload()} />
    </AuthShell>
  );
}

function NotFound() {
  return (
    <EmptyState
      title="Page not found"
      description="The page you're looking for doesn't exist."
      action={
        <Link to="/" className="text-sm font-medium text-accent hover:underline">
          Back to projects
        </Link>
      }
    />
  );
}

const router = createBrowserRouter([
  {
    element: <SetupGate />,
    errorElement: <RouteError />,
    children: [
      { path: "/setup", element: <SetupWizard /> },
      {
        path: "/login",
        element: (
          <RedirectIfAuthed>
            <LoginPage />
          </RedirectIfAuthed>
        ),
      },
      {
        path: "/signup",
        element: (
          <RedirectIfAuthed>
            <SignupPage />
          </RedirectIfAuthed>
        ),
      },
      { path: "/auth/complete", element: <AuthCompletePage /> },
      { path: "/invite/:token", element: <InvitePage /> },
      {
        element: <RequireAuth />,
        children: [
          // Back from GitHub's authorize page (docs/DEPLOYMENTS.md "Connect a Git repository").
          { path: "/integrations/github/done", element: <GitHubDonePage /> },
          {
            element: <AppLayout />,
            children: [
              { index: true, element: <ProjectsPage /> },
              {
                path: "/projects/:projectId",
                element: <ProjectLayout />,
                children: [
                  { index: true, element: <OverviewTab /> },
                  { path: "deploys", element: <DeploysTab /> },
                  { path: "deploys/:appId", element: <AppPage /> },
                  { path: "members", element: <MembersTab /> },
                  { path: "settings", element: <ProjectSettingsTab /> },
                ],
              },
              { path: "/settings/account", element: <AccountSettingsPage /> },
              {
                path: "/settings/instance",
                element: (
                  <RequireInstanceOwner>
                    <InstanceSettingsPage />
                  </RequireInstanceOwner>
                ),
              },
              {
                path: "/settings/remote-access",
                element: (
                  <RequireInstanceOwner>
                    <RemoteAccessPage />
                  </RequireInstanceOwner>
                ),
              },
              {
                path: "/settings/cloud",
                element: (
                  <RequireInstanceOwner>
                    <CloudAccountsPage />
                  </RequireInstanceOwner>
                ),
              },
              {
                path: "/settings/monitoring",
                element: (
                  <RequireInstanceOwner>
                    <MonitoringPage />
                  </RequireInstanceOwner>
                ),
              },
              { path: "*", element: <NotFound /> },
            ],
          },
        ],
      },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
