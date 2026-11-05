export type FontSource = "google" | "local";

/** Id of a brand font in `ButtonStylerProject.typography`. The first font is the default. */
export type TypographyRole = string;

export const MAX_BRAND_FONTS = 6;

export type TextTransform = "none" | "uppercase" | "lowercase" | "capitalize";

export const TEXT_TRANSFORM_OPTIONS: { value: TextTransform; label: string }[] = [
  { value: "none", label: "Normal case" },
  { value: "uppercase", label: "Uppercase" },
  { value: "lowercase", label: "Lowercase" },
  { value: "capitalize", label: "Capital case" },
];

export interface TypographyStyle {
  id: TypographyRole;
  label: string;
  fontFamily: string;
  fontSource?: FontSource;
  /** Button text size for this font (rem). */
  fontSize: string;
  fontWeight: number;
  fontStyle: "normal" | "italic";
  /**
   * Installed face name from the Local Font Access API (e.g. "Outlines Bouncy").
   * Needed when multiple faces share the same CSS weight/style.
   */
  localFontStyle?: string;
  lineHeight: string;
}

export interface BrandColor {
  id: string;
  name: string;
  hex: string;
  role: "hero" | "accent" | "light-neutral" | "dark-neutral";
}

/** A text-on-background color pairing the user has approved for brand use. */
export interface ApprovedColorPairing {
  textColorId: string;
  backgroundColorId: string;
}

export function colorPairingKey(textColorId: string, backgroundColorId: string): string {
  return `${textColorId}|${backgroundColorId}`;
}

export type CTAKind = "button" | "link";

export type CTAVariant = "primary" | "secondary" | "tertiary" | "ghost" | "link";

export type CTAShape = "pill" | "oval" | "rounded" | "soft" | "sharp" | "square";

/** Five shape options shown in the CTA style editor. */
export type CTAEditorShape = "square" | "soft" | "rounded" | "pill" | "oval";

export type CTAFill = "solid" | "outline" | "solid-outline" | "ghost" | "text";

/** Button fill options in the CTA style editor. */
export type CTAEditorFill = "solid" | "outline" | "solid-outline";

export type CTAAlignment = "left" | "center" | "right";

export type CTALinkVariant = "underline" | "always-underline" | "arrow";

/** Text-only CTA decoration (underline and/or trailing arrow). */
export type CTATextDecoration = "plain" | "underlined" | "arrow" | "underline-arrow";

/** Whether a button uses a brand font slot or its own font rules. */
export type CTATypographySource = "role" | "custom";

/** Per-button type rules when typographySource is "custom". */
export interface CTACustomTypography {
  fontFamily: string;
  fontSource?: FontSource;
  fontWeight: number;
  fontStyle?: "normal" | "italic";
  /**
   * Installed face name from the Local Font Access API (e.g. "Outlines Bouncy").
   * Needed when multiple faces share the same CSS weight/style.
   */
  localFontStyle?: string;
  /** CSS font-size (typically rem). Omit to inherit the linked font slot size. */
  fontSize?: string;
}

export interface CTAVisualState {
  backgroundColorId: string | null;
  textColorId: string;
  borderColorId: string | null;
  underline: boolean;
}

