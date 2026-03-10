import type { ConfigurationSession } from "../../lib/domain.js";

interface VanAssemblyProps {
  session?: ConfigurationSession | null;
}

function isComplete(session: ConfigurationSession | null | undefined, step: keyof ConfigurationSession["state"]) {
  if (!session) return false;
  return Object.keys(session.state[step] ?? {}).length > 0;
}

export function VanAssembly({ session }: VanAssemblyProps) {
  const showExterior = isComplete(session, "exterior");
  const showInterior = isComplete(session, "interior");
  const showLayout = isComplete(session, "layout");
  const showGear = isComplete(session, "gear");

  return (
    <div className="van-stage">
      <svg viewBox="0 0 520 260" className="van-svg" role="img" aria-label="Configuring van preview">
        <defs>
          <linearGradient id="van-shadow" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(0,0,0,0.12)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.02)" />
          </linearGradient>
        </defs>

        <ellipse cx="250" cy="208" rx="178" ry="22" fill="url(#van-shadow)" />
        <path
          className="van-body"
          d="M88 116c0-18 14-32 32-32h170c24 0 44 8 63 25l30 26c11 10 17 24 17 39v12H88v-70z"
        />
        <rect className="van-cabin" x="118" y="102" width="124" height="46" rx="14" />
        <rect className="van-window" x="256" y="106" width="54" height="40" rx="12" />
        <rect className="van-window" x="322" y="112" width="44" height="34" rx="10" />

        <circle className="van-wheel" cx="164" cy="196" r="26" />
        <circle className="van-wheel" cx="356" cy="196" r="26" />
        <circle className="van-wheel-core" cx="164" cy="196" r="10" />
        <circle className="van-wheel-core" cx="356" cy="196" r="10" />

        <rect className={`van-feature ${showExterior ? "visible" : ""}`} x="82" y="154" width="34" height="10" rx="5" />
        <rect className={`van-feature ${showInterior ? "visible" : ""}`} x="204" y="162" width="72" height="12" rx="6" />
        <rect className={`van-feature ${showLayout ? "visible" : ""}`} x="286" y="162" width="92" height="12" rx="6" />
        <rect className={`van-feature ${showGear ? "visible" : ""}`} x="392" y="132" width="34" height="54" rx="10" />
      </svg>

      <div className="van-captions">
        <span className={showExterior ? "complete" : ""}>Exterior</span>
        <span className={showInterior ? "complete" : ""}>Interior</span>
        <span className={showLayout ? "complete" : ""}>Layout</span>
        <span className={showGear ? "complete" : ""}>Gear</span>
      </div>
    </div>
  );
}

