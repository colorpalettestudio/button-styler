import { fetchLocalFontStyles } from "./fontUtils";

export const DEFAULT_FONT_VARIANTS = [
  "100",
  "200",
  "300",
  "regular",
  "500",
  "600",
  "700",
  "800",
  "900",
  "100italic",
  "300italic",
  "italic",
  "500italic",
  "600italic",
  "700italic",
] as const;

const WEIGHT_LABELS: Record<number, string> = {
  100: "Thin",
  200: "Extra Light",
  300: "Light",
  400: "Regular",
  500: "Medium",
  600: "Semi Bold",
  700: "Bold",
  800: "Extra Bold",
  900: "Black",
};

/** Prefix for Local Font Access API style names preserved as first-class variants. */
export const LOCAL_STYLE_VARIANT_PREFIX = "local:";

export function toLocalStyleVariant(styleName: string): string {
  return `${LOCAL_STYLE_VARIANT_PREFIX}${styleName}`;
}

export function isLocalStyleVariant(variant: string): boolean {
  return variant.startsWith(LOCAL_STYLE_VARIANT_PREFIX);
}

export function localStyleNameFromVariant(variant: string): string {
  return variant.slice(LOCAL_STYLE_VARIANT_PREFIX.length);
}

export function parseFontVariant(variant: string): {
  fontWeight: number;
  fontStyle: "normal" | "italic";
} {
  if (isLocalStyleVariant(variant)) {
    return parseLocalStyleName(localStyleNameFromVariant(variant));
  }
  if (variant === "regular") return { fontWeight: 400, fontStyle: "normal" };
  if (variant === "italic") return { fontWeight: 400, fontStyle: "italic" };
  const italic = variant.endsWith("italic");
  const weight = parseInt(variant.replace("italic", ""), 10);
  return {
    fontWeight: Number.isNaN(weight) ? 400 : weight,
    fontStyle: italic ? "italic" : "normal",
  };
}

/** Parses a dropdown value into weight/style plus optional named local face. */
export function parseFontVariantSelection(variant: string): {
  fontWeight: number;
  fontStyle: "normal" | "italic";
  localFontStyle?: string;
} {
  if (isLocalStyleVariant(variant)) {
    const localFontStyle = localStyleNameFromVariant(variant);
    return { ...parseLocalStyleName(localFontStyle), localFontStyle };
  }
  return { ...parseFontVariant(variant) };
}

export function toFontVariant(fontWeight: number, fontStyle: "normal" | "italic"): string {
  if (fontWeight === 400 && fontStyle === "normal") return "regular";
  if (fontWeight === 400 && fontStyle === "italic") return "italic";
  return fontStyle === "italic" ? `${fontWeight}italic` : `${fontWeight}`;
}

/** Dropdown / display key for the current selection (named local faces preferred). */
export function currentVariantKey(
  source: "google" | "local" | undefined,
  fontWeight: number,
  fontStyle: "normal" | "italic",
  localFontStyle?: string,
): string {
  if (source === "local" && localFontStyle?.trim()) {
    return toLocalStyleVariant(localFontStyle.trim());
  }
  return toFontVariant(fontWeight, fontStyle);
}

export function formatFontVariantLabel(variant: string): string {
  if (isLocalStyleVariant(variant)) return localStyleNameFromVariant(variant);
  const { fontWeight, fontStyle } = parseFontVariant(variant);
  const name = WEIGHT_LABELS[fontWeight] ?? `${fontWeight}`;
  return fontStyle === "italic" ? `${name} Italic` : name;
}

/** Human label for a typography entry's selected face. */
export function formatTypographyVariantLabel(
  fontWeight: number,
  fontStyle: "normal" | "italic",
  localFontStyle?: string,
): string {
  if (localFontStyle?.trim()) return localFontStyle.trim();
  return formatFontVariantLabel(toFontVariant(fontWeight, fontStyle));
}

const LOCAL_WEIGHT_KEYWORDS: [RegExp, number][] = [
  [/hairline|thin/i, 100],
  [/extra\s*-?light|ultra\s*-?light/i, 200],
  [/light/i, 300],
  [/medium/i, 500],
  [/semi\s*-?bold|demi\s*-?bold|demibold/i, 600],
  [/extra\s*-?bold|ultra\s*-?bold/i, 800],
  [/black|heavy/i, 900],
  [/bold/i, 700],
];

/** Parses an installed style name (e.g. "Hairline Italic", "Bold") into weight + style. */
export function parseLocalStyleName(name: string): {
  fontWeight: number;
  fontStyle: "normal" | "italic";
} {
  const fontStyle: "normal" | "italic" = /italic|oblique/i.test(name) ? "italic" : "normal";
  for (const [pattern, weight] of LOCAL_WEIGHT_KEYWORDS) {
    if (pattern.test(name)) return { fontWeight: weight, fontStyle };
  }
  return { fontWeight: 400, fontStyle };
}

const variantsCache = new Map<string, string[]>();

function variantsCacheKey(family: string, source: "google" | "local"): string {
  return `${source}:${family}`;
}

