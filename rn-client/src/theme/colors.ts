export const colors = {
  // Page background
  parchment: "#E0D0B4",
  parchmentDark: "#BFB08C",

  // Text colors (from Godot PageContentRenderer)
  title: "#100A04",
  body: "#181008",
  secondary: "#201408",
  event: "#302010",
  entityTitle: "#2A1F14",
  entityBody: "#362816",
  action: "#4A3828",
  player: "#1A3A2A",
  choice: "#4A3828",
  dialogueEvent: "#5A4A3A",
  menuTitle: "#2A1F14",
  tab: "#4A3828",
  tabActive: "#2A1A0A",
  separator: "#8A7A6A",
  decorative: "rgba(102, 89, 71, 0.3)",

  // Bottom bar
  barBg: "#D1BFA3",
  barSeparator: "#736B4D",
  barActive: "#382818",
  barActiveHover: "#594028",
  barActivePressed: "#261A08",
  barDisabled: "#A69480",

  // Minimap
  dotCurrent: "#4D3824",
  dotVisited: "#B29E84",
  dotKnown: "#D4C8B4",
  pathLine: "#8C7A66",

  // Vignette
  vignetteShadow: "rgba(89, 71, 51, 0.15)",

  // Atmosphere tints
  atmosphereNight: "rgba(20, 20, 60, 0.15)",
  atmosphereDawn: "rgba(255, 180, 100, 0.08)",
  atmosphereDusk: "rgba(200, 100, 50, 0.10)",
  atmosphereRain: "rgba(100, 120, 140, 0.12)",
  atmosphereStorm: "rgba(60, 60, 80, 0.18)",
} as const;

export const fonts = {
  regular: "Cardo-Regular",
  bold: "Cardo-Bold",
  italic: "Cardo-Italic",
} as const;

export const fontSizes = {
  title: 28,
  entityTitle: 26,
  bold: 22,
  body: 20,
  italic: 19,
  small: 16,
  tab: 14,
} as const;

export const spacing = {
  pagePaddingH: 20,
  pagePaddingTop: 24,
  pagePaddingBottom: 10,
  bottomBarHeight: 120,
} as const;
