import { PROFILE_COLOR } from "./MetroMap";

export function Legend({ profile }: { profile: string }) {
  const line = PROFILE_COLOR[profile];
  return (
    <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink-soft" aria-label="Map legend">
      <Item label="Done (sellado)">
        <circle cx="10" cy="8" r="5.5" fill="var(--color-olive)" stroke="var(--color-olive)" strokeWidth="2.5" />
      </Item>
      <Item label="Do this now">
        <circle cx="10" cy="8" r="5.5" fill="var(--color-paper)" stroke="var(--color-ink)" strokeWidth="2.5" />
        <circle cx="10" cy="8" r="2" fill={line} />
      </Item>
      <Item label="Blocked">
        <circle cx="10" cy="8" r="5.5" fill="var(--color-paper)" stroke="#9a9da3" strokeWidth="2" />
      </Item>
      <Item label="Goal">
        <circle cx="10" cy="8" r="7" fill="none" stroke="var(--color-ink)" strokeWidth="1.2" />
        <circle cx="10" cy="8" r="4" fill="var(--color-paper)" stroke="var(--color-ink)" strokeWidth="2" />
      </Item>
      <Item label="Way out">
        <rect x="5" y="3" width="10" height="10" rx="2" transform="rotate(45 10 8)" fill="var(--color-paper)" stroke="var(--color-terracotta)" strokeWidth="2.2" />
      </Item>
      <Item label="Official rule">
        <path d="M0 8 H20" stroke={line} strokeWidth="4" strokeLinecap="round" />
      </Item>
      <Item label="Common practice, not a rule">
        <path d="M0 8 H20" stroke={line} strokeWidth="4" strokeDasharray="5 4" />
      </Item>
      <Item label="Part of a circle">
        <path d="M0 8 H20" stroke="var(--color-terracotta)" strokeOpacity=".35" strokeWidth="8" />
        <path d="M0 8 H20" stroke={line} strokeWidth="3" />
      </Item>
      <Item label="Not yet verified">
        <text x="6" y="12" fontSize="12" fill="var(--color-terracotta)" fontWeight="700">?</text>
      </Item>
    </ul>
  );
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-1.5">
      <svg width="20" height="16" aria-hidden>{children}</svg>
      {label}
    </li>
  );
}
