import type {
  BrandColor,
  ButtonStylerProject,
  CTAStyle,
  CTAVisualState,
  FontSource,
  TypographyStyle,
} from "../types";
import { isCTACustomTypography } from "../types";
import { buildCTAStateStyle, buildCTATypographyStyle, ctaBorderRadius } from "./ctaCss";
import { computeAccessiblePairings, resolveCTAStyles } from "./ctaResolve";
import { resolveColorHex } from "./colorResolve";

export interface ExportedStyle {
  cta: CTAStyle;
  className: string;
}

export interface UsedFont {
  family: string;
  source: FontSource;
  weights: { fontWeight: number; fontStyle: "normal" | "italic" }[];
}

export function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "style"
  );
}

function brandSlug(project: ButtonStylerProject): string {
  return slugify(project.brandName || "brand");
}

export function resolveProjectStyles(project: ButtonStylerProject): CTAStyle[] {
  return resolveCTAStyles(
    project.ctaStyles,
    project.colors,
    project.typography,
    computeAccessiblePairings(project.colors),
  );
}

/** Stable, unique CSS class names derived from each style's label. */
export function buildExportedStyles(project: ButtonStylerProject): ExportedStyle[] {
  const used = new Set<string>();
  return resolveProjectStyles(project).map((cta) => {
    const prefix = cta.kind === "link" ? "link" : "btn";
    const slug = slugify(cta.name).replace(new RegExp(`^${prefix}-`), "");
    let className = `${prefix}-${slug}`;
    let n = 2;
    while (used.has(className)) className = `${prefix}-${slug}-${n++}`;
    used.add(className);
    return { cta, className };
  });
}

const ROLE_VARIABLE: Record<BrandColor["role"], string> = {
  hero: "main",
  accent: "accent",
  "light-neutral": "light",
  "dark-neutral": "dark",
};

/** CSS custom-property name for each palette color, e.g. `--brand-main`, `--brand-accent-1`. */
export function buildColorVariables(colors: BrandColor[]): Map<string, string> {
  const byId = new Map<string, string>();
  let accentIndex = 0;
  for (const color of colors) {
    const base = ROLE_VARIABLE[color.role];
    byId.set(color.id, color.role === "accent" ? `--brand-${base}-${++accentIndex}` : `--brand-${base}`);
  }
  return byId;
}

function fontStackFor(family: string, source: FontSource | undefined): string {
  const quoted = `"${family.replace(/"/g, '\\"')}"`;
  return source === "local" ? `${quoted}, system-ui, sans-serif` : `${quoted}, sans-serif`;
}

/** Font family / source / weight actually used by a resolved style. */
function fontForStyle(
  cta: CTAStyle,
  typography: TypographyStyle[],
): { family: string; source: FontSource; fontWeight: number; fontStyle: "normal" | "italic" } | null {
  if (isCTACustomTypography(cta)) {
    const custom = cta.customTypography;
    return {
      family: custom.fontFamily,
      source: custom.fontSource ?? "google",
      fontWeight: custom.fontWeight,
      fontStyle: custom.fontStyle ?? "normal",
    };
  }
  const role = typography.find((t) => t.id === cta.typographyStyleId) ?? typography[0];
  if (!role) return null;
  return {
    family: role.fontFamily,
    source: role.fontSource ?? "google",
    fontWeight: role.fontWeight,
    fontStyle: role.fontStyle,
  };
}

export function collectUsedFonts(
  styles: ExportedStyle[],
  typography: TypographyStyle[],
): UsedFont[] {
  const byKey = new Map<string, UsedFont>();
  for (const { cta } of styles) {
    const font = fontForStyle(cta, typography);
    if (!font) continue;
    const key = `${font.source}:${font.family}`;
    const entry = byKey.get(key) ?? { family: font.family, source: font.source, weights: [] };
    if (
      !entry.weights.some(
        (w) => w.fontWeight === font.fontWeight && w.fontStyle === font.fontStyle,
      )
    ) {
      entry.weights.push({ fontWeight: font.fontWeight, fontStyle: font.fontStyle });
    }
    byKey.set(key, entry);
  }
  return [...byKey.values()];
}

export function buildGoogleFontsImportUrl(fonts: UsedFont[]): string | null {
  const google = fonts.filter((f) => f.source === "google");
  if (!google.length) return null;
  const families = google.map((font) => {
    const hasItalic = font.weights.some((w) => w.fontStyle === "italic");
    const name = font.family.replace(/ /g, "+");
    if (!hasItalic) {
      const weights = [...new Set(font.weights.map((w) => w.fontWeight))].sort((a, b) => a - b);
      return `family=${name}:wght@${weights.join(";")}`;
    }
    const pairs = [
      ...new Set(font.weights.map((w) => `${w.fontStyle === "italic" ? 1 : 0},${w.fontWeight}`)),
    ].sort();
    return `family=${name}:ital,wght@${pairs.join(";")}`;
  });
  return `https://fonts.googleapis.com/css2?${families.join("&")}&display=swap`;
}

function colorValue(
  colorId: string | null | undefined,
  colors: BrandColor[],
  variables: Map<string, string>,
  fallback: string,
): string {
  const hex = resolveColorHex(colorId, colors, fallback);
  if (hex === fallback) return fallback;
  const match = colors.find((c) => c.hex.toUpperCase() === hex.toUpperCase());
  const variable = match ? variables.get(match.id) : undefined;
  return variable ? `var(${variable})` : hex;
}

