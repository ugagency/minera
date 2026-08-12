import type { SVGProps } from "react";

// Ícones SVG inline monocromáticos, traço 1.7 (SPEC §5). Nunca emoji.

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 20, ...props }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...props,
  };
}

export function IconTruck(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M1 8h13v8H1zM14 11h4l3 3v2h-7z" />
      <circle cx="6" cy="18" r="1.8" />
      <circle cx="17.5" cy="18" r="1.8" />
    </svg>
  );
}

export function IconCoins(props: IconProps) {
  return (
    <svg {...base(props)}>
      <ellipse cx="12" cy="6" rx="7" ry="3" />
      <path d="M5 6v6c0 1.66 3.13 3 7 3s7-1.34 7-3V6" />
      <path d="M5 12v6c0 1.66 3.13 3 7 3s7-1.34 7-3v-6" />
    </svg>
  );
}

export function IconCamera(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 8a2 2 0 0 1 2-2h2l1.5-2h7L17 6h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

export function IconPlus(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function IconCheck(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 12.5l5 5L20 6.5" />
    </svg>
  );
}

export function IconWarning(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3.5L22 20H2z" />
      <path d="M12 9.5v5M12 17.2v.3" />
    </svg>
  );
}

export function IconX(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function IconPrint(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M7 8V3h10v5" />
      <path d="M5 8h14a2 2 0 0 1 2 2v6h-4v5H7v-5H3v-6a2 2 0 0 1 2-2z" />
      <path d="M7 16h10" />
    </svg>
  );
}

export function IconArrowRight(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 12h16M13 5l7 7-7 7" />
    </svg>
  );
}

export function IconWhatsApp(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3z" />
      <path d="M8.8 9.2c.4 2.8 3.2 5.6 6 6l1.4-1.4-2-1.2-1 .8c-.9-.5-1.7-1.3-2.2-2.2l.8-1-1.2-2z" />
    </svg>
  );
}