/** User-created button or link style. */
export interface CTAStyleDefinition {
  id: string;
  name?: string;
  kind: CTAKind;
  presetId: string;
  /** Fill for solid/solid-outline buttons, border+text for outline, text for links. */
  initialFillColorId?: string;
  /** Hover fill for solid/solid-outline, hover border for outline, hover text for ghost/link. */
  hoverFillColorId?: string;
  /** Border color for outline and solid-outline buttons. */
  initialBorderColorId?: string;
  hoverBorderColorId?: string;
  /** Outline buttons only: fill added on hover. Omit = stays unfilled. */
  hoverBackgroundColorId?: string;
  textColorId?: string;
  hoverTextColorId?: string;
  typographyStyleId?: TypographyRole;
  /** Use a brand font slot or a custom font rule for this button. Omit = role. */
  typographySource?: CTATypographySource;
  /** Font family / weight / size when typographySource is "custom". */
  customTypography?: CTACustomTypography;
  /** Text size (rem) when using a brand font. Omit to use the brand font's size. */
  fontSize?: string;
  /** Per-style preview copy on Initial/Hover buttons. Falls back to DEFAULT_CTA_SAMPLE_TEXT. */
  sampleText?: string;
  /** Corner radius in px (0–24). Omit to use the shape default. */
  borderRadius?: number;
  /**
   * Stroke width in px (0–6).
   * Omit = template/fill default (outline is typically 2px). Explicit `0` = no border.
   */
  borderWidth?: number;
  /** Horizontal padding in px (8–48). Omit to use the template default. */
  paddingX?: number;
  /** Vertical padding in px (4–32). Omit to use the template default. */
  paddingY?: number;
  /** Override template shape (buttons). */
  shape?: CTAEditorShape;
  /** Override template fill (buttons). */
  fill?: CTAEditorFill;
  alignment?: CTAAlignment;
  /** Link style variant when kind is link. */
  linkVariant?: CTALinkVariant;
  /** Text-only decoration: plain, underlined, arrow, or both. */
  textDecoration?: CTATextDecoration;
  /** Button text casing. Unspecified buttons keep the previous uppercase default. */
  textTransform?: TextTransform;
  /**
   * Button letter-spacing (em).
   * Omit = previous 0.08em preview/print pin. Explicit `"0"` / `0` = no extra tracking.
   */
  letterSpacing?: string;
}

export function isCTACustomTypography(def: {
  typographySource?: CTATypographySource;
  customTypography?: CTACustomTypography;
}): def is { typographySource: "custom"; customTypography: CTACustomTypography } {
  return def.typographySource === "custom" && Boolean(def.customTypography?.fontFamily);
}

/** Default preview text when a CTA style has no custom sampleText. */
export const DEFAULT_CTA_SAMPLE_TEXT = "Work with us";

/** Per-style button preview copy, or the default “Work with us”. */
export function resolveCTASampleText(sampleText?: string): string {
  return sampleText?.trim() || DEFAULT_CTA_SAMPLE_TEXT;
}

export interface CTAStyle {
  id: string;
  name: string;
  kind: CTAKind;
  variant: CTAVariant;
  usage: string;
  sampleText: string;
  shape: CTAShape;
  fill: CTAFill;
  borderWidth: number;
  /** Custom corner radius in px. Unset uses the shape default. */
  borderRadius?: number;
  typographyStyleId: TypographyRole;
  typographySource?: CTATypographySource;
  customTypography?: CTACustomTypography;
  fontSize?: string;
  paddingX: string;
  paddingY: string;
  default: CTAVisualState;
  hover: CTAVisualState;
  templateId?: string;
  showArrow?: boolean;
  textTransform?: TextTransform;
  /**
   * Resolved button letter-spacing (em).
   * Omit on the saved definition becomes 0.08em; explicit `"0"` stays 0.
   */
  letterSpacing?: string;
  alignment?: CTAAlignment;
}

export function defaultCtaStyleName(index1Based: number): string {
  const n = Number.isFinite(index1Based) && index1Based >= 1 ? Math.floor(index1Based) : 1;
  return `Style ${n}`;
}

/**
 * Default button styles for new projects.
 * Uses single-slot palette roles (hero, accent-1, dark-1, light-1) so all three
 * stay visually distinct on minimal palettes.
 */
