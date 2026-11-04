import { normalizeHex } from "./colorUtils";

export interface StudioCodePalette {
  hexes: string[];
  /** Favorite text-on-background pairings, as hex codes. */
  pairings: { textHex: string; backgroundHex: string }[];
}

function parseJsonParam(params: URLSearchParams, key: string): unknown {
  const raw = params.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Parse a Color Palette Studio "Studio Code" (a query string such as
 * `studiocode?colorNames=[...]&selectedCombinations=[...]`). Returns null if the text isn't one.
 */
export function parseStudioCode(text: string): StudioCodePalette | null {
  const trimmed = text.trim();
  if (!/colorNames=/.test(trimmed)) return null;
  const query = trimmed.includes("?") ? trimmed.slice(trimmed.indexOf("?") + 1) : trimmed;
  const params = new URLSearchParams(query);

  const colorNames = parseJsonParam(params, "colorNames");
  if (!Array.isArray(colorNames)) return null;
  const hexes: string[] = [];
  for (const entry of colorNames) {
    const hex =
      entry && typeof entry === "object" && typeof (entry as { hex?: unknown }).hex === "string"
        ? normalizeHex((entry as { hex: string }).hex)
        : null;
    if (hex && !hexes.includes(hex)) hexes.push(hex);
  }
  if (!hexes.length) return null;

  const combos = parseJsonParam(params, "selectedCombinations");
  const pairings: StudioCodePalette["pairings"] = [];
  if (Array.isArray(combos)) {
    for (const entry of combos) {
      if (!entry || typeof entry !== "object") continue;
      const { textColor, bgColor } = entry as { textColor?: unknown; bgColor?: unknown };
      const textHex = typeof textColor === "string" ? normalizeHex(textColor) : null;
      const backgroundHex = typeof bgColor === "string" ? normalizeHex(bgColor) : null;
      if (textHex && backgroundHex && hexes.includes(textHex) && hexes.includes(backgroundHex)) {
        pairings.push({ textHex, backgroundHex });
      }
    }
  }

  return { hexes, pairings };
}
