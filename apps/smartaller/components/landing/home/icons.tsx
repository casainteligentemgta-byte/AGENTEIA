import type { ReactNode, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="block shrink-0"
      {...props}
    >
      {children}
    </svg>
  );
}

export function BrandMarkIcon(props: IconProps) {
  return (
    <Icon width={22} height={22} strokeWidth={2} {...props}>
      <path d="M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9z" />
      <path d="M9 15l5.5-5.5M9 15h3" />
    </Icon>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <Icon width={20} height={20} strokeWidth={2} {...props}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </Icon>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Icon width={18} height={18} strokeWidth={2.2} {...props}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </Icon>
  );
}

export function ChatIcon(props: IconProps) {
  return (
    <Icon width={16} height={16} strokeWidth={2} {...props}>
      <path d="M4 19l1.5-4A7.5 7.5 0 1 1 9 18.5z" />
    </Icon>
  );
}

export function CameraIcon(props: IconProps) {
  return (
    <Icon width={22} height={22} strokeWidth={1.9} {...props}>
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </Icon>
  );
}

export function ScanIcon(props: IconProps) {
  return (
    <Icon width={22} height={22} strokeWidth={1.9} {...props}>
      <path d="M4 8V5h3M17 5h3v3M20 16v3h-3M7 19H4v-3" />
      <path d="M8 12h8" />
    </Icon>
  );
}

export function CloudIcon(props: IconProps) {
  return (
    <Icon width={22} height={22} strokeWidth={1.9} {...props}>
      <path d="M7 18h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.1 9.2 4.5 4.5 0 0 0 7 18z" />
    </Icon>
  );
}

export function BellIcon(props: IconProps) {
  return (
    <Icon width={22} height={22} strokeWidth={1.9} {...props}>
      <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </Icon>
  );
}

export function ClipboardIcon(props: IconProps) {
  return (
    <Icon width={20} height={20} strokeWidth={1.9} {...props}>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4h6v3H9zM9 12h6M9 16h4" />
    </Icon>
  );
}

export function UsersIcon(props: IconProps) {
  return (
    <Icon width={20} height={20} strokeWidth={1.9} {...props}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3 20a6 6 0 0 1 12 0" />
      <path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6 6 0 0 1 3 5.5" />
    </Icon>
  );
}

export function ChartIcon(props: IconProps) {
  return (
    <Icon width={20} height={20} strokeWidth={1.9} {...props}>
      <path d="M4 20V4M4 20h16" />
      <path d="M8 16v-4M12 16V8M16 16v-6" />
    </Icon>
  );
}
