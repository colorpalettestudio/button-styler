import type { BrandColor, CTAStyle, CTAVisualState, TypographyStyle } from "../types";
import { buildCTATypographyStyle, ctaBorderRadius } from "./ctaCss";
import { resolveColorHex } from "./colorResolve";
import { isLightColor } from "./colorUtils";

export type ButtonStateKey = "default" | "hover";

/** Pixel density of exported PNGs (2× keeps text crisp on retina screens and in slides). */
const SCALE = 2;
const SINGLE_MARGIN = 12;

interface ButtonLayout {
  font: string;
  letterSpacingPx: number;
  label: string;
  textWidth: number;
  fontPx: number;
  lineHeightPx: number;
  paddingX: number;
  paddingY: number;
  borderWidth: number;
  isText: boolean;
  width: number;
  height: number;
}

function toPx(value: string | number | undefined, fontPx: number): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  const n = parseFloat(value);
  if (!Number.isFinite(n)) return 0;
  if (value.trim().endsWith("rem")) return n * 16;
  if (value.trim().endsWith("em")) return n * fontPx;
  return n;
}

function applyTextTransform(text: string, transform: string | undefined): string {
  if (transform === "uppercase") return text.toUpperCase();
  if (transform === "lowercase") return text.toLowerCase();
  if (transform === "capitalize") return text.replace(/\b\p{L}/gu, (c) => c.toUpperCase());
  return text;
}

function setTextStyle(ctx: CanvasRenderingContext2D, layout: Pick<ButtonLayout, "font" | "letterSpacingPx">) {
  ctx.font = layout.font;
  if ("letterSpacing" in ctx) {
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing =
      `${layout.letterSpacingPx}px`;
  }
}

function layoutButton(
  ctx: CanvasRenderingContext2D,
  cta: CTAStyle,
  typography: TypographyStyle[],
): ButtonLayout {
  const typo = buildCTATypographyStyle(cta.typographyStyleId, typography, cta);
  const fontPx = toPx(String(typo.fontSize ?? "1rem"), 16) || 16;
  const font = `${typo.fontStyle === "italic" ? "italic " : ""}${typo.fontWeight ?? 400} ${fontPx}px ${typo.fontFamily ?? "sans-serif"}`;
  const letterSpacingPx = toPx(String(typo.letterSpacing ?? "0"), fontPx);
  const label = `${applyTextTransform(cta.sampleText, String(typo.textTransform ?? "none"))}${cta.showArrow ? " →" : ""}`;
  const isText = cta.kind === "link" || cta.fill === "text";

  setTextStyle(ctx, { font, letterSpacingPx });
  // Canvas counts trailing letter-spacing after the last glyph; CSS visually does too, so keep it.
  const textWidth = ctx.measureText(label).width;
  const lineHeightPx = fontPx * (parseFloat(String(typo.lineHeight ?? "1.2")) || 1.2);
  const paddingX = isText ? 0 : toPx(cta.paddingX, fontPx);
  const paddingY = isText ? 0 : toPx(cta.paddingY, fontPx);
  const borderWidth = isText ? 0 : Math.max(0, cta.borderWidth || 0);

  return {
    font,
    letterSpacingPx,
    label,
    textWidth,
    fontPx,
    lineHeightPx,
    paddingX,
    paddingY,
    borderWidth,
    isText,
    width: Math.ceil(textWidth + paddingX * 2 + borderWidth * 2),
    height: Math.ceil(lineHeightPx + paddingY * 2 + borderWidth * 2),
  };
}

function shapePath(
  ctx: CanvasRenderingContext2D,
  cta: CTAStyle,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const radius = ctaBorderRadius(cta.shape, cta.borderRadius);
  ctx.beginPath();
  if (radius.endsWith("%")) {
    ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    return;
  }
  const r = Math.max(0, Math.min(parseFloat(radius) || 0, w / 2, h / 2));
  ctx.roundRect(x, y, w, h, r);
}

function drawButton(
  ctx: CanvasRenderingContext2D,
  cta: CTAStyle,
  state: CTAVisualState,
  layout: ButtonLayout,
  colors: BrandColor[],
  x: number,
  y: number,
) {
  const { width, height, borderWidth } = layout;

  if (!layout.isText) {
    const bg = resolveColorHex(state.backgroundColorId, colors, "transparent");
    if (bg !== "transparent" && (cta.fill === "solid" || cta.fill === "solid-outline" || state.backgroundColorId)) {
      shapePath(ctx, cta, x, y, width, height);
      ctx.fillStyle = bg;
      ctx.fill();
    }
    const border = resolveColorHex(state.borderColorId, colors, "transparent");
    if (borderWidth > 0 && border !== "transparent") {
      const inset = borderWidth / 2;
      shapePath(ctx, cta, x + inset, y + inset, width - borderWidth, height - borderWidth);
      ctx.strokeStyle = border;
      ctx.lineWidth = borderWidth;
      ctx.stroke();
    }
  }

  setTextStyle(ctx, layout);
  ctx.fillStyle = resolveColorHex(state.textColorId, colors, "#1A1A1A");
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  const metrics = ctx.measureText(layout.label);
  const ascent = metrics.fontBoundingBoxAscent ?? layout.fontPx * 0.8;
  const descent = metrics.fontBoundingBoxDescent ?? layout.fontPx * 0.2;
  const textX = x + borderWidth + layout.paddingX;
  const lineTop = y + borderWidth + layout.paddingY;
  const baseline = lineTop + (layout.lineHeightPx - (ascent + descent)) / 2 + ascent;
  ctx.fillText(layout.label, textX, baseline);

  if (state.underline) {
    const thickness = Math.max(1, layout.fontPx / 16);
    const underlineY = baseline + layout.fontPx * 0.2;
    ctx.fillRect(textX, underlineY, layout.textWidth - layout.letterSpacingPx, thickness);
  }
}

