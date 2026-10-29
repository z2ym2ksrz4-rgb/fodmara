import { useTranslation } from "react-i18next";
import { haptics } from "@/core/ui";

/** Simple drawings of the seven Bristol stool types (hard lumps → watery). Abstract on purpose: shapes, not photos. */
function Shape({ type }: { type: number }) {
  const c = "currentColor";
  switch (type) {
    case 1: return <g fill={c}>{[[10, 14], [22, 10], [34, 16], [16, 26], [30, 27]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="5" />)}</g>;
    case 2: return <path d="M6 18c0-5 5-7 8-6 2-4 7-4 9-1 3-3 8-2 9 2 4 0 6 3 6 5s-2 5-6 5c-1 4-7 4-9 1-2 3-7 3-9 0-4 1-8-1-8-6z" fill={c} />;
    case 3: return <g><rect x="5" y="13" width="34" height="13" rx="6.5" fill={c} /><path d="M13 13v4M21 22v4M29 13v4" stroke="var(--card)" strokeWidth="2" strokeLinecap="round" /></g>;
    case 4: return <rect x="5" y="13" width="34" height="13" rx="6.5" fill={c} />;
    case 5: return <g fill={c}><ellipse cx="12" cy="15" rx="7" ry="5" /><ellipse cx="30" cy="14" rx="7" ry="5" /><ellipse cx="21" cy="27" rx="7" ry="5" /></g>;
    case 6: return <path d="M6 22c2-6 6-8 10-6 2-5 8-5 10-1 4-3 10 0 10 5 2 2 1 6-3 6H9c-3 0-4-2-3-4z" fill={c} opacity=".85" />;
    default: return <path d="M5 24c4-4 8 2 12-1s7-3 11 0 7 2 11-1" stroke={c} strokeWidth="4" strokeLinecap="round" fill="none" />;
  }
}

export function BristolPicker({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  const { t } = useTranslation();
  return (
    <div className="bristol" role="radiogroup" aria-label={t("stool.bristolQ")}>
      {[1, 2, 3, 4, 5, 6, 7].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} className={`b${n} ${value === n ? "on" : ""}`} onClick={() => { haptics.tap(); onChange(n); }}>
          <svg viewBox="0 0 44 40" width="44" height="40" aria-hidden="true"><Shape type={n} /></svg>
          <span className="bn">{n}</span>
          <span className="bl">{t(`stool.type.${n}`)}</span>
        </button>
      ))}
    </div>
  );
}

export function BristolBars({ types }: { types: number[] }) {
  const max = Math.max(1, ...types);
  return (
    <div className="bars bristol-bars">
      {types.map((n, i) => <div key={i} className={`bar ${n ? "" : "none"} ${i === 3 || i === 2 ? "mid" : ""}`} style={{ height: `${(n / max) * 100}%` }} title={`${i + 1}: ${n}`} />)}
    </div>
  );
}
