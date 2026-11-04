import type {
  CTAFill,
  CTAShape,
  CTAVariant,
  CTAVisualState,
  TypographyRole,
} from "../types";

export interface CTATemplate {
  id: string;
  name: string;
  hint: string;
  category: "button" | "link";
  variant: CTAVariant;
  shape: CTAShape;
  fill: CTAFill;
  borderWidth: number;
  paddingX: string;
  paddingY: string;
  typographyStyleId: TypographyRole;
  sampleText: string;
  showArrow?: boolean;
  default: CTAVisualState;
  hover: CTAVisualState;
}

/** New buttons and links use the primary brand font. */
export const BUTTON_TYPOGRAPHY_STYLE_ID: TypographyRole = "primary";
const btnTypo: TypographyRole = BUTTON_TYPOGRAPHY_STYLE_ID;
const linkTypo: TypographyRole = "primary";

const solidDefaults: CTAVisualState = {
  backgroundColorId: "hero",
  textColorId: "light-1",
  borderColorId: null,
  underline: false,
};

const solidHover: CTAVisualState = {
  backgroundColorId: "accent-1",
  textColorId: "light-1",
  borderColorId: null,
  underline: false,
};

const outlineDefaults: CTAVisualState = {
  backgroundColorId: null,
  textColorId: "hero",
  borderColorId: "hero",
  underline: false,
};

const outlineHover: CTAVisualState = {
  backgroundColorId: "hero",
  textColorId: "light-1",
  borderColorId: "hero",
  underline: false,
};

const ghostDefaults: CTAVisualState = {
  backgroundColorId: null,
  textColorId: "hero",
  borderColorId: null,
  underline: false,
};

const ghostHover: CTAVisualState = {
  backgroundColorId: null,
  textColorId: "accent-1",
  borderColorId: null,
  underline: false,
};

/** Curated button presets shown in the style picker */
export const CTA_BUTTON_PICKER_PRESETS: CTATemplate[] = [
  {
    id: "btn-pill-solid",
    name: "Pill",
    hint: "Fully rounded, filled",
    category: "button",
    variant: "primary",
    shape: "pill",
    fill: "solid",
    borderWidth: 0,
    paddingX: "1.5rem",
    paddingY: "0.75rem",
    typographyStyleId: btnTypo,
    sampleText: "Get started",
    default: solidDefaults,
    hover: solidHover,
  },
  {
    id: "btn-rounded-solid",
    name: "Rounded",
    hint: "Classic rounded, filled",
    category: "button",
    variant: "primary",
    shape: "rounded",
    fill: "solid",
    borderWidth: 0,
    paddingX: "1.35rem",
    paddingY: "0.7rem",
    typographyStyleId: btnTypo,
    sampleText: "Get started",
    default: solidDefaults,
    hover: solidHover,
  },
  {
    id: "btn-soft-solid",
    name: "Soft",
    hint: "Gentle curves, filled",
    category: "button",
    variant: "primary",
    shape: "soft",
    fill: "solid",
    borderWidth: 0,
    paddingX: "1.4rem",
    paddingY: "0.72rem",
    typographyStyleId: btnTypo,
    sampleText: "Get started",
    default: solidDefaults,
    hover: solidHover,
  },
  {
    id: "btn-pill-outline",
    name: "Pill outline",
    hint: "Fully rounded, outlined",
    category: "button",
    variant: "secondary",
    shape: "pill",
    fill: "outline",
    borderWidth: 2,
    paddingX: "1.4rem",
    paddingY: "0.7rem",
    typographyStyleId: btnTypo,
    sampleText: "Learn more",
    default: outlineDefaults,
    hover: outlineHover,
  },
  {
    id: "btn-rounded-outline",
    name: "Outline",
    hint: "Rounded corners, outlined",
    category: "button",
    variant: "secondary",
    shape: "rounded",
    fill: "outline",
    borderWidth: 2,
    paddingX: "1.25rem",
    paddingY: "0.625rem",
    typographyStyleId: btnTypo,
    sampleText: "Learn more",
    default: outlineDefaults,
    hover: outlineHover,
  },
  {
    id: "btn-soft-ghost",
    name: "Ghost",
    hint: "Text only, subtle hover",
    category: "button",
    variant: "ghost",
    shape: "soft",
    fill: "ghost",
    borderWidth: 0,
    paddingX: "1.2rem",
    paddingY: "0.65rem",
    typographyStyleId: btnTypo,
    sampleText: "Learn more",
    default: ghostDefaults,
    hover: ghostHover,
  },
];