async function ensureFontsReady(
  ctx: CanvasRenderingContext2D,
  styles: CTAStyle[],
  typography: TypographyStyle[],
) {
  await Promise.all(
    styles.map((cta) => {
      const layout = layoutButton(ctx, cta, typography);
      return document.fonts.load(layout.font, layout.label).catch(() => []);
    }),
  );
  await document.fonts.ready;
}

function createCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(width * SCALE);
  canvas.height = Math.ceil(height * SCALE);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not supported in this browser.");
  ctx.scale(SCALE, SCALE);
  return { canvas, ctx };
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not create image."))), "image/png"),
  );
}

/** One button in one state, on a transparent or solid background. */
export async function renderButtonImage(
  cta: CTAStyle,
  state: ButtonStateKey,
  colors: BrandColor[],
  typography: TypographyStyle[],
  background: string | null,
): Promise<Blob> {
  const probe = createCanvas(1, 1).ctx;
  await ensureFontsReady(probe, [cta], typography);
  const layout = layoutButton(probe, cta, typography);
  const { canvas, ctx } = createCanvas(
    layout.width + SINGLE_MARGIN * 2,
    layout.height + SINGLE_MARGIN * 2,
  );
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  drawButton(ctx, cta, cta[state], layout, colors, SINGLE_MARGIN, SINGLE_MARGIN);
  return canvasToBlob(canvas);
}

/** Every style's default and hover state on one labeled sheet. */
export async function renderButtonSheet(
  styles: CTAStyle[],
  colors: BrandColor[],
  typography: TypographyStyle[],
  background: string | null,
  /** Color the sheet will be viewed on; picks readable label colors when transparent. */
  surface: string,
  title: string,
): Promise<Blob> {
  const probe = createCanvas(1, 1).ctx;
  await ensureFontsReady(probe, styles, typography);
  const layouts = styles.map((cta) => layoutButton(probe, cta, typography));

  const pad = 48;
  const labelCol = 200;
  const gap = 56;
  const rowGap = 36;
  const headerH = 76;
  const colW = Math.max(160, ...layouts.map((l) => l.width));
  const rowHeights = layouts.map((l) => Math.max(l.height, 24));
  const width = pad * 2 + labelCol + colW * 2 + gap * 2;
  const height =
    pad * 2 + headerH + rowHeights.reduce((sum, h) => sum + h + rowGap, 0) - (styles.length ? rowGap : 0);

  const { canvas, ctx } = createCanvas(width, Math.max(height, pad * 2 + headerH));
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  const light = isLightColor(background ?? surface);
  const ink = light ? "rgba(20, 20, 20, 0.88)" : "rgba(255, 255, 255, 0.92)";
  const muted = light ? "rgba(20, 20, 20, 0.5)" : "rgba(255, 255, 255, 0.6)";
  const rule = light ? "rgba(20, 20, 20, 0.1)" : "rgba(255, 255, 255, 0.16)";
  const uiFont = 'system-ui, -apple-system, "Segoe UI", sans-serif';
  const col1 = pad + labelCol + gap;
  const col2 = col1 + colW + gap;

  setTextStyle(ctx, { font: `600 20px ${uiFont}`, letterSpacingPx: 0 });
  ctx.fillStyle = ink;
  ctx.textBaseline = "top";
  ctx.fillText(title, pad, pad);

  setTextStyle(ctx, { font: `600 11px ${uiFont}`, letterSpacingPx: 1.2 });
  ctx.fillStyle = muted;
  ctx.fillText("DEFAULT", col1, pad + 44);
  ctx.fillText("HOVER", col2, pad + 44);

  let y = pad + headerH;
  styles.forEach((cta, index) => {
    const layout = layouts[index];
    const rowH = rowHeights[index];
    if (index > 0) {
      ctx.fillStyle = rule;
      ctx.fillRect(pad, y - rowGap / 2, width - pad * 2, 1);
    }
    setTextStyle(ctx, { font: `500 14px ${uiFont}`, letterSpacingPx: 0 });
    ctx.fillStyle = ink;
    ctx.textBaseline = "middle";
    ctx.fillText(cta.name, pad, y + rowH / 2, labelCol);

    const by = y + (rowH - layout.height) / 2;
    drawButton(ctx, cta, cta.default, layout, colors, col1, by);
    drawButton(ctx, cta, cta.hover, layout, colors, col2, by);
    y += rowH + rowGap;
  });

  return canvasToBlob(canvas);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
