function IconFrame({ children, className = "size-4" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

function ArrowLeftIcon({ className }) {
  return (
    <IconFrame className={className}>
      <path d="m15 18-6-6 6-6" />
      <path d="M9 12h10" />
    </IconFrame>
  );
}

function ArrowRightIcon({ className }) {
  return (
    <IconFrame className={className}>
      <path d="m9 18 6-6-6-6" />
      <path d="M5 12h10" />
    </IconFrame>
  );
}

function LogoutIcon({ className }) {
  return (
    <IconFrame className={className}>
      <path d="M10 17l5-5-5-5" />
      <path d="M15 12H3" />
      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
    </IconFrame>
  );
}

function SendIcon({ className }) {
  return (
    <IconFrame className={className}>
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </IconFrame>
  );
}

function UsersIcon({ className }) {
  return (
    <IconFrame className={className}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </IconFrame>
  );
}

function MessageIcon({ className }) {
  return (
    <IconFrame className={className}>
      <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" />
    </IconFrame>
  );
}

function PlusIcon({ className }) {
  return (
    <IconFrame className={className}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </IconFrame>
  );
}

function SunIcon({ className }) {
  return (
    <IconFrame className={className}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.42 1.42" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </IconFrame>
  );
}

function MoonIcon({ className }) {
  return (
    <IconFrame className={className}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
    </IconFrame>
  );
}

function MonitorIcon({ className }) {
  return (
    <IconFrame className={className}>
      <rect x="3" y="4" width="18" height="13" rx="2" />
      <path d="M8 21h8" />
      <path d="M12 17v4" />
    </IconFrame>
  );
}

export {
  ArrowLeftIcon,
  ArrowRightIcon,
  LogoutIcon,
  MessageIcon,
  MonitorIcon,
  MoonIcon,
  PlusIcon,
  SendIcon,
  SunIcon,
  UsersIcon,
};
