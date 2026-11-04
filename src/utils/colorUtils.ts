export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

export function formatRgb(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return "-";
  return `${rgb.r}, ${rgb.g}, ${rgb.b}`;
}

export function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: l * 100 };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function formatHsl(hex: string): string {
  const hsl = hexToHsl(hex);
  if (!hsl) return "-";
  return `${hsl.h}°, ${hsl.s}%, ${hsl.l}%`;
}

export function hexToCmyk(hex: string): { c: number; m: number; y: number; k: number } | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const k = 1 - Math.max(r, g, b);
  if (k === 1) return { c: 0, m: 0, y: 0, k: 100 };
  const c = (1 - r - k) / (1 - k);
  const m = (1 - g - k) / (1 - k);
  const y = (1 - b - k) / (1 - k);
  return {
    c: Math.round(c * 100),
    m: Math.round(m * 100),
    y: Math.round(y * 100),
    k: Math.round(k * 100),
  };
}

export function formatCmyk(hex: string): string {
  const cmyk = hexToCmyk(hex);
  if (!cmyk) return "-";
  return `${cmyk.c}%, ${cmyk.m}%, ${cmyk.y}%, ${cmyk.k}%`;
}

function linearize(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function getRelativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const r = linearize(rgb.r);
  const g = linearize(rgb.g);
  const b = linearize(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function getContrastRatio(hex1: string, hex2: string): number {
  const l1 = getRelativeLuminance(hex1);
  const l2 = getRelativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export const MIN_HIGH_CONTRAST_RATIO = 4.5;
export const MIN_REQUIRED_HIGH_CONTRAST_PAIRINGS = 2;

export function isHighContrastRatio(ratio: number): boolean {
  return ratio >= MIN_HIGH_CONTRAST_RATIO;
}

export type ContrastLevel = "fail" | "aa-large" | "aa" | "aaa";

export function getContrastLevel(ratio: number): ContrastLevel {
  if (ratio >= 7) return "aaa";
  if (ratio >= 4.5) return "aa";
  if (ratio >= 3) return "aa-large";
  return "fail";
}

export const CONTRAST_LABELS: Record<ContrastLevel, string> = {
  fail: "Fails WCAG",
  "aa-large": "AA Large text",
  aa: "AA Normal text",
  aaa: "AAA",
};

/** User-facing pairings UI labels (WCAG tier, not raw ratio). */
export const AA_TESTED_LABEL = "AA-tested";
export const AAA_TESTED_LABEL = "AAA-tested";

export function getContrastTestedLabel(level: ContrastLevel): string | null {
  if (level === "aaa") return AAA_TESTED_LABEL;
  if (level === "aa") return AA_TESTED_LABEL;
  return null;
}

export function isLightColor(hex: string): boolean {
  return getRelativeLuminance(hex) > 0.6;
}

export function getContrastColor(hex: string): string {
  return isLightColor(hex) ? "#1A1A1A" : "#FFFFFF";
}

export function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((x) => Math.round(x).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

export function cmykToHex(c: number, m: number, y: number, k: number): string {
  const c1 = Math.max(0, Math.min(100, c)) / 100;
  const m1 = Math.max(0, Math.min(100, m)) / 100;
  const y1 = Math.max(0, Math.min(100, y)) / 100;
  const k1 = Math.max(0, Math.min(100, k)) / 100;
  const r = 255 * (1 - c1) * (1 - k1);
  const g = 255 * (1 - m1) * (1 - k1);
  const b = 255 * (1 - y1) * (1 - k1);
  return rgbToHex(r, g, b);
}

export function normalizeHex(value: string): string | null {
  const cleaned = value.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{6}$/.test(cleaned)) return `#${cleaned.toUpperCase()}`;
  if (/^[0-9a-fA-F]{3}$/.test(cleaned)) {
    const expanded = cleaned
      .split("")
      .map((char) => char + char)
      .join("");
    return `#${expanded.toUpperCase()}`;
  }
  return null;
}

export function lighten(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return rgbToHex(
    rgb.r + (255 - rgb.r) * amount,
    rgb.g + (255 - rgb.g) * amount,
    rgb.b + (255 - rgb.b) * amount,
  );
}

export function darken(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return rgbToHex(rgb.r * (1 - amount), rgb.g * (1 - amount), rgb.b * (1 - amount));
}

export function hslToHex(h: number, s: number, l: number): string {
  const hue = ((h % 360) + 360) % 360;
  const sat = Math.max(0, Math.min(100, s)) / 100;
  const light = Math.max(0, Math.min(100, l)) / 100;

  if (sat === 0) {
    const channel = Math.round(light * 255)
      .toString(16)
      .padStart(2, "0");
    return `#${channel}${channel}${channel}`.toUpperCase();
  }

  const chroma = (1 - Math.abs(2 * light - 1)) * sat;
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = light - chroma / 2;

  let r = 0;
  let g = 0;
  let b = 0;
  if (hue < 60) [r, g, b] = [chroma, x, 0];
  else if (hue < 120) [r, g, b] = [x, chroma, 0];
  else if (hue < 180) [r, g, b] = [0, chroma, x];
  else if (hue < 240) [r, g, b] = [0, x, chroma];
  else if (hue < 300) [r, g, b] = [x, 0, chroma];
  else [r, g, b] = [chroma, 0, x];

  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

const DEFAULT_EMPTY_PALETTE_HEX = "#94A3B8";
const CHROMATIC_SATURATION_MIN = 12;

function hueDistance(a: number, b: number): number {
  const diff = Math.abs(a - b);
  return Math.min(diff, 360 - diff);
}

function squaredRgbDistance(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number },
): number {
  return (a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2;
}

function isTooCloseToExisting(hex: string, existingHexes: string[]): boolean {
  const target = hexToRgb(hex);
  if (!target) return false;
  return existingHexes.some((existingHex) => {
    const rgb = hexToRgb(existingHex);
    if (!rgb) return false;
    return squaredRgbDistance(target, rgb) < 900;
  });
}

/** Pick a sensible default hex when the user adds a new palette swatch. */
export function getDefaultNewColorHex(existingHexes: string[] = []): string {
  if (existingHexes.length === 0) return DEFAULT_EMPTY_PALETTE_HEX;

  const usedHues: number[] = [];
  for (const hex of existingHexes) {
    const hsl = hexToHsl(hex);
    if (hsl && hsl.s >= CHROMATIC_SATURATION_MIN) {
      usedHues.push(hsl.h);
    }
  }

  const candidateHues =
    usedHues.length === 0
      ? Array.from({ length: 12 }, (_, index) => index * 30)
      : Array.from({ length: 24 }, (_, index) => index * 15);

  let bestHex = DEFAULT_EMPTY_PALETTE_HEX;
  let bestScore = -1;

  for (const candidateHue of candidateHues) {
    const candidateHex = hslToHex(candidateHue, 48, 50);
    if (isTooCloseToExisting(candidateHex, existingHexes)) continue;

    const minHueDistance =
      usedHues.length === 0
        ? candidateHue
        : Math.min(...usedHues.map((usedHue) => hueDistance(candidateHue, usedHue)));

    if (minHueDistance > bestScore) {
      bestScore = minHueDistance;
      bestHex = candidateHex;
    }
  }

  return bestHex;
}
