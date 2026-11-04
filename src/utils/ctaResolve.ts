import {
  CTA_QUICK_PRESET_IDS,
  CTA_LEGACY_TEMPLATE_MAP,
  CTA_LINK_PICKER_PRESETS,
  CTA_TEMPLATE_MAP,
} from "../data/ctaTemplates";
import type {
  ApprovedColorPairing,
  BrandColor,
  CTAFill,
  CTAAlignment,
  CTAEditorFill,
  CTAEditorShape,
  CTALinkVariant,
  CTAShape,
  CTAStyle,
  CTAStyleDefinition,
  CTATextDecoration,
  CTAVisualState,
  TextTransform,
  TypographyStyle,
} from "../types";
import { defaultCtaStyleName, resolveCTASampleText } from "../types";
import type { CTATemplate } from "../data/ctaTemplates";
import {
  clampCtaPaddingX,
  clampCtaPaddingY,
  resolveCtaLetterSpacing,
  resolveCtaPaddingCss,
} from "./ctaCss";
import { resolveColorId } from "./colorResolve";
import { getContrastRatio, getRelativeLuminance, isLightColor } from "./colorUtils";

export const MIN_CTA_CONTRAST = 4.5;

const BG_PAIRING_PRIORITY = ["hero", "accent-1", "accent-2", "dark-1", "light-1"] as const;

function paletteColors(colors: BrandColor[]): BrandColor[] {
  return colors.filter((c) => (c.role as string) !== "semantic");
}

function colorRolePriority(colorId: string, colors: BrandColor[]): number {
  const color = colors.find((c) => c.id === colorId);
  if (!color) return 99;
  if (color.role === "hero") return 0;
  if (color.role === "accent") return 1;
  if (color.role === "dark-neutral") return 2;
  if (color.role === "light-neutral") return 3;
  return 4;
}

export function sortPairingsByPriority(
  pairings: ApprovedColorPairing[],
  colors: BrandColor[],
): ApprovedColorPairing[] {
  return [...pairings].sort((a, b) => {
    const aPriority = colorRolePriority(a.backgroundColorId, colors);
    const bPriority = colorRolePriority(b.backgroundColorId, colors);
    if (aPriority !== bPriority) return aPriority - bPriority;

    const aBgIndex = BG_PAIRING_PRIORITY.indexOf(
      a.backgroundColorId as (typeof BG_PAIRING_PRIORITY)[number],
    );
    const bBgIndex = BG_PAIRING_PRIORITY.indexOf(
      b.backgroundColorId as (typeof BG_PAIRING_PRIORITY)[number],
    );
    const aOrder = aBgIndex === -1 ? 99 : aBgIndex;
    const bOrder = bBgIndex === -1 ? 99 : bBgIndex;
    return aOrder - bOrder;
  });
}

export function colorHexById(
  colorId: string | null | undefined,
  colors: BrandColor[],
): string | null {
  const resolvedId = resolveColorId(colorId, colors);
  if (!resolvedId) return null;
  return colors.find((c) => c.id === resolvedId)?.hex ?? null;
}

export function colorsMatchByIdOrHex(
  id1: string | null | undefined,
  id2: string | null | undefined,
  colors: BrandColor[],
): boolean {
  if (!id1 || !id2) return false;
  const resolved1 = resolveColorId(id1, colors) ?? id1;
  const resolved2 = resolveColorId(id2, colors) ?? id2;
  if (resolved1 === resolved2) return true;
  const hex1 = colorHexById(resolved1, colors);
  const hex2 = colorHexById(resolved2, colors);
  return !!hex1 && !!hex2 && hex1.toUpperCase() === hex2.toUpperCase();
}

export function hasAdequateContrast(
  textColorId: string | null | undefined,
  backgroundColorId: string | null | undefined,
  colors: BrandColor[],
  minRatio = MIN_CTA_CONTRAST,
): boolean {
  if (!textColorId || !backgroundColorId) return false;
  if (colorsMatchByIdOrHex(textColorId, backgroundColorId, colors)) return false;
  const textHex = colorHexById(textColorId, colors);
  const bgHex = colorHexById(backgroundColorId, colors);
  if (!textHex || !bgHex) return false;
  return getContrastRatio(textHex, bgHex) >= minRatio;
}

export function computeAccessiblePairings(
  colors: BrandColor[],
  minRatio = MIN_CTA_CONTRAST,
): ApprovedColorPairing[] {
  const palette = paletteColors(colors);
  const unique: BrandColor[] = [];
  const seenHex = new Set<string>();
  for (const color of palette) {
    const hex = color.hex.toUpperCase();
    if (!seenHex.has(hex)) {
      seenHex.add(hex);
      unique.push(color);
    }
  }

  const pairings: ApprovedColorPairing[] = [];
  for (const background of unique) {
    for (const text of unique) {
      if (text.hex.toUpperCase() === background.hex.toUpperCase()) continue;
      if (getContrastRatio(text.hex, background.hex) >= minRatio) {
        pairings.push({
          textColorId: text.id,
          backgroundColorId: background.id,
        });
      }
    }
  }

  return sortPairingsByPriority(pairings, palette);
}

export function getEffectivePairings(
  approvedPairings: ApprovedColorPairing[],
  colors: BrandColor[],
): ApprovedColorPairing[] {
  const palette = paletteColors(colors);
  if (!palette.length) return [];

  if (approvedPairings.length > 0) {
    const valid = sortPairingsByPriority(approvedPairings, palette).filter((pairing) =>
      hasAdequateContrast(pairing.textColorId, pairing.backgroundColorId, palette),
    );
    if (valid.length > 0) return valid;
  }

  return computeAccessiblePairings(palette);
}

