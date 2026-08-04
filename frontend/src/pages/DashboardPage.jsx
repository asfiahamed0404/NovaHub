function DashboardPage({ user }) {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 bg-slate-900 px-6 py-4">
        <h1 className="text-2xl font-bold">NovaHub</h1>
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
      </main>
    </div>
  );
}

export default DashboardPage;