export function iconProps(className = "shrink-0") {
  return {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none" as const,
    "aria-hidden": true as const,
    className,
  };
}

export function ProfileIcon() {
  return (
    <svg {...iconProps()}>
      <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M5.5 19.2c.8-3.2 3.3-5 6.5-5s5.7 1.8 6.5 5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function PlanIcon() {
  return (
    <svg {...iconProps()}>
      <rect
        x="4"
        y="6"
        width="16"
        height="12"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path d="M4 10.5h16" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M8 15h3.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function HistoryIcon() {
  return (
    <svg {...iconProps()}>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 8.2V12l2.6 1.7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function TopUpIcon() {
  return (
    <svg {...iconProps()}>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 8.4v7.2M8.4 12h7.2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function LogoutIcon() {
  return (
    <svg {...iconProps()}>
      <path
        d="M10 6.5H8.2A2.2 2.2 0 0 0 6 8.7v6.6A2.2 2.2 0 0 0 8.2 17.5H10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M10.5 12H18M15.2 9.2 18 12l-2.8 2.8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function RenewIcon() {
  return (
    <svg {...iconProps()}>
      <path
        d="M7.2 8.2A7 7 0 1 1 5 12"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M7.2 5.2v3.4H10.6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function UpgradeIcon() {
  return (
    <svg {...iconProps()}>
      <path
        d="M12 17.5V6.5M8.2 10.2 12 6.5l3.8 3.7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