export const DEFAULT_CTA_STYLE_DEFINITIONS: CTAStyleDefinition[] = [
  {
    id: "cta-style-1",
    name: "Primary CTA",
    kind: "button",
    presetId: "btn-sharp-solid",
    shape: "square",
    fill: "solid",
    alignment: "center",
    initialFillColorId: "hero",
    textColorId: "light-1",
    hoverFillColorId: "accent-1",
    hoverTextColorId: "light-1",
    sampleText: DEFAULT_CTA_SAMPLE_TEXT,
  },
  {
    id: "cta-style-2",
    name: "Secondary CTA",
    kind: "button",
    presetId: "btn-sharp-outline",
    shape: "square",
    fill: "outline",
    alignment: "center",
    initialFillColorId: "hero",
    textColorId: "hero",
    hoverFillColorId: "dark-1",
    hoverTextColorId: "dark-1",
    sampleText: "Learn more",
  },
  {
    id: "cta-style-3",
    name: "Text link",
    kind: "link",
    presetId: "link-text-only",
    initialFillColorId: "hero",
    textColorId: "hero",
    hoverFillColorId: "accent-1",
    hoverTextColorId: "accent-1",
    textDecoration: "underlined",
    sampleText: "Read more",
  },
];

export const COLOR_ROLES: BrandColor["role"][] = [
  "hero",
  "accent",
  "light-neutral",
  "dark-neutral",
];

export const COLOR_ROLE_LABELS: Record<BrandColor["role"], string> = {
  hero: "Hero",
  accent: "Accent",
  "light-neutral": "Light Neutral",
  "dark-neutral": "Dark Neutral",
};

export const CTA_EDITOR_SHAPES: CTAEditorShape[] = ["square", "soft", "rounded", "pill", "oval"];

export const CTA_EDITOR_SHAPE_LABELS: Record<CTAEditorShape, string> = {
  square: "Square",
  soft: "Soft",
  rounded: "Rounded",
  pill: "Pill",
  oval: "Oval",
};

export const CTA_TEXT_DECORATIONS: CTATextDecoration[] = [
  "plain",
  "underlined",
  "arrow",
  "underline-arrow",
];

export const CTA_TEXT_DECORATION_LABELS: Record<CTATextDecoration, string> = {
  plain: "Plain",
  underlined: "Underlined",
  arrow: "Arrow",
  "underline-arrow": "Underline + arrow",
};

export const CTA_EDITOR_FILLS: CTAEditorFill[] = ["solid", "outline", "solid-outline"];

export const CTA_EDITOR_FILL_LABELS: Record<CTAEditorFill, string> = {
  solid: "Filled",
  outline: "Outline",
  "solid-outline": "Filled + outline",
};

/** Everything the Button Styler saves and exports. */
export interface ButtonStylerProject {
  version: 1;
  brandName: string;
  colors: BrandColor[];
  /** Favorite pairings imported from a Studio Code. Empty = suggest every readable pairing. */
  favoritePairings: ApprovedColorPairing[];
  typography: TypographyStyle[];
  ctaStyles: CTAStyleDefinition[];
  updatedAt: string;
}

export function newBrandFontId(): TypographyRole {
  return `font-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function createDefaultTypography(
  id: TypographyRole,
  fontFamily = "DM Sans",
): TypographyStyle {
  return {
    id,
    label: fontFamily,
    fontFamily,
    fontSource: "google",
    fontSize: "1.00rem",
    fontWeight: 600,
    fontStyle: "normal",
    lineHeight: "1.2",
  };
}

export function createDefaultProject(): ButtonStylerProject {
  return {
    version: 1,
    brandName: "",
    colors: [
      { id: "color-hero", name: "#4640DD", hex: "#4640DD", role: "hero" },
      { id: "color-accent", name: "#E8487A", hex: "#E8487A", role: "accent" },
      { id: "color-dark", name: "#141414", hex: "#141414", role: "dark-neutral" },
      { id: "color-light", name: "#FAFAF7", hex: "#FAFAF7", role: "light-neutral" },
    ],
    favoritePairings: [],
    typography: [createDefaultTypography("primary", "DM Sans")],
    ctaStyles: DEFAULT_CTA_STYLE_DEFINITIONS.map((style) => ({ ...style })),
    updatedAt: new Date().toISOString(),
  };
}
