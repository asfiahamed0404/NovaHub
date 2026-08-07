import { useEffect } from "react";

import api from "../api/axios.js";

function WorkspaceList({workspaces,setWorkspaces,}) {

  useEffect(() => {
    const fetchWorkspaces = async () => {
      try {
        const response = await api.get("/workspaces");

        //console.log("Workspace response:", response.data);
        setWorkspaces(response.data.workspaces);
      } catch (error) {
        console.error(
          "Failed to fetch workspaces:",
          error.response?.data || error.message
        );
      }
    };

    fetchWorkspaces();
  }, []);

  return (
  <div className="mt-6">
    <h2 className="text-xl font-semibold">
      My Workspaces
    </h2>

    <p className="mt-2 text-slate-400">
      Workspace count: {workspaces.length}
    </p>

    <div className="mt-4 space-y-3">
      {workspaces.length === 0 && (
        <p className="mt-4 text-slate-500">
          You don't have any workspaces yet.
        </p>
      )}

      {workspaces.map((workspace) => (
        <div
          key={workspace._id}
          className="rounded-xl border border-slate-800 bg-slate-900 p-4"
        >
          <h3 className="font-semibold">
            {workspace.name}
          </h3>
        </div>
      ))}
    </div>
  </div>
);
}

export default WorkspaceList;