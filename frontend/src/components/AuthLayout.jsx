import NovaHubLogo from "./NovaHubLogo.jsx";
import ThemeSelector from "./ThemeSelector.jsx";

function AuthLayout({ title, description, children, footer }) {
  return (
    <main className="app-shell flex items-center px-4 py-8 sm:px-6 sm:py-12">
      <div className="page-enter mx-auto grid w-full max-w-5xl grid-cols-[minmax(0,1fr)] items-center gap-8 lg:grid-cols-[minmax(0,1fr)_28rem] lg:gap-16">
        <section className="min-w-0 max-w-xl" aria-labelledby="auth-brand-heading">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <NovaHubLogo showTagline />
            <ThemeSelector />
          </div>

          <div className="mt-8 sm:mt-10">
            <p className="eyebrow">
              Clear work. Better conversations.
            </p>
            <h1
              id="auth-brand-heading"
              className="text-heading mt-3 max-w-lg text-3xl font-semibold tracking-[-0.035em] sm:text-4xl"
            >
              Keep teamwork focused and every conversation in context.
            </h1>
            <p className="text-muted mt-4 max-w-lg text-base leading-7">
              NovaHub gives teams a calm place to organize workspaces and
              collaborate in real time.
            </p>
          </div>
        </section>

        <section
          className="surface-panel min-w-0 w-full max-w-md justify-self-center p-6 sm:p-8 lg:justify-self-end"
          aria-labelledby="auth-form-heading"
        >
          <p className="eyebrow">
            NovaHub account
          </p>
          <h2
            id="auth-form-heading"
            className="text-heading mt-2 text-2xl font-semibold tracking-[-0.025em]"
          >
            {title}
          </h2>
          <p className="text-muted mt-2 text-sm leading-6">{description}</p>

          {children}

          <div className="border-theme text-muted mt-6 border-t pt-5 text-center text-sm">
            {footer}
          </div>
        </section>
      </div>
    </main>
  );
}

export default AuthLayout;
