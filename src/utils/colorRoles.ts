import type { BrandColor } from "../types";
import { hexToHsl } from "./colorUtils";

function isLightNeutral(hex: string): boolean {
  const hsl = hexToHsl(hex);
  return !!hsl && (hsl.l >= 94 || (hsl.l >= 85 && hsl.s <= 30));
}

function isDarkNeutral(hex: string): boolean {
  const hsl = hexToHsl(hex);
  return !!hsl && (hsl.l <= 10 || (hsl.l <= 25 && hsl.s <= 25));
}

/**
 * Infer color roles from the palette so users only manage colors: the lightest near-white
 * becomes the light neutral, the darkest near-black the dark neutral, the first remaining
 * mid-tone color the hero, and everything else an accent.
 */
export function assignColorRoles(colors: BrandColor[]): BrandColor[] {
  if (!colors.length) return colors;
  const lightness = (c: BrandColor) => hexToHsl(c.hex)?.l ?? 50;

  const light = colors
    .filter((c) => isLightNeutral(c.hex))
    .sort((a, b) => lightness(b) - lightness(a))[0];
  const dark = colors
    .filter((c) => c !== light && isDarkNeutral(c.hex))
    .sort((a, b) => lightness(a) - lightness(b))[0];
  const isMidTone = (c: BrandColor) => {
    const l = lightness(c);
    return l > 12 && l < 82;
  };
  const hero =
    colors.find((c) => c !== light && c !== dark && isMidTone(c)) ??
    colors.find((c) => c !== light && c !== dark) ??
    colors[0];

  const roleFor = (c: BrandColor): BrandColor["role"] => {
    if (c === hero) return "hero";
    if (c === light) return "light-neutral";
    if (c === dark) return "dark-neutral";
    return "accent";
  };

  let changed = false;
  const next = colors.map((c) => {
    const role = roleFor(c);
    if (role === c.role) return c;
    changed = true;
    return { ...c, role };
  });
  return changed ? next : colors;
}
