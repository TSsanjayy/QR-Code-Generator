import "./Verdict.css";

/*
  Verdict pill, kept deliberately simple:
    scanning : a thin arc spins around a ring
    result   : the ring closes in one smooth stroke, then a check (or "!") draws inside it
  The text rises in once. Nothing else moves.
*/

type Props = {
  enabled: boolean;     // there is a valid payload
  scanning: boolean;    // a scan test is running
  settling?: boolean;   // the result just landed (plays one soft pulse)
  warns: number;        // number of warnings
  onClick: () => void;
  title?: string;
};

export function Verdict({ enabled, scanning, settling, warns, onClick, title }: Props) {
  const state = !enabled ? "idle" : scanning ? "testing" : warns ? "bad" : "good";
  const text = !enabled ? "Waiting" : scanning ? "Scanning" : warns ? `${warns} to check` : "Scans well";

  return (
    <button type="button" className={`vd ${state} ${settling ? "settle" : ""}`} disabled={!enabled} onClick={onClick} title={title} aria-live="polite">
      <svg key={state} className="vd-i" viewBox="0 0 24 24" aria-hidden="true">
        <circle className="trk" cx="12" cy="12" r="9.5" />
        <circle className="arc" cx="12" cy="12" r="9.5" pathLength="1" />
        {state === "good" && <path className="mk" d="M7.6 12.6l3 3 5.8-6.4" pathLength="1" />}
        {state === "bad" && <path className="mk" d="M12 7.5v5.5M12 16.6v.01" pathLength="1" />}
      </svg>
      <span className="vd-t" key={`${state}-${warns}`}>{text}</span>
    </button>
  );
}