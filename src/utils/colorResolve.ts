import type { BrandColor, CTAStyleDefinition } from "../types";

const CTA_COLOR_FIELDS = [
  "initialFillColorId",
  "hoverFillColorId",
  "initialBorderColorId",
  "hoverBorderColorId",
  "textColorId",
  "hoverTextColorId",
] as const satisfies readonly (keyof CTAStyleDefinition)[];

function colorsByRole(colors: BrandColor[], role: BrandColor["role"]): BrandColor[] {
  return colors.filter((c) => c.role === role);
}

function getSemanticSlot(color: BrandColor, allColors: BrandColor[]): string | undefined {
  if (color.role === "hero") return "hero";
  if (color.role === "accent") {
    const index = colorsByRole(allColors, "accent").findIndex((c) => c.id === color.id);
    if (index === 0) return "accent-1";
    if (index === 1) return "accent-2";
  }
  if (color.role === "light-neutral") {
    const index = colorsByRole(allColors, "light-neutral").findIndex((c) => c.id === color.id);
    if (index === 0) return "light-1";
    if (index === 1) return "light-2";
  }
  if (color.role === "dark-neutral") {
    const index = colorsByRole(allColors, "dark-neutral").findIndex((c) => c.id === color.id);
    if (index === 0) return "dark-1";
  }
  return undefined;
}

/** Map legacy semantic color ids (hero, accent-1, …) to a color in the current palette. */
export function resolveSemanticColorId(
  semanticId: string,
  colors: BrandColor[],
): string | undefined {
  if (colors.some((c) => c.id === semanticId)) return semanticId;

  switch (semanticId) {
    case "hero":
      return colorsByRole(colors, "hero")[0]?.id;
    case "accent-1":
      return colorsByRole(colors, "accent")[0]?.id;
    case "accent-2":
      return colorsByRole(colors, "accent")[1]?.id;
    case "light-1":
      return colorsByRole(colors, "light-neutral")[0]?.id;
    case "light-2":
      return colorsByRole(colors, "light-neutral")[1]?.id;
    case "dark-1":
      return colorsByRole(colors, "dark-neutral")[0]?.id;
    default:
      return undefined;
  }
}

/** Resolve a stored color id to one that exists in the current palette. */
export function resolveColorId(
  colorId: string | null | undefined,
  colors: BrandColor[],
): string | null {
  if (!colorId) return null;
  if (colors.some((c) => c.id === colorId)) return colorId;
  return resolveSemanticColorId(colorId, colors) ?? null;
}

function fallbackHex(colors: BrandColor[], role: BrandColor["role"]): string | undefined {
  return colorsByRole(colors, role)[0]?.hex ?? colors[0]?.hex;
}

/** Resolve a color id to a hex value, with semantic fallbacks when the id is stale. */
export function resolveColorHex(
  colorId: string | null | undefined,
  colors: BrandColor[],
  fallback: string,
): string {
  const resolvedId = resolveColorId(colorId, colors);
  if (resolvedId) {
    const hex = colors.find((c) => c.id === resolvedId)?.hex;
    if (hex) return hex;
  }

  if (colorId === "hero" || colorId === "accent-1" || colorId === "accent-2") {
    return fallbackHex(colors, "hero") ?? fallbackHex(colors, "accent") ?? fallback;
  }
  if (colorId === "light-1" || colorId === "light-2") {
    return fallbackHex(colors, "light-neutral") ?? fallback;
  }
  if (colorId === "dark-1") {
    return fallbackHex(colors, "dark-neutral") ?? fallback;
  }

  return fallback;
}

/** Build old-id → new-id mapping after a palette import or replacement. */
export function buildColorIdRemap(
  oldColors: BrandColor[],
  newColors: BrandColor[],
): Map<string, string> {
  const map = new Map<string, string>();

  for (const oldColor of oldColors) {
    if (newColors.some((c) => c.id === oldColor.id)) {
      map.set(oldColor.id, oldColor.id);
      continue;
    }

    const hexMatch = newColors.find(
      (c) => c.hex.toUpperCase() === oldColor.hex.toUpperCase(),
    );
    if (hexMatch) {
      map.set(oldColor.id, hexMatch.id);
      continue;
    }

    const semanticSlot = getSemanticSlot(oldColor, oldColors);
    if (semanticSlot) {
      const resolved = resolveSemanticColorId(semanticSlot, newColors);
      if (resolved) {
        map.set(oldColor.id, resolved);
        continue;
      }
    }

    const oldRoleColors = colorsByRole(oldColors, oldColor.role);
    const newRoleColors = colorsByRole(newColors, oldColor.role);
    const roleIndex = oldRoleColors.findIndex((c) => c.id === oldColor.id);
    if (roleIndex >= 0 && newRoleColors[roleIndex]) {
      map.set(oldColor.id, newRoleColors[roleIndex].id);
      continue;
    }

    const paletteIndex = oldColors.findIndex((c) => c.id === oldColor.id);
    if (paletteIndex >= 0 && newColors[paletteIndex]) {
      map.set(oldColor.id, newColors[paletteIndex].id);
    }
  }

  return map;
}

function remapColorId(
  colorId: string | undefined,
  remap: Map<string, string>,
  newColors: BrandColor[],
): string | undefined {
  if (!colorId) return undefined;
  const remapped = remap.get(colorId) ?? colorId;
  return resolveColorId(remapped, newColors) ?? resolveColorId(colorId, newColors) ?? undefined;
}

/** Remap CTA style color references after the palette changes. */
export function remapCtaColorsAfterPaletteChange(
  oldColors: BrandColor[],
  newColors: BrandColor[],
  ctaStyles: CTAStyleDefinition[],
): CTAStyleDefinition[] {
  if (!ctaStyles.length) return ctaStyles;

  const remap = buildColorIdRemap(oldColors, newColors);

  return ctaStyles.map((style) => {
    const updated: CTAStyleDefinition = { ...style };
    for (const field of CTA_COLOR_FIELDS) {
      const value = style[field];
      if (typeof value === "string") {
        updated[field] = remapColorId(value, remap, newColors);
      }
    }
    return updated;
  });
}