export interface ResolvedApprovedPairing {
  pairing: ApprovedColorPairing;
  text: BrandColor;
  background: BrandColor;
}

/** User-approved pairings whose colors still exist in the palette. No computed fallbacks. */
export function resolveUserApprovedPairings(
  approvedPairings: ApprovedColorPairing[],
  colors: BrandColor[],
): ResolvedApprovedPairing[] {
  const palette = paletteColors(colors);
  const byId = new Map(palette.map((color) => [color.id, color]));
  const seen = new Set<string>();
  const resolved: ResolvedApprovedPairing[] = [];

  for (const pairing of approvedPairings) {
    const text = byId.get(pairing.textColorId);
    const background = byId.get(pairing.backgroundColorId);
    if (!text || !background) continue;
    const key = `${pairing.textColorId}|${pairing.backgroundColorId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    resolved.push({ pairing, text, background });
  }

  return resolved;
}

export interface ApprovedPairingCtaColors {
  fillColorId: string;
  textColorId: string;
  borderColorId?: string;
}

/**
 * Map an approved text/background pairing onto one CTA state's color IDs.
 * The button editor applies this independently for Initial and Hover —
 * clicking a pairing never writes the other state.
 *
 * Solid / solid-outline: fill = pairing background, text = pairing text (border = text when needed).
 * Outline: text + stroke from pairing text (transparent fill).
 * Text-only: both fill and text IDs are the pairing text color.
 */
export function mapApprovedPairingToCtaColors(
  pairing: ApprovedColorPairing,
  options: {
    styleType: "button" | "text-only";
    fill: CTAEditorFill;
    needsBorder?: boolean;
  },
): ApprovedPairingCtaColors {
  const { textColorId, backgroundColorId } = pairing;

  if (options.styleType === "text-only") {
    return { fillColorId: textColorId, textColorId };
  }

  if (options.fill === "outline") {
    return {
      fillColorId: textColorId,
      textColorId,
      borderColorId: textColorId,
    };
  }

  return {
    fillColorId: backgroundColorId,
    textColorId,
    ...(options.needsBorder || options.fill === "solid-outline"
      ? { borderColorId: textColorId }
      : {}),
  };
}

export type ApprovedPairingHoverSource = "companion" | "derived";

export interface ApprovedPairingCtaStates {
  initial: ApprovedPairingCtaColors;
  hover: ApprovedPairingCtaColors;
  hoverSource: ApprovedPairingHoverSource;
  /** Companion pairing used for hover, when hoverSource is "companion". */
  hoverPairing?: ApprovedColorPairing;
}

export type ApprovedPairingMapOptions = {
  styleType: "button" | "text-only";
  fill: CTAEditorFill;
  needsBorder?: boolean;
};

function pairingsMatch(
  a: ApprovedColorPairing,
  b: ApprovedColorPairing,
  colors: BrandColor[],
): boolean {
  return (
    colorsMatchByIdOrHex(a.textColorId, b.textColorId, colors) &&
    colorsMatchByIdOrHex(a.backgroundColorId, b.backgroundColorId, colors)
  );
}

function isInvertedPairing(
  a: ApprovedColorPairing,
  b: ApprovedColorPairing,
  colors: BrandColor[],
): boolean {
  return (
    colorsMatchByIdOrHex(a.textColorId, b.backgroundColorId, colors) &&
    colorsMatchByIdOrHex(a.backgroundColorId, b.textColorId, colors)
  );
}

function mappedColorsDiffer(
  a: ApprovedPairingCtaColors,
  b: ApprovedPairingCtaColors,
  colors: BrandColor[],
): boolean {
  if (!colorsMatchByIdOrHex(a.fillColorId, b.fillColorId, colors)) return true;
  if (!colorsMatchByIdOrHex(a.textColorId, b.textColorId, colors)) return true;
  if (a.borderColorId || b.borderColorId) {
    return !colorsMatchByIdOrHex(a.borderColorId, b.borderColorId, colors);
  }
  return false;
}

/**
 * Pick a hover companion for a clicked approved pairing.
 *
 * Rule:
 * 1. Two chips → the other pairing is always hover (A→B, B→A).
 * 2. Three or more → prefer another pairing that shares the text color
 *    (same text, different background), then an inverted pairing,
 *    then one that shares the background with different text.
 * 3. No shared-color companion → null so the caller can derive hover.
 */
export function pickCompanionPairing(
  clicked: ApprovedColorPairing,
  approvedPairings: ApprovedColorPairing[],
  colors: BrandColor[],
): ApprovedColorPairing | null {
  const palette = paletteColors(colors);
  const others = approvedPairings.filter((pairing) => !pairingsMatch(pairing, clicked, palette));
  if (others.length === 0) return null;

  if (approvedPairings.length === 2 && others.length === 1) {
    return others[0];
  }

  let best: { pairing: ApprovedColorPairing; score: number } | null = null;
  for (const other of others) {
    const sameText = colorsMatchByIdOrHex(other.textColorId, clicked.textColorId, palette);
    const sameBg = colorsMatchByIdOrHex(other.backgroundColorId, clicked.backgroundColorId, palette);
    const inverted = isInvertedPairing(clicked, other, palette);

    let score = 0;
    if (sameText && !sameBg) score = 3;
    else if (inverted) score = 2;
    else if (sameBg && !sameText) score = 1;
    if (score > 0 && (!best || score > best.score)) {
      best = { pairing: other, score };
    }
  }

  return best?.pairing ?? null;
}

function deriveHoverFromSamePairing(
  pairing: ApprovedColorPairing,
  initial: ApprovedPairingCtaColors,
  options: ApprovedPairingMapOptions,
  colors: BrandColor[],
): ApprovedPairingCtaColors {
  const palette = paletteColors(colors);

  if (options.styleType === "text-only") {
    if (!colorsMatchByIdOrHex(pairing.textColorId, pairing.backgroundColorId, palette)) {
      return { fillColorId: pairing.backgroundColorId, textColorId: pairing.backgroundColorId };
    }
    const suggested = suggestHoverColors(
      initial.fillColorId,
      initial.textColorId,
      [pairing],
      palette,
    );
    return { fillColorId: suggested.hoverFillColorId, textColorId: suggested.hoverFillColorId };
  }

  const fillHex = colorHexById(initial.fillColorId, palette);
  if (fillHex) {
    const fillLum = getRelativeLuminance(fillHex);
    const wantDarker = isLightColor(fillHex);
    const candidates = palette
      .filter((color) => !colorsMatchByIdOrHex(color.id, initial.fillColorId, palette))
      .map((color) => ({ color, lum: getRelativeLuminance(color.hex) }))
      .filter((entry) =>
        wantDarker ? entry.lum < fillLum - 0.04 : entry.lum > fillLum + 0.04,
      )
      .sort((a, b) => Math.abs(a.lum - fillLum) - Math.abs(b.lum - fillLum));

    for (const { color } of candidates) {
      if (options.fill === "outline") {
        return {
          fillColorId: color.id,
          textColorId: color.id,
          borderColorId: color.id,
        };
      }

      const keepText = hasAdequateContrast(initial.textColorId, color.id, palette);
      const textColorId = keepText
        ? initial.textColorId
        : ensureContrastingText(color.id, initial.textColorId, [pairing], palette);
      if (!hasAdequateContrast(textColorId, color.id, palette)) continue;

      return {
        fillColorId: color.id,
        textColorId,
        ...(initial.borderColorId
          ? { borderColorId: keepText ? initial.borderColorId : textColorId }
          : {}),
      };
    }
  }

  const suggested = suggestHoverColors(
    initial.fillColorId,
    initial.textColorId,
    [pairing],
    palette,
  );
  return {
    fillColorId: suggested.hoverFillColorId,
    textColorId: suggested.hoverTextColorId,
    ...(initial.borderColorId ? { borderColorId: suggested.hoverTextColorId } : {}),
  };
}

/**
 * Suggest both initial and hover colors from one pairing (defaults / new styles).
 * The button editor does not use this on pairing click — each state is mapped
 * independently with {@link mapApprovedPairingToCtaColors}.
 *
 * Hover pairing rule when this helper is used:
 * - Initial always uses {@link mapApprovedPairingToCtaColors} for the pairing.
 * - Hover prefers a companion approved pairing (see {@link pickCompanionPairing}):
 *   two chips swap (A↔B); more chips prefer same-text / inverted / same-bg.
 * - If no companion exists, hover is derived from the same pairing: a slightly
 *   darker or lighter palette fill (text kept when contrast still holds), then
 *   the existing {@link suggestHoverColors} fallback.
 */
export function mapApprovedPairingToCtaStates(
  pairing: ApprovedColorPairing,
  approvedPairings: ApprovedColorPairing[],
  options: ApprovedPairingMapOptions,
  colors: BrandColor[],
): ApprovedPairingCtaStates {
  const palette = paletteColors(colors);
  const initial = mapApprovedPairingToCtaColors(pairing, options);
  const companion = pickCompanionPairing(pairing, approvedPairings, palette);

  if (companion) {
    const hover = mapApprovedPairingToCtaColors(companion, options);
    if (mappedColorsDiffer(initial, hover, palette)) {
      return { initial, hover, hoverSource: "companion", hoverPairing: companion };
    }
  }

  return {
    initial,
    hover: deriveHoverFromSamePairing(pairing, initial, options, palette),
    hoverSource: "derived",
  };
}

export function ensureContrastingText(
  backgroundColorId: string,
  textColorId: string | null | undefined,
  approvedPairings: ApprovedColorPairing[],
  colors: BrandColor[],
): string {
  if (
    textColorId &&
    hasAdequateContrast(textColorId, backgroundColorId, colors) &&
    !colorsMatchByIdOrHex(textColorId, backgroundColorId, colors)
  ) {
    return resolveColorId(textColorId, colors) ?? textColorId;
  }

  return resolveTextColorForBackground(backgroundColorId, approvedPairings, colors);
}

function normalizeVisualStateColorIds(
  state: CTAVisualState,
  colors: BrandColor[],
): CTAVisualState {
  const normalize = (id: string | null | undefined) =>
    id ? (resolveColorId(id, colors) ?? id) : id;

  return {
    ...state,
    backgroundColorId: normalize(state.backgroundColorId) ?? state.backgroundColorId,
    textColorId: normalize(state.textColorId) ?? state.textColorId,
    borderColorId: normalize(state.borderColorId) ?? state.borderColorId,
  };
}

const BUTTON_USAGE =
  "Use for call-to-action buttons: sign up, purchase, learn more, and other clickable actions.";
const LINK_USAGE =
  "Use for inline text links within copy: articles, footers, and secondary navigation.";

const BUTTON_PRESET_BY_SHAPE_FILL: Record<`${CTAEditorShape}-${CTAEditorFill}`, string> = {
  "square-solid": "btn-sharp-solid",
  "soft-solid": "btn-soft-solid",
  "rounded-solid": "btn-rounded-solid",
  "pill-solid": "btn-pill-solid",
  "oval-solid": "btn-oval-solid",
  "square-outline": "btn-sharp-outline",
  "soft-outline": "btn-soft-outline",
  "rounded-outline": "btn-rounded-outline",
  "pill-outline": "btn-pill-outline",
  "oval-outline": "btn-oval-outline",
  "square-solid-outline": "btn-sharp-solid",
  "soft-solid-outline": "btn-soft-solid",
  "rounded-solid-outline": "btn-rounded-solid",
  "pill-solid-outline": "btn-pill-solid",
  "oval-solid-outline": "btn-oval-solid",
};

const LINK_PRESET_BY_VARIANT: Record<CTALinkVariant, string> = {
  underline: "link-underline",
  "always-underline": "link-underline-always",
  arrow: "link-arrow",
};

export const TEXT_ONLY_PRESET_ID = "link-text-only";

export function isTextOnlyStyle(def: Pick<CTAStyleDefinition, "kind" | "presetId">): boolean {
  return def.kind === "link" && resolveTemplateId(def.presetId) === TEXT_ONLY_PRESET_ID;
}

/** Buttons default to uppercase; links stay normal case unless customized. */
export function resolveCTATextTransform(
  def: Pick<CTAStyleDefinition, "kind" | "textTransform">,
  isLink = def.kind === "link",
): TextTransform {
  return def.textTransform ?? (isLink ? "none" : "uppercase");
}

export function textDecorationFromDefinition(
  def: Pick<CTAStyleDefinition, "textDecoration">,
): CTATextDecoration {
  return def.textDecoration ?? "plain";
}

function applyTextDecoration(def: CTAStyleDefinition, style: CTAStyle): CTAStyle {
  if (!isTextOnlyStyle(def)) return style;

  const decoration = textDecorationFromDefinition(def);
  const underlined = decoration === "underlined" || decoration === "underline-arrow";
  const showArrow = decoration === "arrow" || decoration === "underline-arrow";

  return {
    ...style,
    showArrow,
    default: { ...style.default, underline: underlined },
    hover: { ...style.hover, underline: underlined },
  };
}

const EDITOR_SHAPE_FROM_TEMPLATE: Record<CTAShape, CTAEditorShape> = {
  square: "square",
  sharp: "square",
  soft: "soft",
  rounded: "rounded",
  pill: "pill",
  oval: "oval",
};

export function editorShapeFromTemplate(shape: CTAShape): CTAEditorShape {
  return EDITOR_SHAPE_FROM_TEMPLATE[shape];
}

export function linkVariantFromPresetId(presetId: string): CTALinkVariant {
  const resolved = resolveTemplateId(presetId);
  if (resolved === "link-underline-always") return "always-underline";
  if (resolved === "link-arrow") return "arrow";
  return "underline";
}

export function presetIdFromEditorOptions(
  kind: CTAStyleDefinition["kind"],
  shape: CTAEditorShape,
  fill: CTAEditorFill,
  linkVariant: CTALinkVariant,
): string {
  if (kind === "link") return LINK_PRESET_BY_VARIANT[linkVariant];
  return BUTTON_PRESET_BY_SHAPE_FILL[`${shape}-${fill}`];
}

export function getEditorOptionsFromDefinition(def: CTAStyleDefinition): {
  shape: CTAEditorShape;
  fill: CTAEditorFill;
  linkVariant: CTALinkVariant;
  alignment: CTAAlignment;
} {
  const template = CTA_TEMPLATE_MAP.get(resolveTemplateId(def.presetId));
  const shape = def.shape ?? (template ? editorShapeFromTemplate(template.shape) : "rounded");
  const fill =
    def.fill ??
    (template?.fill === "outline" ? "outline" : "solid");
  const linkVariant =
    def.linkVariant ?? (def.kind === "link" ? linkVariantFromPresetId(def.presetId) : "underline");
  const alignment = def.alignment ?? "center";
  return { shape, fill, linkVariant, alignment };
}

export function createNewStyleDefinition(
  kind: CTAStyleDefinition["kind"],
  approvedPairings: ApprovedColorPairing[],
  colors: BrandColor[] = [],
  textOnly = false,
): CTAStyleDefinition {
  if (kind === "link" || textOnly) {
    return createStyleFromPreset(TEXT_ONLY_PRESET_ID, "link", approvedPairings, colors);
  }
  const created = createStyleFromPreset("btn-sharp-solid", "button", approvedPairings, colors);
  return {
    ...created,
    shape: "square",
    fill: "solid",
    alignment: "center",
  };
}

export function resolveTemplateId(templateId: string): string {
  return CTA_LEGACY_TEMPLATE_MAP[templateId] ?? templateId;
}

export function resolveTextColorForBackground(
  bgColorId: string,
  approvedPairings: ApprovedColorPairing[],
  colors: BrandColor[],
): string {
  const palette = paletteColors(colors);
  const resolvedBgId = resolveColorId(bgColorId, palette) ?? bgColorId;
  const pairings = getEffectivePairings(approvedPairings, palette);

  const fromPairing = pairings.find(
    (p) => resolveColorId(p.backgroundColorId, palette) === resolvedBgId,
  )?.textColorId;
  if (fromPairing) {
    const resolvedText = resolveColorId(fromPairing, palette) ?? fromPairing;
    if (hasAdequateContrast(resolvedText, resolvedBgId, palette)) {
      return resolvedText;
    }
  }

  for (const pairing of pairings) {
    const textId = resolveColorId(pairing.textColorId, palette) ?? pairing.textColorId;
    if (hasAdequateContrast(textId, resolvedBgId, palette)) {
      return textId;
    }
  }

  const bg = palette.find((c) => c.id === resolvedBgId);
  if (!bg) {
    const fallback =
      resolveColorId("light-1", palette) ??
      palette.find((c) => c.role === "light-neutral")?.id ??
      palette[0]?.id ??
      "light-1";
    if (hasAdequateContrast(fallback, resolvedBgId, palette)) return fallback;
    return palette.find((c) => hasAdequateContrast(c.id, resolvedBgId, palette))?.id ?? fallback;
  }

  const candidates = palette.filter(
    (c) => !colorsMatchByIdOrHex(c.id, resolvedBgId, palette),
  );

  const best = candidates
    .map((candidate) => ({
      id: candidate.id,
      ratio: getContrastRatio(candidate.hex, bg.hex),
    }))
    .filter((entry) => entry.ratio >= MIN_CTA_CONTRAST)
    .sort((a, b) => b.ratio - a.ratio)[0];
  if (best) return best.id;

  const light =
    palette.find((c) => c.id === (resolveColorId("light-1", palette) ?? "light-1")) ??
    palette.find((c) => c.role === "light-neutral");
  const dark =
    palette.find((c) => c.id === (resolveColorId("dark-1", palette) ?? "dark-1")) ??
    palette.find((c) => c.role === "dark-neutral");

  const heuristic = isLightColor(bg.hex)
    ? (dark?.id ?? resolveColorId("dark-1", palette) ?? palette[0]?.id ?? "dark-1")
    : (light?.id ?? resolveColorId("light-1", palette) ?? palette[0]?.id ?? "light-1");

  if (hasAdequateContrast(heuristic, resolvedBgId, palette)) {
    return heuristic;
  }

  const anyContrast = candidates.find((candidate) =>
    hasAdequateContrast(candidate.id, resolvedBgId, palette),
  );
  return anyContrast?.id ?? heuristic;
}

function applyInitialColor(
  state: CTAVisualState,
  fill: CTAFill,
  colorId: string,
): CTAVisualState {
  const next = { ...state };
  if (fill === "solid" || fill === "solid-outline") {
    next.backgroundColorId = colorId;
  } else if (fill === "outline") {
    next.borderColorId = colorId;
    next.textColorId = colorId;
  } else if (fill === "ghost" || fill === "text") {
    next.textColorId = colorId;
  }
  return next;
}

function applyHoverColor(
  defaultState: CTAVisualState,
  hoverState: CTAVisualState,
  fill: CTAFill,
  colorId: string,
  approvedPairings: ApprovedColorPairing[],
  colors: BrandColor[],
  explicitTextColorId?: string,
): CTAVisualState {
  const next = { ...hoverState };
  if (fill === "solid" || fill === "solid-outline") {
    next.backgroundColorId = colorId;
    next.textColorId =
      explicitTextColorId ??
      ensureContrastingText(
        colorId,
        hoverState.textColorId ?? defaultState.textColorId,
        approvedPairings,
        colors,
      );
  } else if (fill === "outline") {
    next.backgroundColorId = colorId;
    next.borderColorId = colorId;
    next.textColorId =
      explicitTextColorId ??
      ensureContrastingText(
        colorId,
        hoverState.textColorId ?? defaultState.textColorId,
        approvedPairings,
        colors,
      );
  } else if (fill === "ghost" || fill === "text") {
    next.textColorId = explicitTextColorId ?? colorId;
  }
  return next;
}

function guardVisualStateContrast(
  state: CTAVisualState,
  approvedPairings: ApprovedColorPairing[],
  colors: BrandColor[],
): CTAVisualState {
  if (!state.backgroundColorId) return state;
  return {
    ...state,
    textColorId: ensureContrastingText(
      state.backgroundColorId,
      state.textColorId,
      approvedPairings,
      colors,
    ),
  };
}

function getDefinitionFill(def: CTAStyleDefinition, template: CTATemplate): CTAFill {
  const editorFill = getEditorOptionsFromDefinition(def).fill;
  return editorFill === "solid-outline" ? "solid-outline" : template.fill;
}

export function ctaDefinitionNeedsColorFix(
  def: CTAStyleDefinition,
  colors: BrandColor[],
): boolean {
  const palette = paletteColors(colors);
  if (!palette.length) return false;

  const template = CTA_TEMPLATE_MAP.get(resolveTemplateId(def.presetId));
  if (!template) return false;

  if (isTextOnlyStyle(def)) {
    if (
      def.initialFillColorId &&
      def.hoverFillColorId &&
      colorsMatchByIdOrHex(def.initialFillColorId, def.hoverFillColorId, palette)
    ) {
      return true;
    }
    return false;
  }

  const fill = getDefinitionFill(def, template);

  if (fill === "solid" || fill === "solid-outline") {
    if (
      def.initialFillColorId &&
      def.textColorId &&
      (!hasAdequateContrast(def.textColorId, def.initialFillColorId, palette) ||
        colorsMatchByIdOrHex(def.textColorId, def.initialFillColorId, palette))
    ) {
      return true;
    }
  }

  if (fill === "solid" || fill === "solid-outline" || fill === "outline") {
    if (
      def.hoverFillColorId &&
      def.hoverTextColorId &&
      (!hasAdequateContrast(def.hoverTextColorId, def.hoverFillColorId, palette) ||
        colorsMatchByIdOrHex(def.hoverTextColorId, def.hoverFillColorId, palette))
    ) {
      return true;
    }
  }

  return false;
}

export function reconcileCTAStyleDefinition(
  def: CTAStyleDefinition,
  colors: BrandColor[],
  approvedPairings: ApprovedColorPairing[],
  pairingIndex = 0,
): CTAStyleDefinition {
  const palette = paletteColors(colors);
  if (!palette.length) return def;

  const pairings = getEffectivePairings(approvedPairings, palette);
  const template = CTA_TEMPLATE_MAP.get(resolveTemplateId(def.presetId));
  if (!template) return def;

  let result: CTAStyleDefinition = { ...def };

  for (const field of [
    "initialFillColorId",
    "hoverFillColorId",
    "initialBorderColorId",
    "hoverBorderColorId",
    "textColorId",
    "hoverTextColorId",
  ] as const) {
    const value = result[field];
    if (typeof value === "string") {
      result[field] = resolveColorId(value, palette) ?? value;
    }
  }

  if (isTextOnlyStyle(result)) {
    if (
      result.initialFillColorId &&
      result.hoverFillColorId &&
      colorsMatchByIdOrHex(result.initialFillColorId, result.hoverFillColorId, palette)
    ) {
      const alternate = palette.find(
        (c) => !colorsMatchByIdOrHex(c.id, result.initialFillColorId, palette),
      );
      if (alternate) {
        result.hoverFillColorId = alternate.id;
        result.hoverTextColorId = alternate.id;
      }
    }
    return result;
  }

  const fill = getDefinitionFill(result, template);
  const pairing = pairings[pairingIndex % Math.max(pairings.length, 1)];

  if ((fill === "solid" || fill === "solid-outline") && pairing) {
    const needsDefaultFix =
      !result.initialFillColorId ||
      !result.textColorId ||
      !hasAdequateContrast(result.textColorId, result.initialFillColorId, palette) ||
      colorsMatchByIdOrHex(result.textColorId, result.initialFillColorId, palette);

    if (needsDefaultFix) {
      result = {
        ...result,
        initialFillColorId: pairing.backgroundColorId,
        textColorId: pairing.textColorId,
      };
    } else if (result.initialFillColorId && result.textColorId) {
      result = {
        ...result,
        textColorId: ensureContrastingText(
          result.initialFillColorId,
          result.textColorId,
          pairings,
          palette,
        ),
      };
    }
  }

  if (
    (fill === "solid" || fill === "solid-outline" || fill === "outline") &&
    result.initialFillColorId &&
    result.textColorId
  ) {
    const needsHoverFix =
      !result.hoverFillColorId ||
      !result.hoverTextColorId ||
      !hasAdequateContrast(result.hoverTextColorId, result.hoverFillColorId, palette) ||
      colorsMatchByIdOrHex(result.hoverTextColorId, result.hoverFillColorId, palette);

    if (needsHoverFix) {
      const hover = suggestHoverColors(
        result.initialFillColorId,
        result.textColorId,
        pairings,
        palette,
      );
      result = {
        ...result,
        hoverFillColorId: hover.hoverFillColorId,
        hoverTextColorId: hover.hoverTextColorId,
      };
    } else if (result.hoverFillColorId) {
      result = {
        ...result,
        hoverTextColorId: ensureContrastingText(
          result.hoverFillColorId,
          result.hoverTextColorId,
          pairings,
          palette,
        ),
      };
    }
  }

  return result;
}

export function reconcileCTAStyleDefinitions(
  definitions: CTAStyleDefinition[],
  colors: BrandColor[],
  approvedPairings: ApprovedColorPairing[],
): CTAStyleDefinition[] {
  let pairingOffset = 0;
  return definitions.map((def) => {
    if (!ctaDefinitionNeedsColorFix(def, colors)) return def;
    const reconciled = reconcileCTAStyleDefinition(
      def,
      colors,
      approvedPairings,
      pairingOffset,
    );
    pairingOffset += 1;
    return reconciled;
  });
}

export function suggestHoverColors(
  fillColorId: string,
  textColorId: string,
  approvedPairings: ApprovedColorPairing[],
  colors: BrandColor[],
): { hoverFillColorId: string; hoverTextColorId: string } {
  const palette = paletteColors(colors);
  const resolvedFill = resolveColorId(fillColorId, palette) ?? fillColorId;
  const pairings = getEffectivePairings(approvedPairings, palette);

  for (const pairing of sortPairingsByPriority(pairings, palette)) {
    const bg = resolveColorId(pairing.backgroundColorId, palette) ?? pairing.backgroundColorId;
    if (colorsMatchByIdOrHex(bg, resolvedFill, palette)) continue;
    const text = resolveColorId(pairing.textColorId, palette) ?? pairing.textColorId;
    if (!hasAdequateContrast(text, bg, palette)) continue;
    return { hoverFillColorId: bg, hoverTextColorId: text };
  }

  for (const candidate of palette) {
    if (colorsMatchByIdOrHex(candidate.id, resolvedFill, palette)) continue;
    const text = ensureContrastingText(candidate.id, undefined, pairings, palette);
    if (hasAdequateContrast(text, candidate.id, palette)) {
      return { hoverFillColorId: candidate.id, hoverTextColorId: text };
    }
  }

  if (
    !colorsMatchByIdOrHex(textColorId, resolvedFill, palette) &&
    hasAdequateContrast(resolvedFill, textColorId, palette)
  ) {
    const invertedText = ensureContrastingText(textColorId, resolvedFill, pairings, palette);
    return { hoverFillColorId: textColorId, hoverTextColorId: invertedText };
  }

  const fallbackBg =
    palette.find((c) => c.role === "dark-neutral")?.id ??
    palette.find((c) => c.role === "hero")?.id ??
    palette[0]?.id;
  if (!fallbackBg) {
    return { hoverFillColorId: fillColorId, hoverTextColorId: textColorId };
  }

  return {
    hoverFillColorId: fallbackBg,
    hoverTextColorId: ensureContrastingText(fallbackBg, undefined, pairings, palette),
  };
}

export function createDefaultButtonStyle(styleIndex = 1): CTAStyleDefinition {
  return {
    id: `cta-style-${Date.now()}`,
    name: defaultCtaStyleName(styleIndex),
    kind: "button",
    presetId: "btn-sharp-solid",
    shape: "square",
    fill: "solid",
    initialFillColorId: "hero",
    hoverFillColorId: "accent-1",
    textColorId: "light-1",
  };
}

export function createDefaultLinkStyle(): CTAStyleDefinition {
  return {
    id: `cta-style-${Date.now()}`,
    name: "Text link",
    kind: "link",
    presetId: "link-underline",
    initialFillColorId: "accent-1",
    hoverFillColorId: "hero",
  };
}

export function createStyleFromPreset(
  presetId: string,
  kind: CTAStyleDefinition["kind"],
  approvedPairings: ApprovedColorPairing[],
  colors: BrandColor[] = [],
): CTAStyleDefinition {
  const template = CTA_TEMPLATE_MAP.get(resolveTemplateId(presetId));
  if (!template) {
    return kind === "link" ? createDefaultLinkStyle() : createDefaultButtonStyle();
  }

  const fill = template.fill;
  const pairings = getEffectivePairings(approvedPairings, colors);
  const initialFill =
    fill === "solid" || fill === "solid-outline"
      ? (template.default.backgroundColorId ??
        getSmartFillColorId(pairings, fill, colors) ??
        pairings[0]?.backgroundColorId ??
        "hero")
      : fill === "outline"
        ? (template.default.borderColorId ?? getSmartFillColorId(pairings, fill, colors) ?? "hero")
        : (template.default.textColorId ?? pairings[0]?.textColorId ?? "accent-1");

  const hoverFill =
    fill === "solid" || fill === "solid-outline"
      ? (template.hover.backgroundColorId ??
        (initialFill
          ? suggestHoverColors(
              initialFill,
              resolveTextColorForBackground(initialFill, pairings, colors),
              pairings,
              colors,
            ).hoverFillColorId
          : undefined) ??
        "accent-1")
      : fill === "outline"
        ? (template.hover.backgroundColorId ?? initialFill)
        : (template.hover.textColorId ?? "hero");

  const textColor =
    fill === "solid" || fill === "solid-outline"
      ? (template.default.textColorId ??
        (initialFill
          ? resolveTextColorForBackground(initialFill, pairings, colors)
          : undefined) ??
        "light-1")
      : undefined;

  const hoverTextColor =
    fill === "solid" || fill === "solid-outline"
      ? (template.hover.textColorId ??
        (hoverFill
          ? ensureContrastingText(
              hoverFill,
              undefined,
              pairings,
              colors,
            )
          : undefined))
      : undefined;

  return {
    id: `cta-style-${Date.now()}`,
    name: defaultCtaStyleName(1),
    kind,
    presetId: template.id,
    initialFillColorId: initialFill ?? undefined,
    hoverFillColorId: hoverFill ?? undefined,
    textColorId: textColor,
    hoverTextColorId: hoverTextColor,
    typographyStyleId: template.typographyStyleId,
    sampleText: template.sampleText,
  };
}

function withFallbackCtaNames(styles: CTAStyleDefinition[]): CTAStyleDefinition[] {
  return styles.map((style, index) =>
    style.name?.trim()
      ? style
      : { ...style, name: defaultCtaStyleName(index + 1) },
  );
}

export function getStyleDisplayName(
  def: CTAStyleDefinition,
  _template: CTATemplate | null,
  index?: number,
): string {
  if (def.name?.trim()) return def.name.trim();
  if (index != null && index >= 0) return defaultCtaStyleName(index + 1);
  return defaultCtaStyleName(1);
}

export function definitionToCTAStyle(
  def: CTAStyleDefinition,
  _colors: BrandColor[],
  _typography: TypographyStyle[],
  approvedPairings: ApprovedColorPairing[] = [],
  styleIndex?: number,
): CTAStyle | null {
  const template = CTA_TEMPLATE_MAP.get(resolveTemplateId(def.presetId));
  if (!template) return null;

  const editorOptions = getEditorOptionsFromDefinition(def);
  const effectivePresetId =
    def.kind === "link"
      ? presetIdFromEditorOptions("link", editorOptions.shape, editorOptions.fill, editorOptions.linkVariant)
      : presetIdFromEditorOptions("button", editorOptions.shape, editorOptions.fill, editorOptions.linkVariant);
  const effectiveTemplate = CTA_TEMPLATE_MAP.get(effectivePresetId) ?? template;

  let defaultState = { ...effectiveTemplate.default };
  let hoverState = { ...effectiveTemplate.hover };
  const editorFill = editorOptions.fill;
  const fill: CTAFill = editorFill === "solid-outline" ? "solid-outline" : effectiveTemplate.fill;
  const shape = effectiveTemplate.shape;
  // Omit borderWidth → template/fill stroke (outline / solid-outline typically 2px).
  // Explicit 0 is a real value and removes the border. Never treat 0 as “use default”.
  const templateBorderWidth = editorFill === "solid-outline" ? 2 : effectiveTemplate.borderWidth;
  const borderWidth =
    typeof def.borderWidth === "number" && Number.isFinite(def.borderWidth)
      ? Math.max(0, Math.min(6, def.borderWidth))
      : templateBorderWidth;
  const needsBorder = borderWidth > 0;
  // Omit borderRadius / padding → shape + template defaults. Do not apply slider fallbacks.
  const borderRadius =
    typeof def.borderRadius === "number" && Number.isFinite(def.borderRadius)
      ? Math.max(0, Math.min(24, def.borderRadius))
      : undefined;

  if (def.initialFillColorId) {
    defaultState = applyInitialColor(defaultState, fill, def.initialFillColorId);
  }

  if (def.initialBorderColorId && needsBorder) {
    defaultState.borderColorId = def.initialBorderColorId;
  } else if (needsBorder && !defaultState.borderColorId) {
    defaultState.borderColorId =
      def.initialFillColorId ??
      effectiveTemplate.default.borderColorId ??
      "hero";
  }

  if (def.textColorId) {
    defaultState.textColorId = def.textColorId;
  } else if ((fill === "solid" || fill === "solid-outline") && defaultState.backgroundColorId) {
    defaultState.textColorId = resolveTextColorForBackground(
      defaultState.backgroundColorId,
      approvedPairings,
      _colors,
    );
  }

  // Respect explicit editor picks — contrast guard only fills in missing text colors.
  if (fill === "solid" || fill === "solid-outline") {
    if (!def.textColorId) {
      defaultState = guardVisualStateContrast(defaultState, approvedPairings, _colors);
    }
  }

  if (def.hoverFillColorId) {
    hoverState = applyHoverColor(
      defaultState,
      hoverState,
      fill,
      def.hoverFillColorId,
      approvedPairings,
      _colors,
      def.hoverTextColorId,
    );
  }

  if (def.hoverBorderColorId && needsBorder) {
    hoverState.borderColorId = def.hoverBorderColorId;
  } else if (needsBorder && !hoverState.borderColorId) {
    hoverState.borderColorId =
      def.hoverFillColorId ??
      hoverState.borderColorId ??
      defaultState.borderColorId ??
      "hero";
  }

  if (
    !def.hoverTextColorId &&
    (fill === "solid" || fill === "solid-outline") &&
    hoverState.backgroundColorId
  ) {
    hoverState.textColorId = resolveTextColorForBackground(
      hoverState.backgroundColorId,
      approvedPairings,
      _colors,
    );
  }

  if (
    (fill === "solid" || fill === "solid-outline" || fill === "outline") &&
    hoverState.backgroundColorId &&
    !def.hoverTextColorId
  ) {
    hoverState = guardVisualStateContrast(hoverState, approvedPairings, _colors);
  }

  const isLink = def.kind === "link" || effectiveTemplate.category === "link";

  const style: CTAStyle = {
    id: def.id,
    name: getStyleDisplayName(def, effectiveTemplate, styleIndex),
    kind: isLink ? "link" : "button",
    variant: effectiveTemplate.variant,
    usage: isLink ? LINK_USAGE : BUTTON_USAGE,
    sampleText: resolveCTASampleText(def.sampleText),
    shape,
    fill,
    borderWidth,
    borderRadius,
    typographyStyleId: def.typographyStyleId ?? effectiveTemplate.typographyStyleId,
    typographySource: def.typographySource,
    customTypography: def.customTypography,
    fontSize: def.fontSize,
    paddingX: resolveCtaPaddingCss(def.paddingX, effectiveTemplate.paddingX, clampCtaPaddingX),
    paddingY: resolveCtaPaddingCss(def.paddingY, effectiveTemplate.paddingY, clampCtaPaddingY),
    default: normalizeVisualStateColorIds(defaultState, _colors),
    hover: normalizeVisualStateColorIds(hoverState, _colors),
    templateId: effectiveTemplate.id,
    showArrow: effectiveTemplate.showArrow,
    textTransform: resolveCTATextTransform(def, isLink),
    // Omit letterSpacing on buttons → 0.08em (legacy CSS pin). Explicit "0" stays 0.
    letterSpacing: resolveCtaLetterSpacing(def.letterSpacing, isLink ? "link" : "button"),
    alignment: editorOptions.alignment,
  };

  return applyTextDecoration(def, style);
}

export function resolveCTAStyles(
  input: CTAStyleDefinition[],
  colors: BrandColor[],
  typography: TypographyStyle[],
  approvedPairings: ApprovedColorPairing[] = [],
): CTAStyle[] {
  return withFallbackCtaNames(input)
    .map((def, index) => definitionToCTAStyle(def, colors, typography, approvedPairings, index))
    .filter((style): style is CTAStyle => style !== null);
}

const FILL_COLOR_PRIORITY = ["hero", "accent-1", "accent-2", "dark-1"] as const;

export function getSmartFillColorId(
  approvedPairings: ApprovedColorPairing[],
  fill: CTAFill,
  colors: BrandColor[] = [],
): string | undefined {
  if (fill === "text") return undefined;

  const pairings = getEffectivePairings(approvedPairings, colors);
  if (pairings.length > 0) {
    const first = pairings[0];
    if (fill === "solid" || fill === "solid-outline") {
      return resolveColorId(first.backgroundColorId, colors) ?? first.backgroundColorId;
    }
    return resolveColorId(first.textColorId, colors) ?? first.textColorId;
  }

  for (const bgId of FILL_COLOR_PRIORITY) {
    const resolved = resolveColorId(bgId, colors);
    if (resolved) {
      if (fill === "solid" || fill === "solid-outline") return resolved;
      return resolveTextColorForBackground(resolved, pairings, colors);
    }
  }

  return undefined;
}

export function getDefaultPresetId(kind: CTAStyleDefinition["kind"]): string {
  return kind === "link"
    ? CTA_LINK_PICKER_PRESETS[0]?.id ?? "link-underline"
    : CTA_QUICK_PRESET_IDS[0];
}

export function getQuickPresetIds(): readonly string[] {
  return CTA_QUICK_PRESET_IDS;
}
