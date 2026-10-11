import { createTheme, defaultVariantColorsResolver, parseThemeColor, type CSSVariablesResolver, type MantineColorsTuple, type VariantColorsResolver } from "@mantine/core";

/** Design tokens from .interface-design/system.md. Change them there first. */
export const tokens = {
  ground: "#EDF0F2",
  surface: "#FFFFFF",
  ink: "#172030",
  steel: "#56657A",
  line: "#D3DAE1",
  brass: "#B8862B",
  brassStrong: "#8C6420",
  brassStrongHover: "#835E1E", // brass-strong darkened 6%
  brassInk: "#88611F",
  breach: "#B23A2E",
  breachTint: "#F6E4E1",
  cleared: "#2F7A57",
  clearedTint: "#E1F0E8",
  clearedInk: "#2E7654",
  amberTint: "#F5EAD3",
  neutralTint: "#E6EAEE",
  rowHover: "#F5F7F9",
} as const;

/** @deprecated use tokens; kept while older components migrate */
export const palette = {
  background: tokens.ground,
  surface: tokens.surface,
  ink: tokens.ink,
  steel: tokens.steel,
  brass: tokens.brass,
  breach: tokens.breach,
  cleared: tokens.cleared,
  line: tokens.line,
} as const;

// Index 6 is the brand value; 7 is brass-strong for filled buttons, 8 its 6% darker hover.
const brass: MantineColorsTuple = ["#F5EAD3", "#EFDFBF", "#E7D6B7", "#DCC395", "#D0AF73", "#C49B4F", "#B8862B", "#8C6420", "#835E1E", "#604616"];
const breach: MantineColorsTuple = ["#F6E4E1", "#F1DCD9", "#E5BCB8", "#D99D97", "#CC7D75", "#BF5B52", "#B23A2E", "#923026", "#75261E", "#5D1E18"];
const cleared: MantineColorsTuple = ["#E1F0E8", "#DAE7E1", "#B8D2C6", "#97BDAB", "#76A790", "#529174", "#2F7A57", "#2E7654", "#1F5139", "#183F2D"];
const steel: MantineColorsTuple = ["#E6EAEE", "#E1E3E7", "#C6CBD2", "#ABB2BD", "#8F99A7", "#737F91", "#56657A", "#475364", "#394351", "#2D353F"];
const ink: MantineColorsTuple = ["#ECEDEE", "#D5D7DA", "#B0B3B9", "#8B9098", "#666C76", "#3E4653", "#172030", "#131A27", "#0F1520", "#0C1119"];

const CUSTOM = new Set(["brass", "breach", "cleared", "steel", "ink"]);

/** Light variants: tint background (shade 0) with the token text colour that passes 4.5:1 on it. */
const LIGHT_TEXT: Record<string, string> = {
  brass: tokens.brassInk,
  breach: tokens.breach,
  cleared: tokens.clearedInk,
  steel: tokens.steel,
  ink: tokens.ink,
};

const variantColorResolver: VariantColorsResolver = (input) => {
  const base = defaultVariantColorsResolver(input);
  const parsed = parseThemeColor({ color: input.color ?? input.theme.primaryColor, theme: input.theme });
  if (!parsed.isThemeColor || !CUSTOM.has(parsed.color)) return base;
  const shades = input.theme.colors[parsed.color];
  if (input.variant === "light") {
    return { ...base, background: shades[0], hover: shades[1], color: LIGHT_TEXT[parsed.color], border: "none" };
  }
  if (input.variant === "filled" && parsed.color === "brass") {
    return { ...base, background: tokens.brassStrong, hover: tokens.brassStrongHover, color: "#fff" };
  }
  return base;
};

export const theme = createTheme({
  primaryColor: "brass",
  primaryShade: 7,
  colors: { brass, breach, cleared, steel, ink },
  black: tokens.ink,
  fontFamily: '"Public Sans", system-ui, -apple-system, "Segoe UI", sans-serif',
  fontFamilyMonospace: 'ui-monospace, "SF Mono", Consolas, monospace',
  // Scale: 32 / 24 / 19 / 16 / 15 / 13
  fontSizes: { xs: "13px", sm: "15px", md: "16px", lg: "19px", xl: "24px" },
  lineHeights: { xs: "1.45", sm: "1.55", md: "1.55", lg: "1.4", xl: "1.25" },
  headings: {
    fontFamily: '"Bricolage Grotesque", "Public Sans", system-ui, sans-serif',
    fontWeight: "650",
    sizes: {
      h1: { fontSize: "32px", lineHeight: "1.2" },
      h2: { fontSize: "24px", lineHeight: "1.25" },
      h3: { fontSize: "19px", lineHeight: "1.35" },
      h4: { fontSize: "16px", lineHeight: "1.4" },
    },
  },
  // Radius by role: badges 4, inputs/buttons 6, panels 10
  radius: { xs: "4px", sm: "6px", md: "10px", lg: "10px", xl: "10px" },
  defaultRadius: "sm",
  spacing: { xs: "8px", sm: "12px", md: "16px", lg: "24px", xl: "32px" },
  focusRing: "auto",
  cursorType: "pointer",
  variantColorResolver,
  components: {
    Button: {
      defaultProps: { radius: "sm" },
      styles: { root: { height: 40, fontSize: 15, fontWeight: 600, paddingInline: 16 } },
    },
    Input: {
      styles: { input: { height: 40, minHeight: 40, fontSize: 15, borderColor: tokens.line } },
    },
    InputWrapper: {
      styles: {
        label: { fontSize: 13, fontWeight: 600, color: tokens.ink, marginBottom: 4 },
        description: { fontSize: 13, color: tokens.steel },
        error: { fontSize: 13 },
      },
    },
    Badge: {
      defaultProps: { radius: "xs", tt: "none" },
      styles: { root: { height: 24, fontSize: 13, fontWeight: 600, paddingInline: 8 } },
    },
    Paper: { defaultProps: { radius: "md", shadow: "none" } },
    Drawer: { defaultProps: { overlayProps: { backgroundOpacity: 0.3, blur: 1 } } },
  },
});

export const cssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {
    "--ground": tokens.ground,
    "--surface": tokens.surface,
    "--ink": tokens.ink,
    "--steel": tokens.steel,
    "--line": tokens.line,
    "--brass": tokens.brass,
    "--brass-strong": tokens.brassStrong,
    "--brass-ink": tokens.brassInk,
    "--breach": tokens.breach,
    "--breach-tint": tokens.breachTint,
    "--cleared": tokens.cleared,
    "--cleared-tint": tokens.clearedTint,
    "--cleared-ink": tokens.clearedInk,
    "--amber-tint": tokens.amberTint,
    "--neutral-tint": tokens.neutralTint,
    "--row-hover": tokens.rowHover,
    // Older aliases still used by existing CSS
    "--sw-surface": tokens.surface,
    "--sw-line": tokens.line,
    "--sw-steel": tokens.steel,
    "--sw-brass": tokens.brass,
  },
  light: {
    "--mantine-color-body": tokens.ground,
    "--mantine-color-text": tokens.ink,
    "--mantine-color-dimmed": tokens.steel,
    "--mantine-color-default-border": tokens.line,
  },
  dark: {},
});
