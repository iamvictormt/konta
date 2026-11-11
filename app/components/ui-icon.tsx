import type { SVGProps } from "react";

export type IconName =
  | "home"
  | "cart"
  | "box"
  | "chart"
  | "cash"
  | "settings"
  | "wifi"
  | "wifi-off"
  | "chevron"
  | "arrow-up"
  | "plus"
  | "search"
  | "calendar"
  | "trend"
  | "receipt"
  | "clock"
  | "menu"
  | "close"
  | "minus"
  | "check"
  | "arrow-right"
  | "download"
  | "alert"
  | "store"
  | "user"
  | "more"
  | "bars"
  | "star"
  | "logout"
  | "camera"
  | "pencil"
  | "eye"
  | "eye-off"
  | "trash";

type IconProps = SVGProps<SVGSVGElement> & { name: IconName; size?: number };

export default function Icon({ name, size = 20, ...props }: IconProps) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
    ...props,
  };

  switch (name) {
    case "eye": return <svg {...common}><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"/><circle cx="12" cy="12" r="2.5"/></svg>;
    case "eye-off": return <svg {...common}><path d="m3 3 18 18M10 6.2c.6-.1 1.3-.2 2-.2 6.5 0 10 6 10 6a17 17 0 0 1-3 3.4M6 7.8A17 17 0 0 0 2 12s3.5 6 10 6c1.4 0 2.6-.3 3.7-.7"/></svg>;
    case "home": return <svg {...common}><path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9M9 20v-6h6v6"/></svg>;
    case "cart": return <svg {...common}><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/><path d="M2 3h2l2.4 11.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 1.9-1.4L22 8H5"/></svg>;
    case "box": return <svg {...common}><path d="m12 3 9 4.5v9L12 21l-9-4.5v-9L12 3Z"/><path d="m3.5 7.5 8.5 4.3 8.5-4.3M12 12v9M8 5l9 4.5"/></svg>;
    case "chart": return <svg {...common}><path d="M4 19V5M4 19h17"/><path d="m7 15 4-4 3 2 5-6"/><path d="M17 7h2v2"/></svg>;
    case "cash": return <svg {...common}><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M7 6V4h10v2M3 10h18"/><circle cx="12" cy="14" r="2.4"/></svg>;
    case "settings": return <svg {...common}><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"/><path d="m19.4 15 .1.1a1.8 1.8 0 1 1-2.5 2.5l-.1-.1a1.8 1.8 0 0 0-3 .9v.2a1.8 1.8 0 1 1-3.6 0v-.2a1.8 1.8 0 0 0-3-.9l-.1.1a1.8 1.8 0 1 1-2.5-2.5l.1-.1a1.8 1.8 0 0 0-.9-3H3.7a1.8 1.8 0 1 1 0-3.6h.2a1.8 1.8 0 0 0 .9-3l-.1-.1a1.8 1.8 0 1 1 2.5-2.5l.1.1a1.8 1.8 0 0 0 3-.9v-.2a1.8 1.8 0 1 1 3.6 0v.2a1.8 1.8 0 0 0 3 .9l.1-.1a1.8 1.8 0 1 1 2.5 2.5l-.1.1a1.8 1.8 0 0 0 .9 3h.2a1.8 1.8 0 1 1 0 3.6h-.2a1.8 1.8 0 0 0-.9 3Z" transform="translate(1 1) scale(.92)"/></svg>;
    case "wifi": return <svg {...common}><path d="M5 12.6a10.5 10.5 0 0 1 14 0M8 15.6a6 6 0 0 1 8 0M11 18.5a1.8 1.8 0 0 1 2 0"/><circle cx="12" cy="20" r=".6" fill="currentColor" stroke="none"/></svg>;
    case "wifi-off": return <svg {...common}><path d="M3 3 21 21M5 12.6a10.5 10.5 0 0 1 4.4-2M8 15.6a6 6 0 0 1 3.2-1.2M16 15.6a6 6 0 0 0-1.3-.8M19 12.6a10.5 10.5 0 0 0-2.2-1.5M11 18.5a1.8 1.8 0 0 1 2 0"/></svg>;
    case "chevron": return <svg {...common}><path d="m7 10 5 5 5-5"/></svg>;
    case "arrow-up": return <svg {...common}><path d="M7 17 17 7M8 7h9v9"/></svg>;
    case "plus": return <svg {...common}><path d="M12 5v14M5 12h14"/></svg>;
    case "search": return <svg {...common}><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/></svg>;
    case "calendar": return <svg {...common}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>;
    case "trend": return <svg {...common}><path d="m3 16 6-6 4 4 8-9"/><path d="M15 5h6v6"/></svg>;
    case "receipt": return <svg {...common}><path d="M5 3h14v18l-3-2-4 2-4-2-3 2V3Z"/><path d="M8 8h8M8 12h8M8 16h4"/></svg>;
    case "clock": return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>;
    case "menu": return <svg {...common}><path d="M4 6h16M4 12h16M4 18h16"/></svg>;
    case "close": return <svg {...common}><path d="m6 6 12 12M18 6 6 18"/></svg>;
    case "minus": return <svg {...common}><path d="M5 12h14"/></svg>;
    case "check": return <svg {...common}><path d="m5 12 4 4L19 6"/></svg>;
    case "arrow-right": return <svg {...common}><path d="M5 12h14M13 6l6 6-6 6"/></svg>;
    case "download": return <svg {...common}><path d="M12 3v12m-5-5 5 5 5-5M4 19v2h16v-2"/></svg>;
    case "alert": return <svg {...common}><path d="M12 3 2.8 19h18.4L12 3Z"/><path d="M12 9v4M12 16.5h.01"/></svg>;
    case "store": return <svg {...common}><path d="M3 10h18M5 10v10h14V10M4 10 6 4h12l2 6"/><path d="M9 20v-6h6v6M4 10a2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0"/></svg>;
    case "user": return <svg {...common}><circle cx="12" cy="8" r="3.5"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>;
    case "bars": return <svg {...common}><rect x="3.5" y="12" width="4.5" height="8.5" rx="1" fill="currentColor"/><rect x="9.8" y="4" width="4.5" height="16.5" rx="1" fill="currentColor"/><rect x="16.1" y="8.5" width="4.5" height="12" rx="1" fill="currentColor"/></svg>;
    case "camera": return <svg {...common}><path d="M4 8h3l1.6-2.4h6.8L17 8h3v11H4V8Z"/><circle cx="12" cy="13" r="3.6"/></svg>;
    case "pencil": return <svg {...common}><path d="m14 6 4 4M4 20l4.5-1 11-11a2.8 2.8 0 0 0-4-4l-11 11L4 20Z"/></svg>;
    case "trash": return <svg {...common}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>;
    case "logout": return <svg {...common}><path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4"/><path d="M16 8l4 4-4 4M20 12H9"/></svg>;
    case "star": return <svg {...common}><path d="m12 3.2 2.5 5.4 5.9.7-4.4 4 1.2 5.8L12 16.2l-5.2 2.9L8 13.3l-4.4-4 5.9-.7L12 3.2Z" fill="currentColor"/></svg>;
    case "more": return <svg {...common}><circle cx="5" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="19" cy="12" r="1" fill="currentColor"/></svg>;
  }
}
