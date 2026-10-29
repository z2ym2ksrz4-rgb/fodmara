/**
 * The mark from the app icon: a belly in profile, swollen, with a small cramp zigzag inside.
 * Used on the "My gut is acting up" button and the widget preview. `color` = outline, `core` = belly fill.
 */
export function GutMark({ size = 48, color = "currentColor", core = "var(--accent)", cramp = "#24453C" }: { size?: number; color?: string; core?: string; cramp?: string }) {
  return (
    <svg width={size} height={size} viewBox="250 60 600 900" aria-hidden="true" fill="none">
      <path d="M352 332 C570 320 750 430 750 570 C750 720 600 796 380 790" fill={core} />
      <path d="M320 90 C320 210 312 280 352 332 C570 320 750 430 750 570 C750 720 600 796 380 790 C352 820 342 860 342 900" stroke={color} strokeWidth="70" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M480 480 l50 60 l-50 60 l50 60" stroke={cramp} strokeWidth="48" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
