import { formatAdminNumber } from "../utils/adminFormat.js";

function AdminPageHeader({
  eyebrow,
  title,
  description,
  actions,
  headingRef,
}) {
  return (
    <header className="border-theme flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 max-w-3xl">
        <p className="eyebrow">{eyebrow}</p>
        <h1
          ref={headingRef}
          tabIndex={headingRef ? -1 : undefined}
          className="text-heading mt-2 break-words text-3xl font-semibold tracking-[-0.035em] sm:text-4xl"
        >
          {title}
        </h1>
        {description && (
          <p className="text-muted mt-3 text-sm leading-6 sm:text-base">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </header>
  );
}

function AdminLoading({ label = "Loading admin data...", rows = 4 }) {
  return (
    <div
      className="surface-panel mt-6 p-5 sm:p-6"
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">{label}</span>
      <div className="space-y-3" aria-hidden="true">
        {Array.from({ length: rows }, (_, index) => (
          <div
            key={index}
            className="surface-subtle grid gap-3 p-4 sm:grid-cols-[minmax(0,1.5fr)_minmax(7rem,0.75fr)_6rem]"
          >
            <div>
              <div className="skeleton h-4 w-2/3" />
              <div className="skeleton mt-2 h-3 w-1/2" />
            </div>
            <div className="skeleton h-4 w-3/4" />
            <div className="skeleton h-9 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminInlineLoading({ label = "Loading..." }) {
  return (
    <div
      className="text-muted flex min-h-40 items-center justify-center gap-3 text-sm"
      role="status"
      aria-live="polite"
    >
      <span className="spinner text-accent" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

function AdminError({ message, onRetry }) {
  return (
    <section
      className="surface-panel mt-6 max-w-3xl p-5 sm:p-6"
      aria-labelledby="admin-error-heading"
    >
      <p className="eyebrow">Admin data unavailable</p>
      <h2
        id="admin-error-heading"
        className="text-heading mt-2 text-lg font-semibold"
      >
        We couldn&apos;t load this section
      </h2>
      <p className="feedback feedback-error mt-4" role="alert">
        {message}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="button button-secondary mt-4"
        >
          Try again
        </button>
      )}
    </section>
  );
}

function AdminEmpty({ title, description }) {
  return (
    <div className="surface-subtle px-5 py-10 text-center">
      <span
        className="accent-tile mx-auto flex size-10 items-center justify-center rounded-[10px] text-lg font-semibold"
        aria-hidden="true"
      >
        N
      </span>
      <h2 className="text-heading mt-4 font-semibold">{title}</h2>
      <p className="text-muted mx-auto mt-2 max-w-md text-sm leading-6">
        {description}
      </p>
    </div>
  );
}

function AdminBadge({ children, tone = "neutral" }) {
  return (
    <span className={`admin-badge admin-badge-${tone}`}>
      {children}
    </span>
  );
}

function AdminPagination({ pagination, onPageChange, disabled = false }) {
  const { page, pages, total, limit } = pagination;
  const firstItem = total === 0 ? 0 : (page - 1) * limit + 1;
  const lastItem = Math.min(total, page * limit);

  return (
    <nav
      className="border-theme flex flex-col gap-3 border-t px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"
      aria-label="Pagination"
    >
      <p className="text-muted text-sm">
        Showing {formatAdminNumber(firstItem)}–
        {formatAdminNumber(lastItem)} of {formatAdminNumber(total)}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="button button-secondary min-h-10 px-3"
          onClick={() => onPageChange(page - 1)}
          disabled={disabled || page <= 1}
        >
          Previous
        </button>
        <span className="text-body min-w-20 text-center text-sm font-medium">
          Page {page} of {pages}
        </span>
        <button
          type="button"
          className="button button-secondary min-h-10 px-3"
          onClick={() => onPageChange(page + 1)}
          disabled={disabled || page >= pages}
        >
          Next
        </button>
      </div>
    </nav>
  );
}

function AdminDefinitionList({ items }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {items.map(({ label, value }) => (
        <div key={label} className="surface-subtle min-w-0 p-3">
          <dt className="text-muted text-xs font-semibold uppercase tracking-wide">
            {label}
          </dt>
          <dd className="text-body mt-1 break-words text-sm font-medium">
            {value ?? "Not available"}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export {
  AdminBadge,
  AdminDefinitionList,
  AdminEmpty,
  AdminError,
  AdminInlineLoading,
  AdminLoading,
  AdminPageHeader,
  AdminPagination,
};
