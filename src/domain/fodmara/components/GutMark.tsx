/**
 * The mark from the app icon: a round belly with a tight swirl inside – the "something is churning" feeling.
 * Used on the "My gut is acting up" button, the widget preview and the site.
 */
export function GutMark({ size = 48, color = "currentColor", core = "var(--accent)" }: { size?: number; color?: string; core?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" fill="none">
      <circle cx="50" cy="50" r="38" stroke={color} strokeWidth="7" />
      <path d="M50 50 m0 -4 a4 4 0 1 1 -4 4 a9 9 0 0 1 9 -9 a14 14 0 0 1 14 14 a19 19 0 0 1 -19 19" stroke={core} strokeWidth="7" strokeLinecap="round" />
    </svg>
  );
}
