import type { CSSProperties } from "react";
import type {
  BrandColor,
  CTAAlignment,
  CTACustomTypography,
  CTAEditorShape,
  CTAStyle,
  CTAVisualState,
  CTAShape,
  TypographyStyle,
} from "../types";
import { isCTACustomTypography } from "../types";
import { resolveColorHex } from "./colorResolve";
import { resolveCssFontFamily } from "./fontUtils";

const SHAPE_RADIUS: Record<CTAShape, string> = {
  pill: "9999px",
  oval: "50%",
  rounded: "8px",
  soft: "12px",
  sharp: "4px",
  square: "0",
};

/** Numeric radius for editor sliders. Pill/oval are fully rounded (no slider). */
export const CTA_SHAPE_RADIUS_PX: Record<CTAEditorShape, number | null> = {
  square: 0,
  soft: 12,
  rounded: 8,
  pill: null,
  oval: null,
};

export const CTA_RADIUS_SLIDER = { min: 0, max: 24, step: 1 } as const;
export const CTA_STROKE_SLIDER = { min: 0, max: 6, step: 1 } as const;
/** Matches typical template padding (~1.2–2rem / 0.6–0.75rem). */
export const CTA_PADDING_X_SLIDER = { min: 8, max: 48, step: 1 } as const;
export const CTA_PADDING_Y_SLIDER = { min: 4, max: 32, step: 1 } as const;

function clampCtaRadius(value: number): number {
  return Math.max(CTA_RADIUS_SLIDER.min, Math.min(CTA_RADIUS_SLIDER.max, Math.round(value)));
}

export function clampCtaPaddingX(value: number): number {
  return Math.max(CTA_PADDING_X_SLIDER.min, Math.min(CTA_PADDING_X_SLIDER.max, Math.round(value)));
}

export function clampCtaPaddingY(value: number): number {
  return Math.max(CTA_PADDING_Y_SLIDER.min, Math.min(CTA_PADDING_Y_SLIDER.max, Math.round(value)));
}

/** Parse a CSS padding token (`1.25rem`, `20px`, `0`) into whole pixels. */
export function parseCtaPaddingPx(value: string | undefined): number {
  if (!value) return 0;
  const trimmed = value.trim();
  const n = parseFloat(trimmed);
  if (!Number.isFinite(n)) return 0;
  if (trimmed.endsWith("rem")) return Math.round(n * 16);
  return Math.round(n);
}

export function resolveCtaPaddingCss(
  overridePx: number | undefined,
  templateValue: string,
  clamp: (value: number) => number,
): string {
  // Omit / NaN → template padding. Do not apply slider midpoints to old JSON.
  if (typeof overridePx === "number" && Number.isFinite(overridePx)) {
    return `${clamp(overridePx)}px`;
  }
  return templateValue;
}

export function ctaBorderRadius(shape: CTAShape, borderRadiusPx?: number): string {
  if (
    shape !== "pill" &&
    shape !== "oval" &&
    typeof borderRadiusPx === "number" &&
    Number.isFinite(borderRadiusPx)
  ) {
    return `${clampCtaRadius(borderRadiusPx)}px`;
  }
  return SHAPE_RADIUS[shape];
}

export function buildCTAAlignmentStyle(alignment: CTAAlignment = "center"): CSSProperties {
  return {
    display: "flex",
    width: "100%",
    justifyContent:
      alignment === "left" ? "flex-start" : alignment === "right" ? "flex-end" : "center",
  };
}

/** True when a CTA should paint a stroke. `0` is a real value — never treat it as “use default”. */
export function ctaHasVisibleBorder(borderWidth: number): boolean {
  return Number.isFinite(borderWidth) && borderWidth > 0;
}

function applyCtaBorder(
  style: CSSProperties,
  borderWidth: number,
  borderColor: string,
): void {
  if (!ctaHasVisibleBorder(borderWidth)) {
    style.border = "none";
    style.borderWidth = 0;
    return;
  }
  style.border = `${borderWidth}px solid ${borderColor}`;
}

export function buildCTAStateStyle(
  state: CTAVisualState,
  colors: BrandColor[],
  fill: CTAStyle["fill"],
  borderWidth: number,
): CSSProperties {
  const bg = resolveColorHex(state.backgroundColorId, colors, "transparent");
  const text = resolveColorHex(state.textColorId, colors, "#1A1A1A");
  const border = resolveColorHex(state.borderColorId, colors, "transparent");

  const style: CSSProperties = {
    color: text,
    textDecoration: state.underline ? "underline" : "none",
    textUnderlineOffset: state.underline ? "0.2em" : undefined,
  };

  if (fill === "solid" || fill === "solid-outline") {
    style.backgroundColor = bg;
    applyCtaBorder(style, borderWidth, border);
  } else if (fill === "outline") {
    style.backgroundColor = bg === "transparent" ? "transparent" : bg;
    applyCtaBorder(style, borderWidth, border);
  } else if (fill === "ghost") {
    style.backgroundColor = bg === "transparent" ? "transparent" : bg;
    applyCtaBorder(style, borderWidth, border);
  } else {
    style.backgroundColor = "transparent";
    applyCtaBorder(style, 0, border);
  }

  return style;
}