function stateDeclarations(
  state: CTAVisualState,
  cta: CTAStyle,
  colors: BrandColor[],
  variables: Map<string, string>,
): string[] {
  const resolved = buildCTAStateStyle(state, colors, cta.fill, cta.borderWidth);
  const lines = [`  color: ${colorValue(state.textColorId, colors, variables, "#1A1A1A")};`];

  if (cta.kind === "link" || cta.fill === "text") {
    lines.push("  background-color: transparent;");
  } else {
    const bg =
      resolved.backgroundColor === "transparent" || !resolved.backgroundColor
        ? "transparent"
        : colorValue(state.backgroundColorId, colors, variables, "transparent");
    lines.push(`  background-color: ${bg};`);
    if (resolved.border && resolved.border !== "none") {
      const border = colorValue(state.borderColorId, colors, variables, "transparent");
      lines.push(`  border-color: ${border};`);
    }
  }

  lines.push(`  text-decoration: ${state.underline ? "underline" : "none"};`);
  if (state.underline) lines.push("  text-underline-offset: 0.2em;");
  return lines;
}

export function buildButtonCss(project: ButtonStylerProject): string {
  const { colors, typography } = project;
  const styles = buildExportedStyles(project);
  const variables = buildColorVariables(colors);
  const fonts = collectUsedFonts(styles, typography);
  const importUrl = buildGoogleFontsImportUrl(fonts);
  const localFonts = fonts.filter((f) => f.source === "local");
  const title = project.brandName.trim() || "Brand";

  const out: string[] = [];
  out.push(`/* ${title} buttons & links — generated by Button Styler */`);
  if (importUrl) out.push(`@import url("${importUrl}");`);
  if (localFonts.length) {
    out.push(
      `/* System fonts used: ${localFonts.map((f) => `"${f.family}"`).join(", ")}.\n   These load from the visitor's computer. To show them on your website,\n   self-host the font files with @font-face (check your font license). */`,
    );
  }
  out.push("");
  out.push(":root {");
  for (const color of colors) {
    out.push(`  ${variables.get(color.id)}: ${color.hex.toUpperCase()};`);
  }
  out.push("}");

  for (const { cta, className } of styles) {
    const isLink = cta.kind === "link";
    const typo = buildCTATypographyStyle(cta.typographyStyleId, typography, cta);
    const font = fontForStyle(cta, typography);
    const hasBorder = !isLink && cta.borderWidth > 0;

    const base = [
      font ? `  font-family: ${fontStackFor(font.family, font.source)};` : "",
      typo.fontSize ? `  font-size: ${typo.fontSize};` : "",
      typo.fontWeight ? `  font-weight: ${typo.fontWeight};` : "",
      typo.fontStyle && typo.fontStyle !== "normal" ? `  font-style: ${typo.fontStyle};` : "",
      typo.lineHeight ? `  line-height: ${typo.lineHeight};` : "",
      `  letter-spacing: ${typo.letterSpacing ?? "0"};`,
      `  text-transform: ${typo.textTransform ?? "none"};`,
      isLink ? "  display: inline;" : "  display: inline-flex;",
      isLink ? "" : "  align-items: center;",
      isLink ? "" : "  justify-content: center;",
      isLink ? "  padding: 0;" : `  padding: ${cta.paddingY} ${cta.paddingX};`,
      isLink ? "" : `  border-radius: ${ctaBorderRadius(cta.shape, cta.borderRadius)};`,
      hasBorder ? `  border: ${cta.borderWidth}px solid transparent;` : "  border: 0;",
      ...stateDeclarations(cta.default, cta, colors, variables),
      "  cursor: pointer;",
      isLink ? "" : "  white-space: nowrap;",
      "  transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease;",
    ].filter(Boolean);

    out.push("");
    out.push(`/* ${cta.name} */`);
    out.push(`.${className} {`);
    out.push(...base);
    out.push("}");
    out.push("");
    out.push(`.${className}:hover,\n.${className}:focus-visible {`);
    out.push(...stateDeclarations(cta.hover, cta, colors, variables));
    out.push("}");
    out.push("");
    const focusColorId =
      !isLink && cta.hover.backgroundColorId ? cta.hover.backgroundColorId : cta.hover.textColorId;
    out.push(`.${className}:focus-visible {`);
    out.push(
      `  outline: 2px solid ${colorValue(focusColorId, colors, variables, "currentColor")};`,
    );
    out.push("  outline-offset: 3px;");
    out.push("}");
    if (cta.showArrow) {
      out.push("");
      out.push(`.${className}::after {`);
      out.push('  content: " →";');
      out.push("}");
    }
  }

  return `${out.join("\n")}\n`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Self-contained page that renders the exported CSS + HTML (used for the live test). */
export function buildPreviewDocument(project: ButtonStylerProject, background: string): string {
  const css = buildButtonCss(project);
  const items = buildExportedStyles(project)
    .map(
      ({ cta, className }) =>
        `<div class="row"><span class="label">.${className}</span><a class="${className}" href="#">${escapeHtml(cta.sampleText)}</a></div>`,
    )
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css}
body{margin:0;padding:28px;background:${background};font-family:system-ui,sans-serif}
.row{display:flex;flex-wrap:wrap;align-items:center;gap:12px 24px;padding:14px 0;border-bottom:1px solid rgba(127,127,127,.18);overflow-x:auto}
.row:last-child{border-bottom:0}
.label{width:180px;flex-shrink:0;font:12px/1.4 ui-monospace,monospace;color:rgba(127,127,127,.95)}
</style></head><body>${items}</body></html>`;
}

export function exportFileBase(project: ButtonStylerProject): string {
  return `${brandSlug(project)}-buttons`;
}