function sortLocalStyleVariants(variants: string[]): string[] {
  return [...variants].sort((a, b) => {
    const an = localStyleNameFromVariant(a);
    const bn = localStyleNameFromVariant(b);
    const aRegular = /^regular$/i.test(an) ? 0 : 1;
    const bRegular = /^regular$/i.test(bn) ? 0 : 1;
    if (aRegular !== bRegular) return aRegular - bRegular;
    return an.localeCompare(bn, undefined, { sensitivity: "base" });
  });
}

export async function fetchFontVariants(
  family: string,
  source: "google" | "local" = "google",
): Promise<string[]> {
  const cacheKey = variantsCacheKey(family, source);
  if (variantsCache.has(cacheKey)) return variantsCache.get(cacheKey)!;

  if (source !== "google") {
    const styles = await fetchLocalFontStyles(family);
    // Preserve installed style names. Mapping only to CSS weight/style collapses
    // faces like "Outlines" / "Regular Bouncy" into a single "Regular".
    const variants = sortLocalStyleVariants(styles.map((name) => toLocalStyleVariant(name)));
    if (variants.length === 0) {
      // Styles unknown (e.g. local font access not granted yet) — don't cache,
      // so we can pick up the real list once fonts are readable.
      return ["regular"];
    }
    variantsCache.set(cacheKey, variants);
    return variants;
  }

  try {
    const res = await fetch("https://fonts.google.com/metadata/fonts");
    const text = await res.text();
    const json = JSON.parse(text.replace(")]}'\n", ""));
    const meta = json.familyMetadataList.find(
      (f: { family: string }) => f.family === family,
    );

    let variants: string[] = [];
    if (meta?.fonts && typeof meta.fonts === "object") {
      variants = Object.keys(meta.fonts).map(normalizeVariantKey);
    } else if (Array.isArray(meta?.variants)) {
      variants = meta.variants.map(normalizeVariantKey);
    }

    const sorted = sortVariants(variants.length > 0 ? variants : [...DEFAULT_FONT_VARIANTS]);
    variantsCache.set(cacheKey, sorted);
    return sorted;
  } catch {
    const fallback = [...DEFAULT_FONT_VARIANTS];
    variantsCache.set(cacheKey, fallback);
    return fallback;
  }
}

function normalizeVariantKey(key: string): string {
  if (key === "regular" || key === "italic") return key;
  if (/^\d+i$/.test(key)) return `${key.slice(0, -1)}italic`;
  return key;
}

function variantSortKey(variant: string): number {
  const { fontWeight, fontStyle } = parseFontVariant(variant);
  return fontWeight * 10 + (fontStyle === "italic" ? 1 : 0);
}

function sortVariants(variants: string[]): string[] {
  return [...new Set(variants)].sort((a, b) => variantSortKey(a) - variantSortKey(b));
}

export function clearVariantsCacheForFamily(family: string): void {
  variantsCache.delete(variantsCacheKey(family, "google"));
  variantsCache.delete(variantsCacheKey(family, "local"));
}

/** Drop cached local-font variant lists so Style dropdowns refresh after permission/grant. */
export function clearLocalVariantsCache(): void {
  for (const key of [...variantsCache.keys()]) {
    if (key.startsWith("local:")) variantsCache.delete(key);
  }
}

export type SnappedFontVariant = {
  fontWeight: number;
  fontStyle: "normal" | "italic";
  localFontStyle?: string;
};

/** Snaps a weight/style pair to the closest variant in the given list. */
export function snapToVariantList(
  variants: string[],
  fontWeight: number,
  fontStyle: "normal" | "italic",
  localFontStyle?: string,
): SnappedFontVariant {
  if (variants.length === 0) return { fontWeight, fontStyle, localFontStyle };

  if (variants.every(isLocalStyleVariant)) {
    const names = variants.map(localStyleNameFromVariant);
    const preferred =
      (localFontStyle && names.includes(localFontStyle) ? localFontStyle : undefined) ??
      names.find((name) => /^regular$/i.test(name)) ??
      names.find((name) => {
        const parsed = parseLocalStyleName(name);
        return parsed.fontWeight === fontWeight && parsed.fontStyle === fontStyle;
      }) ??
      names[0];
    const parsed = parseLocalStyleName(preferred);
    return { ...parsed, localFontStyle: preferred };
  }

  const parsed = variants.map(parseFontVariant);
  if (parsed.some((v) => v.fontWeight === fontWeight && v.fontStyle === fontStyle)) {
    return { fontWeight, fontStyle };
  }

  const sameStyle = parsed.filter((v) => v.fontStyle === fontStyle);
  const normals = parsed.filter((v) => v.fontStyle === "normal");
  const pool = sameStyle.length > 0 ? sameStyle : normals.length > 0 ? normals : parsed;

  let best = pool[0];
  for (const candidate of pool) {
    if (Math.abs(candidate.fontWeight - fontWeight) < Math.abs(best.fontWeight - fontWeight)) {
      best = candidate;
    }
  }
  return { fontWeight: best.fontWeight, fontStyle: best.fontStyle };
}

/** Resolves the closest weight/style the font actually supports (async — fetches variants). */
export async function resolveSupportedVariant(
  family: string,
  source: "google" | "local",
  fontWeight: number,
  fontStyle: "normal" | "italic",
  localFontStyle?: string,
): Promise<SnappedFontVariant> {
  const variants = await fetchFontVariants(family, source);
  return snapToVariantList(variants, fontWeight, fontStyle, localFontStyle);
}
