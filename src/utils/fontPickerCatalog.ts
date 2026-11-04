import type { GoogleFontEntry } from "./fontUtils";

export type FontCategoryFilter =
  | "all"
  | "sans-serif"
  | "serif"
  | "display"
  | "handwriting"
  | "monospace";

export type FontRoleSuggestion = "heading" | "subheading" | "body" | "accent";

export type FontSortMode = "popular" | "alphabetical";

export const FONT_CATEGORY_OPTIONS: { id: FontCategoryFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "sans-serif", label: "Sans" },
  { id: "serif", label: "Serif" },
  { id: "display", label: "Display" },
  { id: "handwriting", label: "Script" },
  { id: "monospace", label: "Mono" },
];

export const FONT_ROLE_SUGGESTIONS: Record<FontRoleSuggestion, string[]> = {
  heading: [
    "Instrument Serif",
    "Playfair Display",
    "Fraunces",
    "Libre Baskerville",
    "Cormorant Garamond",
    "DM Serif Display",
    "Oswald",
    "Bebas Neue",
    "Abril Fatface",
  ],
  subheading: [
    "DM Sans",
    "Montserrat",
    "Inter",
    "Work Sans",
    "Outfit",
    "Source Sans 3",
    "Nunito Sans",
    "Raleway",
    "Lexend",
  ],
  body: [
    "DM Sans",
    "Inter",
    "Source Sans 3",
    "Lato",
    "Open Sans",
    "Nunito",
    "Literata",
    "Merriweather",
    "Source Serif 4",
  ],
  accent: [
    "Caveat",
    "Pacifico",
    "Dancing Script",
    "Lobster",
    "Satisfy",
    "Permanent Marker",
    "Great Vibes",
    "Sacramento",
  ],
};

const EXCLUDED_FAMILIES = new Set(["Google Sans"]);

export function normalizeFontCategory(category: string): FontCategoryFilter | "other" {
  const lower = category.toLowerCase();
  if (lower.includes("handwriting")) return "handwriting";
  if (lower.includes("mono")) return "monospace";
  if (lower.includes("display")) return "display";
  if (lower.includes("sans")) return "sans-serif";
  if (lower.includes("serif")) return "serif";
  return "other";
}

export function formatFontCategoryLabel(category: string): string {
  const normalized = normalizeFontCategory(category);
  if (normalized === "other") return category;
  return FONT_CATEGORY_OPTIONS.find((item) => item.id === normalized)?.label ?? category;
}

export function queryGoogleFonts(
  fonts: GoogleFontEntry[],
  options: {
    search?: string;
    category?: FontCategoryFilter;
    sort?: FontSortMode;
    limit?: number;
    excludeFamilies?: Set<string>;
  } = {},
): GoogleFontEntry[] {
  const search = options.search?.trim().toLowerCase() ?? "";
  const category = options.category ?? "all";
  const sort = options.sort ?? "popular";
  const exclude = options.excludeFamilies;

  let result = fonts.filter(
    (font) => !EXCLUDED_FAMILIES.has(font.family) && !(exclude?.has(font.family) ?? false),
  );

  if (search) {
    result = result.filter((font) => font.family.toLowerCase().includes(search));
  }

  if (category !== "all") {
    result = result.filter((font) => normalizeFontCategory(font.category) === category);
  }

  if (sort === "alphabetical") {
    result.sort((a, b) =>
      a.family.localeCompare(b.family, undefined, { sensitivity: "base" }),
    );
  } else {
    result.sort((a, b) => (a.popularity ?? 9999) - (b.popularity ?? 9999));
  }

  if (options.limit !== undefined) {
    result = result.slice(0, options.limit);
  }

  return result;
}

export function resolveSuggestedFonts(
  fonts: GoogleFontEntry[],
  suggestions: string[],
): GoogleFontEntry[] {
  const byFamily = new Map(fonts.map((font) => [font.family, font]));
  return suggestions
    .map((family) => byFamily.get(family))
    .filter((font): font is GoogleFontEntry => Boolean(font));
}

export function getRoleSuggestionLabel(role: FontRoleSuggestion): string {
  switch (role) {
    case "heading":
      return "Suggested for headings";
    case "subheading":
      return "Suggested for subheadings";
    case "body":
      return "Suggested for body copy";
    case "accent":
      return "Suggested accent fonts";
  }
}
