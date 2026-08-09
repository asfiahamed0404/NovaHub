function NovaHubLogo({ showTagline = false }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span
        className="brand-mark flex size-9 shrink-0 items-center justify-center rounded-[10px]"
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 36 36"
          className="size-9"
          fill="none"
        >
          <path
            d="M10 24V12l8 8 8-8v12"
            stroke="white"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="10" cy="10" r="2" fill="#BFDBFE" />
          <circle cx="26" cy="10" r="2" fill="#BFDBFE" />
          <circle cx="18" cy="20" r="2" fill="white" />
          <circle cx="10" cy="26" r="2" fill="#BFDBFE" />
          <circle cx="26" cy="26" r="2" fill="#BFDBFE" />
        </svg>
      </span>

      <span className="brand-copy min-w-0">
        <span className="brand-title block text-lg font-bold tracking-[-0.025em]">
          NovaHub
        </span>
        {showTagline && (
          <span className="brand-tagline block text-xs font-medium tracking-wide">
            Workspace collaboration
          </span>
        )}
      </span>
    </div>
  );
}

export default NovaHubLogo;
