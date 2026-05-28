interface LogoProps {
  size?: number;
  className?: string;
}

export default function Logo({ size = 40, className = "" }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="lg1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#3b82f6" />
        </linearGradient>
        <linearGradient id="lg2" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Shield outer */}
      <path
        d="M50 2L8 22v24c0 26 16.5 43.8 42 56 25.5-12.2 42-30 42-56V22L50 2z"
        fill="#111"
        stroke="rgba(255,255,255,0.2)"
        strokeWidth="1.5"
      />
      <path
        d="M50 6L14 24v22c0 23.8 14.8 40 36 51.2 21.2-11.2 36-27.4 36-51.2V24L50 6z"
        fill="rgba(255,255,255,0.03)"
        stroke="url(#lg1)"
        strokeWidth="1.2"
      />

      {/* Eye socket */}
      <ellipse cx="50" cy="42" rx="16" ry="12" fill="#080808" stroke="rgba(255,255,255,0.25)" strokeWidth="1" />

      {/* Iris */}
      <ellipse cx="50" cy="42" rx="10" ry="7.5" fill="url(#lg2)" stroke="url(#lg1)" strokeWidth="1.2" />

      {/* Pupil */}
      <circle cx="50" cy="42" r="4" fill="#e8e8e8" />

      {/* Highlight */}
      <ellipse cx="47" cy="39" rx="2.5" ry="1.5" fill="white" opacity="0.5" />

      {/* Scan line */}
      <line x1="34" y1="42" x2="66" y2="42" stroke="url(#lg1)" strokeWidth="0.5" opacity="0.5" strokeDasharray="1.5 2.5" />

      {/* Data nodes left */}
      <circle cx="22" cy="26" r="1.5" fill="url(#lg1)" />
      <path d="M22 26q-4 8-1 18" stroke="rgba(255,255,255,0.15)" strokeWidth="1" fill="none" />
      <circle cx="20" cy="44" r="1" fill="rgba(255,255,255,0.2)" />

      {/* Data nodes right */}
      <circle cx="78" cy="26" r="1.5" fill="url(#lg1)" />
      <path d="M78 26q4 8 1 18" stroke="rgba(255,255,255,0.15)" strokeWidth="1" fill="none" />
      <circle cx="80" cy="44" r="1" fill="rgba(255,255,255,0.2)" />

      {/* Terminal lines */}
      <line x1="37" y1="72" x2="37" y2="84" stroke="rgba(255,255,255,0.2)" strokeWidth="0.8" />
      <line x1="50" y1="76" x2="50" y2="88" stroke="url(#lg1)" strokeWidth="1" />
      <line x1="63" y1="72" x2="63" y2="84" stroke="rgba(255,255,255,0.2)" strokeWidth="0.8" />
      <line x1="37" y1="78" x2="63" y2="78" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />

      {/* Terminal dots */}
      <circle cx="37" cy="72" r="1" fill="rgba(255,255,255,0.15)" />
      <circle cx="50" cy="76" r="1.2" fill="url(#lg1)" />
      <circle cx="63" cy="72" r="1" fill="rgba(255,255,255,0.15)" />
    </svg>
  );
}
