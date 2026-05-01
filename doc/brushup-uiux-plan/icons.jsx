/* eslint-disable */
// Icon set — minimal stroke icons
const Icon = ({ name, size = 16, stroke = 1.6, ...props }) => {
  const paths = ICONS[name];
  if (!paths) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={stroke}
      strokeLinecap="round" strokeLinejoin="round" {...props}>
      {paths}
    </svg>
  );
};

const ICONS = {
  search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></>,
  hash: <><path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18"/></>,
  lock: <><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></>,
  bell: <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9z"/><path d="M10 21a2 2 0 0 0 4 0"/></>,
  bellOff: <><path d="m1 1 22 22"/><path d="M9 9v-1a3 3 0 0 1 5.12-2.12M18 8v3m-3 6H3s3-2 3-9"/><path d="M10 21a2 2 0 0 0 4 0"/></>,
  inbox: <><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></>,
  home: <><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></>,
  message: <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></>,
  thread: <><path d="M3 6h18M7 12h14M11 18h10"/></>,
  reply: <><path d="m9 17-5-5 5-5"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></>,
  star: <><path d="M11.48 3.5a.6.6 0 0 1 1.04 0l2.6 5.27 5.81.85a.6.6 0 0 1 .33 1.02l-4.2 4.1.99 5.78a.6.6 0 0 1-.86.63L12 18.4l-5.2 2.74a.6.6 0 0 1-.86-.63l.99-5.78-4.2-4.1a.6.6 0 0 1 .33-1.02l5.81-.85z"/></>,
  bookmark: <><path d="m19 21-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></>,
  pin: <><path d="m12 17v5"/><path d="M9 11V4h6v7l3 3v2H6v-2z"/></>,
  calendar: <><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></>,
  task: <><rect x="3" y="3" width="18" height="18" rx="2"/><path d="m9 12 2 2 4-4"/></>,
  files: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></>,
  template: <><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></>,
  shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></>,
  plus: <><path d="M12 5v14M5 12h14"/></>,
  more: <><circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/></>,
  moreV: <><circle cx="12" cy="5" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="19" r="1.4"/></>,
  caret: <><path d="m6 9 6 6 6-6"/></>,
  caretR: <><path d="m9 6 6 6-6 6"/></>,
  emoji: <><circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/></>,
  paperclip: <><path d="m21 11-9.5 9.5a5 5 0 0 1-7-7L13 5a3.5 3.5 0 0 1 5 5L9 19a2 2 0 0 1-3-3l8-8"/></>,
  send: <><path d="m22 2-7 20-4-9-9-4 20-7z"/></>,
  bold: <><path d="M6 4h7a4 4 0 0 1 0 8H6zM6 12h8a4 4 0 0 1 0 8H6z"/></>,
  italic: <><path d="M19 4h-9M14 20H5M15 4 9 20"/></>,
  link: <><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></>,
  list: <><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></>,
  code: <><path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/></>,
  quote: <><path d="M3 21c3 0 7-1 7-8V5h-7v9h4M14 21c3 0 7-1 7-8V5h-7v9h4"/></>,
  filter: <><path d="M22 3H2l8 9.46V19l4 2v-8.54z"/></>,
  smile: <><circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
  users: <><circle cx="9" cy="8" r="4"/><path d="M3 21a6 6 0 0 1 12 0"/><path d="M16 4a4 4 0 0 1 0 8M22 21a6 6 0 0 0-5-6"/></>,
  sliders: <><path d="M4 21V14M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/></>,
  command: <><path d="M18 3a3 3 0 0 0 0 6h-3V6a3 3 0 0 0-6 0v3H6a3 3 0 1 0 0 6h3v3a3 3 0 1 0 6 0v-3h3a3 3 0 1 0 0-6h-3V6a3 3 0 0 0-3-3z"/></>,
  zap: <><path d="M13 2 3 14h9l-1 8 10-12h-9z"/></>,
  arrowUp: <><path d="M12 19V5M5 12l7-7 7 7"/></>,
  check: <><path d="M20 6 9 17l-5-5"/></>,
  x: <><path d="M18 6 6 18M6 6l12 12"/></>,
  arrowL: <><path d="M19 12H5M12 19l-7-7 7-7"/></>,
  arrowR: <><path d="M5 12h14M12 5l7 7-7 7"/></>,
  panel: <><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/></>,
  panelR: <><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M15 3v18"/></>,
  edit: <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 1 1 3 3L12 15l-4 1 1-4z"/></>,
  trash: <><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></>,
  globe: <><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18"/></>,
  battery: <><rect x="2" y="7" width="18" height="10" rx="2"/><path d="M22 11v2"/></>,
  wifi: <><path d="M5 12.55a11 11 0 0 1 14 0M2 8.82a15 15 0 0 1 20 0M8.5 16.43a6 6 0 0 1 7 0"/><circle cx="12" cy="20" r="0.5"/></>,
  signal: <><path d="M2 20h20M5 17v3M9 14v6M13 11v9M17 8v12M21 5v15"/></>,
  sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></>,
  moon: <><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></>,
  hashLg: <><path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18"/></>,
  at: <><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"/></>,
  exclamation: <><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></>,
};

window.Icon = Icon;
