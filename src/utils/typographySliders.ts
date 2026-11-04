export function parseRem(value: string): number {
  const n = parseFloat(value);
  return Number.isNaN(n) ? 1 : n;
}

export function formatRem(value: number): string {
  return `${value.toFixed(2)}rem`;
}

export function parseLineHeight(value: string): number {
  const n = parseFloat(value);
  return Number.isNaN(n) ? 1.5 : n;
}

export function formatLineHeight(value: number): string {
  return value.toFixed(2);
}

export function parseLetterSpacingEm(value: string): number {
  const n = parseFloat(value);
  return Number.isNaN(n) ? 0 : n;
}

export function formatLetterSpacingEm(value: number): string {
  return `${value.toFixed(3)}em`;
}

export const SIZE_SLIDER = { min: 0.65, max: 6, step: 0.05 };
export const LINE_HEIGHT_SLIDER = { min: 1, max: 2, step: 0.05 };
export const LETTER_SPACING_SLIDER = { min: -0.08, max: 0.2, step: 0.005 };