/** Curated link presets shown in the style picker */
export const CTA_LINK_PICKER_PRESETS: CTATemplate[] = [
  {
    id: "link-underline",
    name: "Underline",
    hint: "Underline appears on hover",
    category: "link",
    variant: "link",
    shape: "sharp",
    fill: "text",
    borderWidth: 0,
    paddingX: "0",
    paddingY: "0",
    typographyStyleId: linkTypo,
    sampleText: "Read more",
    default: {
      backgroundColorId: null,
      textColorId: "accent-1",
      borderColorId: null,
      underline: false,
    },
    hover: {
      backgroundColorId: null,
      textColorId: "hero",
      borderColorId: null,
      underline: true,
    },
  },
  {
    id: "link-arrow",
    name: "Arrow",
    hint: "Directional link with arrow",
    category: "link",
    variant: "link",
    shape: "sharp",
    fill: "text",
    borderWidth: 0,
    paddingX: "0",
    paddingY: "0",
    typographyStyleId: linkTypo,
    sampleText: "Explore",
    showArrow: true,
    default: {
      backgroundColorId: null,
      textColorId: "hero",
      borderColorId: null,
      underline: false,
    },
    hover: {
      backgroundColorId: null,
      textColorId: "accent-1",
      borderColorId: null,
      underline: false,
    },
  },
  {
    id: "link-underline-always",
    name: "Always on",
    hint: "Underlined by default",
    category: "link",
    variant: "link",
    shape: "sharp",
    fill: "text",
    borderWidth: 0,
    paddingX: "0",
    paddingY: "0",
    typographyStyleId: linkTypo,
    sampleText: "View all",
    default: {
      backgroundColorId: null,
      textColorId: "accent-1",
      borderColorId: null,
      underline: true,
    },
    hover: {
      backgroundColorId: null,
      textColorId: "hero",
      borderColorId: null,
      underline: true,
    },
  },
];

