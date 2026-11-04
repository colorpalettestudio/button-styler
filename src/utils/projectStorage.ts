import type {
  ApprovedColorPairing,
  BrandColor,
  ButtonStylerProject,
  CTAStyleDefinition,
  TypographyStyle,
} from "../types";
import { COLOR_ROLES, createDefaultProject } from "../types";
import { assignColorRoles } from "./colorRoles";
import { normalizeHex } from "./colorUtils";

const STORAGE_KEY = "button-styler:project:v1";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeColors(raw: unknown): BrandColor[] {
  if (!Array.isArray(raw)) return [];
  const colors: BrandColor[] = [];
  for (const entry of raw) {
    if (!isRecord(entry)) continue;
    const hex = typeof entry.hex === "string" ? normalizeHex(entry.hex) : null;
    if (!hex || typeof entry.id !== "string") continue;
    const role = COLOR_ROLES.includes(entry.role as BrandColor["role"])
      ? (entry.role as BrandColor["role"])
      : "accent";
    colors.push({
      id: entry.id,
      name: hex,
      hex,
      role,
    });
  }
  return colors;
}

function normalizePairings(raw: unknown, colors: BrandColor[]): ApprovedColorPairing[] {
  if (!Array.isArray(raw)) return [];
  const ids = new Set(colors.map((c) => c.id));
  return raw.filter(
    (entry): entry is ApprovedColorPairing =>
      isRecord(entry) &&
      typeof entry.textColorId === "string" &&
      typeof entry.backgroundColorId === "string" &&
      ids.has(entry.textColorId) &&
      ids.has(entry.backgroundColorId),
  );
}

function normalizeTypography(raw: unknown): TypographyStyle[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (entry): entry is TypographyStyle =>
      isRecord(entry) &&
      typeof entry.id === "string" &&
      typeof entry.fontFamily === "string" &&
      typeof entry.fontWeight === "number",
  );
}

function normalizeCtaStyles(raw: unknown): CTAStyleDefinition[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (entry): entry is CTAStyleDefinition =>
      isRecord(entry) &&
      typeof entry.id === "string" &&
      (entry.kind === "button" || entry.kind === "link") &&
      typeof entry.presetId === "string",
  );
}

/** Validate a saved or imported project, filling gaps with defaults. Returns null if unusable. */
export function parseProject(raw: unknown): ButtonStylerProject | null {
  if (!isRecord(raw)) return null;
  const defaults = createDefaultProject();
  const colors = normalizeColors(raw.colors);
  const typography = normalizeTypography(raw.typography);
  const ctaStyles = normalizeCtaStyles(raw.ctaStyles);
  if (!colors.length && !typography.length && !ctaStyles.length) return null;

  return {
    version: 1,
    brandName: typeof raw.brandName === "string" ? raw.brandName : "",
    colors: colors.length ? assignColorRoles(colors) : defaults.colors,
    favoritePairings: colors.length ? normalizePairings(raw.favoritePairings, colors) : [],
    typography: typography.length ? typography : defaults.typography,
    ctaStyles,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : new Date().toISOString(),
  };
}

export function loadProject(): ButtonStylerProject {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = parseProject(JSON.parse(stored));
      if (parsed) return parsed;
    }
  } catch {
    // Corrupt or unavailable storage — start fresh.
  }
  return createDefaultProject();
}

export function saveProject(project: ButtonStylerProject): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
    return true;
  } catch {
    return false;
  }
}

export function clearSavedProject(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable.
  }
}
