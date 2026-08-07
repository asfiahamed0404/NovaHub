import { useEffect, useState } from "react";
import { Link } from "react-router";

import api from "../api/axios.js";

function WorkspaceList({workspaces,setWorkspaces,}) {

  // useEffect(() => {
  //   const fetchWorkspaces = async () => {
  //     try {
  //       const response = await api.get("/workspaces");

  //       //console.log("Workspace response:", response.data);
  //       setWorkspaces(response.data.workspaces);
  //     } catch (error) {
  //       console.error(
  //         "Failed to fetch workspaces:",
  //         error.response?.data || error.message
  //       );
  //     }
  //   };

  //   fetchWorkspaces();
  // }, []);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchWorkspaces = async () => {
      try {
        setError("");
        setIsLoading(true);

        const response = await api.get("/workspaces");

        setWorkspaces(response.data.workspaces);

      } catch (error) {
        setError(
          error.response?.data?.message ||
            "Failed to load workspaces."
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchWorkspaces();
  }, [setWorkspaces]);

  return (
    <div className="mt-6">
      <h2 className="text-xl font-semibold">
        My Workspaces
      </h2>

      {!isLoading && !error && (
        <p className="mt-2 text-slate-400">
          Workspace count:{" "}
          {workspaces.length}
        </p>
      )}

      {isLoading && (
        <p className="mt-4 text-slate-400">
          Loading workspaces...
        </p>
      )}

      {error && (
        <p className="mt-4 text-sm text-red-400">
          {error}
        </p>
      )}

      {!isLoading &&
        !error &&
        workspaces.length === 0 && (
          <p className="mt-4 text-slate-500">
            You don't have any workspaces yet.
          </p>
        )}

      {!isLoading && !error && (
        <div className="mt-4 space-y-3">
          {workspaces.map((workspace) => (
            // <div
            //   key={workspace._id}
            //   className="rounded-xl border border-slate-800 bg-slate-900 p-4"
            // >
            //   <h3 className="font-semibold">
            //     {workspace.name}
            //   </h3>
            // </div>
            <Link
              key={workspace._id}
              to={`/workspaces/${workspace._id}`}
              className="block rounded-xl border border-slate-800 bg-slate-900 p-4 hover:border-slate-700"
            >
              <h3 className="font-semibold">
                {workspace.name}
              </h3>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default WorkspaceList;