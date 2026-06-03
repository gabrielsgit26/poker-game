import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { title?: string };

function BaseIcon({ title, children, className, ...rest }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

/** Hamburger — table menu */
export function IconTableMenu(props: IconProps) {
  return (
    <BaseIcon {...props} title={props.title}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </BaseIcon>
  );
}

/** Chevron left — back to tables */
export function IconTableBack(props: IconProps) {
  return (
    <BaseIcon {...props} title={props.title}>
      <path d="m15 18-6-6 6-6" />
    </BaseIcon>
  );
}

/** Leave seat (stand up) — door / exit */
export function IconLeaveSeat(props: IconProps) {
  return (
    <BaseIcon {...props} title={props.title}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" x2="9" y1="12" y2="12" />
    </BaseIcon>
  );
}

export function IconLobby(props: IconProps) {
  return (
    <BaseIcon {...props} title={props.title}>
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </BaseIcon>
  );
}

export function IconTablesGrid(props: IconProps) {
  return (
    <BaseIcon {...props} title={props.title}>
      <rect width="7" height="7" x="3" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="14" rx="1" />
      <rect width="7" height="7" x="3" y="14" rx="1" />
    </BaseIcon>
  );
}

export function IconPractice(props: IconProps) {
  return (
    <BaseIcon {...props} title={props.title}>
      <polygon points="6 3 20 12 6 21 6 3" />
      <line x1="4" x2="4" y1="5" y2="19" />
    </BaseIcon>
  );
}

export function IconSettings(props: IconProps) {
  return (
    <BaseIcon {...props} title={props.title}>
      <line x1="4" x2="4" y1="21" y2="14" />
      <line x1="4" x2="4" y1="10" y2="3" />
      <line x1="12" x2="12" y1="21" y2="12" />
      <line x1="12" x2="12" y1="8" y2="3" />
      <line x1="20" x2="20" y1="21" y2="16" />
      <line x1="20" x2="20" y1="12" y2="3" />
      <line x1="1" x2="7" y1="14" y2="14" />
      <line x1="9" x2="15" y1="8" y2="8" />
      <line x1="17" x2="23" y1="16" y2="16" />
    </BaseIcon>
  );
}

/** Close / leave table (destructive) */
export function IconCloseTable(props: IconProps) {
  return (
    <BaseIcon {...props} title={props.title}>
      <circle cx="12" cy="12" r="9" strokeWidth={1.5} />
      <path d="M15 9 9 15" strokeWidth={2} />
      <path d="m9 9 6 6" strokeWidth={2} />
    </BaseIcon>
  );
}

/** Small chip — title / meta row */
export function IconChipMeta(props: IconProps) {
  return (
    <BaseIcon {...props} title={props.title}>
      <ellipse cx="12" cy="12" rx="8" ry="4.5" />
      <path d="M4 12c0-1.5 3.5-2.5 8-2.5s8 1 8 2.5" />
    </BaseIcon>
  );
}

/** Playing cards — table name */
export function IconPlayingCards(props: IconProps) {
  return (
    <BaseIcon {...props} title={props.title}>
      <rect width="8" height="11" x="3" y="6" rx="1" transform="rotate(-12 7 11.5)" />
      <rect width="8" height="11" x="9" y="5" rx="1" transform="rotate(8 13 10.5)" />
    </BaseIcon>
  );
}

export function IconLiveDot({
  className,
  live,
  connecting,
}: {
  className?: string;
  live: boolean;
  connecting?: boolean;
}) {
  const dotClass = live
    ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.65)]"
    : connecting
      ? "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.45)]"
      : "bg-zinc-500";
  return (
    <span className={`relative inline-flex h-2 w-2 shrink-0 ${className ?? ""}`} aria-hidden>
      <span className={`h-2 w-2 rounded-full ${dotClass}`} />
      {live ? (
        <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/40 [animation-duration:2s]" />
      ) : null}
    </span>
  );
}