/** All templates — picker presets plus legacy-only entries for ID resolution */
const LEGACY_ONLY_TEMPLATES: CTATemplate[] = [
  {
    id: "btn-sharp-solid",
    name: "Square",
    hint: "Sharp corners, filled",
    category: "button",
    variant: "primary",
    shape: "square",
    fill: "solid",
    borderWidth: 0,
    paddingX: "1.25rem",
    paddingY: "0.65rem",
    typographyStyleId: btnTypo,
    sampleText: "Get started",
    default: solidDefaults,
    hover: { ...solidHover, backgroundColorId: "dark-1" },
  },
  {
    id: "btn-sharp-outline",
    name: "Square outline",
    hint: "Sharp corners, outlined",
    category: "button",
    variant: "secondary",
    shape: "sharp",
    fill: "outline",
    borderWidth: 2,
    paddingX: "1.2rem",
    paddingY: "0.6rem",
    typographyStyleId: btnTypo,
    sampleText: "Learn more",
    default: outlineDefaults,
    hover: outlineHover,
  },
  {
    id: "btn-soft-outline",
    name: "Soft outline",
    hint: "Gentle curves, outlined",
    category: "button",
    variant: "secondary",
    shape: "soft",
    fill: "outline",
    borderWidth: 2,
    paddingX: "1.3rem",
    paddingY: "0.65rem",
    typographyStyleId: btnTypo,
    sampleText: "Learn more",
    default: outlineDefaults,
    hover: outlineHover,
  },
  {
    id: "btn-oval-solid",
    name: "Oval",
    hint: "Elliptical curve, filled",
    category: "button",
    variant: "primary",
    shape: "oval",
    fill: "solid",
    borderWidth: 0,
    paddingX: "2rem",
    paddingY: "0.65rem",
    typographyStyleId: btnTypo,
    sampleText: "Get started",
    default: solidDefaults,
    hover: solidHover,
  },
  {
    id: "btn-oval-outline",
    name: "Oval outline",
    hint: "Elliptical curve, outlined",
    category: "button",
    variant: "secondary",
    shape: "oval",
    fill: "outline",
    borderWidth: 2,
    paddingX: "1.85rem",
    paddingY: "0.6rem",
    typographyStyleId: btnTypo,
    sampleText: "Learn more",
    default: outlineDefaults,
    hover: outlineHover,
  },
  {
    id: "link-color",
    name: "Color only",
    hint: "Simple color shift",
    category: "link",
    variant: "link",
    shape: "sharp",
    fill: "text",
    borderWidth: 0,
    paddingX: "0",
    paddingY: "0",
    typographyStyleId: linkTypo,
    sampleText: "View all",
    default: {
      backgroundColorId: null,
      textColorId: "accent-1",
      borderColorId: null,
      underline: false,
    },
    hover: {
      backgroundColorId: null,
      textColorId: "hero",
      borderColorId: null,
      underline: false,
    },
  },
  {
    id: "link-text-only",
    name: "Text only",
    hint: "Colored text link for email. No background or border",
    category: "link",
    variant: "link",
    shape: "sharp",
    fill: "text",
    borderWidth: 0,
    paddingX: "0",
    paddingY: "0",
    typographyStyleId: linkTypo,
    sampleText: "Work with us",
    default: {
      backgroundColorId: null,
      textColorId: "accent-1",
      borderColorId: null,
      underline: false,
    },
    hover: {
      backgroundColorId: null,
      textColorId: "hero",
      borderColorId: null,
      underline: false,
    },
  },
];

export const CTA_BUTTON_TEMPLATES: CTATemplate[] = CTA_BUTTON_PICKER_PRESETS;
export const CTA_LINK_TEMPLATES: CTATemplate[] = CTA_LINK_PICKER_PRESETS;

export const CTA_TEMPLATES: CTATemplate[] = [
  ...CTA_BUTTON_PICKER_PRESETS,
  ...CTA_LINK_PICKER_PRESETS,
  ...LEGACY_ONLY_TEMPLATES.filter(
    (t) => !CTA_BUTTON_PICKER_PRESETS.some((p) => p.id === t.id) &&
      !CTA_LINK_PICKER_PRESETS.some((p) => p.id === t.id),
  ),
];

export const CTA_TEMPLATE_MAP = new Map(CTA_TEMPLATES.map((t) => [t.id, t]));

/** One-row quick picker: 4 buttons + 2 links. */
export const CTA_QUICK_PRESET_IDS = [
  "btn-pill-solid",
  "btn-rounded-solid",
  "btn-rounded-outline",
  "btn-soft-ghost",
  "link-underline",
  "link-arrow",
] as const;

export const CTA_QUICK_PRESET_LABELS: Record<(typeof CTA_QUICK_PRESET_IDS)[number], string> = {
  "btn-pill-solid": "Pill",
  "btn-rounded-solid": "Rounded",
  "btn-rounded-outline": "Outline",
  "btn-soft-ghost": "Ghost",
  "link-underline": "Underline",
  "link-arrow": "Arrow link",
};

/** Map removed catalog templates to closest preset */
export const CTA_LEGACY_TEMPLATE_MAP: Record<string, string> = {
  "btn-accent-solid": "btn-pill-solid",
  "btn-dark-solid": "btn-sharp-solid",
  "btn-accent-outline": "btn-soft-outline",
  "btn-bold-outline": "btn-sharp-outline",
  "btn-pill-ghost": "btn-soft-ghost",
  "btn-rounded-ghost": "btn-soft-ghost",
  "btn-tertiary-soft": "btn-soft-solid",
  "btn-soft-shadow": "btn-soft-solid",
  "link-bold": "link-underline",
  "link-subtle": "link-color",
  "link-accent-underline": "link-underline-always",
  "link-text-only": "link-text-only",
};
