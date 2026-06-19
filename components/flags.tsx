// Small inline SVG flags (reliable across OSes, unlike emoji flags on Windows).

export function FlagUK({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 30" className={className} aria-hidden>
      <clipPath id="uk-clip">
        <rect width="60" height="30" rx="3" />
      </clipPath>
      <g clipPath="url(#uk-clip)">
        <rect width="60" height="30" fill="#012169" />
        <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
        <path d="M0,0 L60,30 M60,0 L0,30" stroke="#C8102E" strokeWidth="4" />
        <path d="M30,0 V30 M0,15 H60" stroke="#fff" strokeWidth="10" />
        <path d="M30,0 V30 M0,15 H60" stroke="#C8102E" strokeWidth="6" />
      </g>
    </svg>
  );
}

export function FlagUZ({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 30" className={className} aria-hidden>
      <clipPath id="uz-clip">
        <rect width="60" height="30" rx="3" />
      </clipPath>
      <g clipPath="url(#uz-clip)">
        <rect width="60" height="30" fill="#fff" />
        <rect width="60" height="9.5" fill="#0099B5" />
        <rect width="60" height="9.5" y="20.5" fill="#1EB53A" />
        <rect width="60" height="1.2" y="9.5" fill="#CE1126" />
        <rect width="60" height="1.2" y="19.3" fill="#CE1126" />
        <circle cx="9" cy="5" r="3" fill="#fff" />
        <circle cx="10.8" cy="5" r="3" fill="#0099B5" />
      </g>
    </svg>
  );
}

export function FlagRU({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 30" className={className} aria-hidden>
      <clipPath id="ru-clip">
        <rect width="60" height="30" rx="3" />
      </clipPath>
      <g clipPath="url(#ru-clip)">
        <rect width="60" height="10" fill="#fff" />
        <rect width="60" height="10" y="10" fill="#0039A6" />
        <rect width="60" height="10" y="20" fill="#D52B1E" />
      </g>
    </svg>
  );
}
