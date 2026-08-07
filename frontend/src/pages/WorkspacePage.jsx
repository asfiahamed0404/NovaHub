import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router";
import { useAuth } from "../context/AuthContext.jsx";

import api from "../api/axios.js";

function WorkspacePage() {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  
  const { user } = useAuth();
  //const isCreator = user.id === workspace?.createdBy?._id;

  const [workspace, setWorkspace] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const [isLeaving, setIsLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState("");

  useEffect(() => {
    const fetchWorkspace = async () => {
      try {
        setError("");
        setIsLoading(true);

        const response = await api.get(
          `/workspaces/${workspaceId}`
        );

        setWorkspace(response.data.workspace);
      } catch (error) {
        setError(
          error.response?.data?.message ||
            "Failed to load workspace."
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchWorkspace();
  }, [workspaceId]);

  const handleLeaveWorkspace = async () => {
    try {
      setLeaveError("");
      setIsLeaving(true);

      await api.delete(
        `/workspaces/${workspaceId}/leave`
      );

      navigate("/dashboard");
    } catch (error) {
      setLeaveError(
        error.response?.data?.message ||
          "Failed to leave workspace."
      );
    } finally {
      setIsLeaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 px-6 py-10 text-white">
        <div className="mx-auto max-w-4xl">
          <p className="text-slate-400">
            Loading workspace...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 px-6 py-10 text-white">
        <div className="mx-auto max-w-4xl">
          <Link
            to="/dashboard"
            className="text-sm text-blue-400 hover:text-blue-300"
          >
            ← Back to Dashboard
          </Link>

          <p className="mt-6 text-red-400">
            {error}
          </p>
        </div>
      </div>
    );
  }

  const isCreator = user.id === workspace.createdBy._id;

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-4xl">
        <Link
          to="/dashboard"
          className="text-sm text-blue-400 hover:text-blue-300"
        >
          ← Back to Dashboard
        </Link>

        <h1 className="mt-4 text-3xl font-bold">
          {workspace.name}
        </h1>

        <p className="mt-3 text-slate-400">
          {workspace.description ||
            "No description yet."}
        </p>

        <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-slate-300">
            Created by: {workspace.createdBy.name}
          </p>

          <p className="mt-2 text-slate-300">
            Members: {workspace.members.length}
          </p>
        </div>

        {!isCreator && (
          <div className="mt-6">
            <button
              type="button"
              onClick={handleLeaveWorkspace}
              disabled={isLeaving}
              className="rounded-lg border border-red-500 px-4 py-2 text-red-400 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLeaving
                ? "Leaving..."
                : "Leave Workspace"}
            </button>

            {leaveError && (
              <p className="mt-3 text-sm text-red-400">
                {leaveError}
              </p>
            )}
          </div>
        )}

        <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="text-xl font-semibold">
            Members
          </h2>

          <div className="mt-4 space-y-3">
            {workspace.members.map((member) => (
              <div
                key={member._id}
                className="flex items-center justify-between rounded-lg bg-slate-950 p-4"
              >
                <div>
                  <p className="font-medium">
                    {member.name}
                  </p>

                  <p className="mt-1 text-sm text-slate-400">
                    {member.email}
                  </p>
                </div>

                <p className="text-sm text-slate-400">
                  {member.status}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default WorkspacePage;