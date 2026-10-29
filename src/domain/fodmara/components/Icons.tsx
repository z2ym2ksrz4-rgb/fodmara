/** Two small line icons for the log buttons. Stroke = currentColor so they follow the theme. */
export const PlateIcon = ({ size = 26 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <circle cx="17" cy="16" r="10" /><circle cx="17" cy="16" r="5.5" /><path d="M4 6v7a2 2 0 0 0 2 2M6 6v20M8 6v7a2 2 0 0 1-2 2" />
  </svg>
);
export const RollIcon = ({ size = 26 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <ellipse cx="10" cy="14" rx="6" ry="8" /><circle cx="10" cy="14" r="2" /><path d="M10 6h14c3.3 0 6 3.6 6 8s-2.7 8-6 8H10M24 22v6H14" />
  </svg>
);