function fontFamilyStack(
  family: string,
  source?: CTACustomTypography["fontSource"],
  localFontStyle?: string,
): string {
  const familyStack = resolveCssFontFamily(family, source, localFontStyle);
  return familyStack.includes("system-ui")
    ? familyStack
    : familyStack.replace(/, sans-serif$/, ", system-ui, sans-serif");
}

/**
 * Previous `letter-spacing: 0.08em !important` pin on button previews/print.
 * Omitted `letterSpacing` on saved buttons must keep this look.
 * Explicit `0` / `"0"` is a real user value and must stay 0.
 */
export const DEFAULT_CTA_LETTER_SPACING = "0.08em";

export function isUnsetCtaLetterSpacing(value?: string | number): boolean {
  return value == null || (typeof value === "string" && value.trim() === "");
}

/** True when JSON stored an explicit zero (`0`, `"0"`, `"0em"`). Omit is not zero. */
export function isExplicitZeroCtaLetterSpacing(value?: string | number): boolean {
  if (isUnsetCtaLetterSpacing(value)) return false;
  const n = typeof value === "number" ? value : parseFloat(String(value).trim());
  return Number.isFinite(n) && n === 0;
}

/** Slider helper: zero (or empty while typing) displays as `"0"`. */
export function isDefaultCtaLetterSpacing(value?: string | number): boolean {
  return isUnsetCtaLetterSpacing(value) || isExplicitZeroCtaLetterSpacing(value);
}

/**
 * Resolve CTA letter-spacing.
 * - Omit / empty on buttons → `0.08em` (legacy CSS pin)
 * - Omit / empty on links → `"0"` (links were not pinned)
 * - Explicit `0` / `"0"` → `"0"` (new editor / user-set)
 */
export function resolveCtaLetterSpacing(
  value?: string | number,
  kind: CTAStyle["kind"] = "button",
): string {
  if (isExplicitZeroCtaLetterSpacing(value)) return "0";
  if (isUnsetCtaLetterSpacing(value)) {
    return kind === "link" ? "0" : DEFAULT_CTA_LETTER_SPACING;
  }
  return typeof value === "number" ? `${value}em` : String(value).trim();
}

export function buildCTATypographyStyle(
  typographyStyleId: TypographyStyle["id"],
  typography: TypographyStyle[],
  cta?: Pick<
    CTAStyle,
    "kind" | "textTransform" | "typographySource" | "customTypography" | "letterSpacing" | "fontSize"
  >,
): CSSProperties {
  const role = typography.find((t) => t.id === typographyStyleId) ?? typography[0];
  const custom = cta && isCTACustomTypography(cta) ? cta.customTypography : undefined;

  const fontFamily = custom?.fontFamily ?? role?.fontFamily;
  if (!fontFamily && !role) return {};

  const familyStack = fontFamily
    ? fontFamilyStack(
        fontFamily,
        custom?.fontSource ?? role?.fontSource,
        custom?.localFontStyle ?? role?.localFontStyle,
      )
    : undefined;

  return {
    fontFamily: familyStack,
    fontSize: custom?.fontSize ?? cta?.fontSize ?? role?.fontSize,
    fontWeight: custom?.fontWeight ?? role?.fontWeight,
    fontStyle: custom?.fontStyle ?? role?.fontStyle ?? "normal",
    lineHeight: role?.lineHeight ?? "1.2",
    letterSpacing: resolveCtaLetterSpacing(cta?.letterSpacing, cta?.kind),
    textTransform:
      cta?.textTransform ?? (cta?.kind === "link" ? "none" : "uppercase"),
  };
}

export function buildCTAStyle(
  cta: CTAStyle,
  state: "default" | "hover",
  colors: BrandColor[],
  typography: TypographyStyle[],
): CSSProperties {
  const visualState = state === "default" ? cta.default : cta.hover;
  const isLink = cta.kind === "link";

  return {
    ...buildCTATypographyStyle(cta.typographyStyleId, typography, cta),
    ...buildCTAStateStyle(visualState, colors, cta.fill, cta.borderWidth),
    borderRadius: isLink ? undefined : ctaBorderRadius(cta.shape, cta.borderRadius),
    padding: isLink ? undefined : `${cta.paddingY} ${cta.paddingX}`,
    display: isLink ? "inline" : "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    transition: "background-color 0.2s, color 0.2s, border-color 0.2s, text-decoration 0.2s",
    whiteSpace: "nowrap",
  };
}

export function ctaCssClassName(id: string): string {
  return `cta-${id}`;
}
