import { useAuth } from "../context/AuthContext.jsx";
import WorkspaceList from "../components/WorkspaceList.jsx";
import CreateWorkspaceForm from "../components/CreateWorkspaceForm.jsx";
import { useState } from "react";
import JoinWorkspaceForm from "../components/JoinWorkspaceForm.jsx";

function DashboardPage() {
  const { user, logout } = useAuth();
  const [workspaces, setWorkspaces] = useState([]);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 bg-slate-900 px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <h1 className="text-2xl font-bold">
            NovaHub
          </h1>

          <button
            type="button"
            onClick={logout}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-2xl font-semibold">
            Welcome, {user.name}
          </h2>

          <p className="mt-2 text-slate-400">
            You successfully logged in to NovaHub.
          </p>

          <div className="mt-6 rounded-xl bg-slate-950 p-4">
            <p className="text-slate-300">
              Email: {user.email}
            </p>

            <p className="mt-2 text-slate-300">
              Status: {user.status}
            </p>
          </div>
        </div>

        <CreateWorkspaceForm
          onWorkspaceCreated={(newWorkspace) => {
            setWorkspaces((currentWorkspaces) => [
              ...currentWorkspaces,
              newWorkspace,
            ]);
          }}
        />

        <JoinWorkspaceForm
          onWorkspaceJoined={(joinedWorkspace) => {
            setWorkspaces((currentWorkspaces) => [
              ...currentWorkspaces,
              joinedWorkspace,
            ]);
          }}
        />
        
        <WorkspaceList
          workspaces={workspaces}
          setWorkspaces={setWorkspaces}
        />
      </main>
    </div>
  );
}

export default DashboardPage;