import type { CTACustomTypography, CTATypographySource, FontSource, TypographyStyle } from "../types";

export interface GoogleFontEntry {
  family: string;
  category: string;
  popularity?: number;
}

export interface FontStyleSpec {
  fontWeight: number;
  fontStyle: "normal" | "italic";
}

const loadedVariants = new Map<string, Set<string>>();
let cachedGoogleFonts: GoogleFontEntry[] | null = null;
let cachedLocalFonts: string[] | null = null;
let cachedLocalFontStyles = new Map<string, string[]>();

/** Per-family face metadata from the Local Font Access API. */
export interface LocalFontFaceMeta {
  style: string;
  fullName: string;
  postscriptName: string;
}

let cachedLocalFontFaces = new Map<string, LocalFontFaceMeta[]>();
const registeredLocalFaceFamilies = new Set<string>();
const pendingLocalFaceLoads = new Map<string, Promise<string>>();
/** Embedded @font-face CSS for named local faces (html2canvas clone iframes). */
const localFaceCssCache = new Map<string, string>();

const LOCAL_FACE_LOAD_TIMEOUT_MS = 4000;
const FONTS_READY_TIMEOUT_MS = 2500;

type LocalFontData = {
  family: string;
  style?: string;
  fullName?: string;
  postscriptName?: string;
  blob: () => Promise<Blob>;
};

function settleWithTimeout<T>(promise: Promise<T>, ms: number): Promise<T | undefined> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(undefined), ms);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      () => {
        window.clearTimeout(timer);
        resolve(undefined);
      },
    );
  });
}

/** Wait for document.fonts.ready without hanging export if a face stays pending. */
export async function waitForDocumentFontsReady(
  timeoutMs: number = FONTS_READY_TIMEOUT_MS,
): Promise<void> {
  if (typeof document === "undefined" || !document.fonts?.ready) return;
  await settleWithTimeout(document.fonts.ready, timeoutMs);
}

/**
 * html2canvas re-quotes multi-word font families with single quotes. Names containing
 * an apostrophe (e.g. "Founder's Hand") become `'Founder's Hand'` and break canvas
 * `ctx.font` parsing, falling back to the tiny default sans-serif.
 */
function sanitizeFontFamilyToken(value: string): string {
  return value.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "font";
}

/** Deterministic CSS family alias for a named local face (weight/style axes are insufficient). */
export function localFontFaceCssFamily(family: string, styleName: string): string {
  // Keep aliases free of spaces/apostrophes so html2canvas won't re-quote them.
  return `__bs_local__${sanitizeFontFamilyToken(family)}__${sanitizeFontFamilyToken(styleName)}`;
}
export function getCachedLocalFontFaces(family: string): LocalFontFaceMeta[] {
  return cachedLocalFontFaces.get(family) ?? [];
}

function defaultLocalStyleName(family: string): string {
  const faces = getCachedLocalFontFaces(family);
  const regular = faces.find((face) => /^regular$/i.test(face.style));
  return regular?.style ?? faces[0]?.style ?? "Regular";
}

function cacheLocalFaceCss(
  cssFamily: string,
  dataUrl: string,
  styleName: string,
): void {
  const fontStyle = /italic|oblique/i.test(styleName) ? "italic" : "normal";
  const escapedFamily = cssFamily.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  localFaceCssCache.set(
    cssFamily,
    `@font-face{font-family:"${escapedFamily}";font-style:${fontStyle};font-weight:400;src:url(${dataUrl});}`,
  );
}

async function queryLocalFontData(options?: {
  postscriptNames?: string[];
}): Promise<LocalFontData[] | undefined> {
  // @ts-expect-error Local Font Access API
  if (typeof window.queryLocalFonts !== "function") return undefined;
  try {
    return (await settleWithTimeout(
      // @ts-expect-error Local Font Access API
      window.queryLocalFonts(options) as Promise<LocalFontData[]>,
      LOCAL_FACE_LOAD_TIMEOUT_MS,
    )) as LocalFontData[] | undefined;
  } catch {
    return undefined;
  }
}

async function loadLocalFontBuffer(
  family: string,
  styleName: string,
  meta?: LocalFontFaceMeta,
): Promise<ArrayBuffer | undefined> {
  if (meta?.postscriptName) {
    const matched = await queryLocalFontData({ postscriptNames: [meta.postscriptName] });
    const buffer = await settleWithTimeout(
      matched?.[0]?.blob().then((blob) => blob.arrayBuffer()) ?? Promise.resolve(undefined),
      LOCAL_FACE_LOAD_TIMEOUT_MS,
    );
    if (buffer) return buffer;
  }

  // Broader match — some faces fail postscript-only queries but still expose bytes.
  const all = await queryLocalFontData();
  if (!all?.length) return undefined;
  const styleLower = styleName.toLowerCase();
  const fontData =
    all.find(
      (entry) =>
        entry.family === family && (entry.style?.trim().toLowerCase() ?? "") === styleLower,
    ) ??
    all.find(
      (entry) =>
        entry.family === family &&
        (entry.fullName?.toLowerCase().includes(styleLower) ||
          entry.postscriptName?.toLowerCase().includes(styleLower.replace(/\s+/g, ""))),
    ) ??
    all.find((entry) => entry.family === family);
  if (!fontData) return undefined;
  return settleWithTimeout(fontData.blob().then((blob) => blob.arrayBuffer()), LOCAL_FACE_LOAD_TIMEOUT_MS);
}

async function registerLocalFontFace(family: string, styleName: string, cssFamily: string): Promise<string> {
  const meta = getCachedLocalFontFaces(family).find((face) => face.style === styleName);

  try {
    // Prefer raw bytes — required for html2canvas iframe clones (local() is not enough).
    const buffer = await loadLocalFontBuffer(family, styleName, meta);
    if (buffer) {
      const face = new FontFace(cssFamily, buffer, {
        style: /italic|oblique/i.test(styleName) ? "italic" : "normal",
        weight: "400",
      });
      const loaded = await settleWithTimeout(face.load(), LOCAL_FACE_LOAD_TIMEOUT_MS);
      if (loaded) {
        document.fonts.add(loaded);
        registeredLocalFaceFamilies.add(cssFamily);
        cacheLocalFaceCss(
          cssFamily,
          `data:${mimeTypeForFontBuffer(buffer)};base64,${arrayBufferToBase64(buffer)}`,
          styleName,
        );
        return cssFamily;
      }
    }
  } catch {
    // Fall through to local() references
  }

  const localNames = [meta?.fullName, meta?.postscriptName, `${family} ${styleName}`, family].filter(
    (name): name is string => Boolean(name?.trim()),
  );
  if (localNames.length === 0) return family;

  try {
    const src = localNames
      .map((name) => `local("${name.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}")`)
      .join(", ");
    const face = new FontFace(cssFamily, src, {
      style: /italic|oblique/i.test(styleName) ? "italic" : "normal",
      weight: "400",
    });
    // local() loads can hang indefinitely in some browsers — never block export on them.
    const loaded = await settleWithTimeout(face.load(), LOCAL_FACE_LOAD_TIMEOUT_MS);
    if (loaded) {
      document.fonts.add(loaded);
      registeredLocalFaceFamilies.add(cssFamily);
    }
  } catch {
    // Face may still resolve via the original family name as a fallback in CSS.
  }
  return cssFamily;
}

/**
 * Registers a named local face under a unique CSS family so styles like "Outlines"
 * can be selected independently of font-weight / font-style.
 */
export async function ensureLocalFontFace(family: string, styleName: string): Promise<string> {
  const cssFamily = localFontFaceCssFamily(family, styleName);
  if (typeof document === "undefined") return cssFamily;
  // Require embedded CSS for PDF/PNG capture — a local()-only registration is not enough.
  if (registeredLocalFaceFamilies.has(cssFamily) && localFaceCssCache.has(cssFamily)) {
    return cssFamily;
  }

  const pending = pendingLocalFaceLoads.get(cssFamily);
  if (pending) return pending;

  const load = registerLocalFontFace(family, styleName, cssFamily).finally(() => {
    pendingLocalFaceLoads.delete(cssFamily);
  });
  pendingLocalFaceLoads.set(cssFamily, load);
  return load;
}

function mimeTypeForFontBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  // wOFF2 signature: wOF2
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x77 &&
    bytes[1] === 0x4f &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x32
  ) {
    return "font/woff2";
  }
  // wOFF signature: wOFF
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x77 &&
    bytes[1] === 0x4f &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46
  ) {
    return "font/woff";
  }
  // OTTO (CFF) / ttcf / true
  if (bytes.length >= 4 && bytes[0] === 0x4f && bytes[1] === 0x54 && bytes[2] === 0x54 && bytes[3] === 0x4f) {
    return "font/otf";
  }
  return "font/ttf";
}

/** CSS font-family stack for a typography entry, honoring named local faces when set. */
export function resolveCssFontFamily(
  family: string,
  source?: FontSource,
  localFontStyle?: string,
): string {
  if (source === "local") {
    // Always use a sanitized alias so html2canvas capture never sees apostrophes/spaces
    // in the primary family token (preview still falls back to the real family name).
    const styleName = localFontStyle?.trim() || defaultLocalStyleName(family);
    const alias = localFontFaceCssFamily(family, styleName);
    void ensureLocalFontFace(family, styleName);
    return `"${alias}", "${family}", sans-serif`;
  }
  return `"${family}", sans-serif`;
}

const LOCAL_FONTS_PERMISSION_STORAGE_KEY = "local-fonts-permission-granted";

function readPersistedLocalFontPermission(): boolean {
  try {
    return sessionStorage.getItem(LOCAL_FONTS_PERMISSION_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function persistLocalFontPermissionGranted(): void {
  try {
    sessionStorage.setItem(LOCAL_FONTS_PERMISSION_STORAGE_KEY, "1");
  } catch {
    // sessionStorage may be unavailable (private mode, etc.)
  }
}

let localFontsAccessGranted = readPersistedLocalFontPermission();

export type LocalFontPermissionState = "granted" | "prompt" | "denied" | "unsupported";

const PICKER_PREVIEW_VARIANTS: FontStyleSpec[] = [
  { fontWeight: 300, fontStyle: "normal" },
  { fontWeight: 400, fontStyle: "normal" },
  { fontWeight: 500, fontStyle: "normal" },
  { fontWeight: 600, fontStyle: "normal" },
  { fontWeight: 700, fontStyle: "normal" },
  { fontWeight: 400, fontStyle: "italic" },
];

function variantKey(fontWeight: number, fontStyle: "normal" | "italic"): string {
  return `${fontWeight}-${fontStyle}`;
}

function linkIdForFamily(family: string): string {
  return `google-font-${family.replace(/\s+/g, "-")}`;
}

/** Google Fonts specimen page for a family (e.g. DM Sans → …/specimen/DM+Sans). */
export function googleFontSpecimenUrl(family: string): string {
  return `https://fonts.google.com/specimen/${family.replace(/ /g, "+")}`;
}

function buildGoogleFontsUrl(family: string, variants: FontStyleSpec[]): string {
  const normalWeights = [
    ...new Set(variants.filter((v) => v.fontStyle === "normal").map((v) => v.fontWeight)),
  ].sort((a, b) => a - b);
  const italicWeights = [
    ...new Set(variants.filter((v) => v.fontStyle === "italic").map((v) => v.fontWeight)),
  ].sort((a, b) => a - b);

  if (italicWeights.length === 0) {
    const weights = normalWeights.length ? normalWeights : [400];
    return `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weights.join(";")}&display=swap`;
  }

  const axisPairs: string[] = [];
  for (const w of normalWeights) axisPairs.push(`0,${w}`);
  for (const w of italicWeights) axisPairs.push(`1,${w}`);
  if (!axisPairs.length) axisPairs.push("0,400");

  return `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:ital,wght@${axisPairs.join(";")}&display=swap`;
}

/** Ensures a Google Font family is loaded with the given weight/style variants. */
export function ensureGoogleFontVariants(family: string, variants: FontStyleSpec[]): void {
  const existing = loadedVariants.get(family) ?? new Set<string>();
  const merged = new Set(existing);
  for (const v of variants) merged.add(variantKey(v.fontWeight, v.fontStyle));

  if (merged.size === existing.size && existing.size > 0) return;

  loadedVariants.set(family, merged);

  const allSpecs: FontStyleSpec[] = [...merged].map((key) => {
    const dash = key.lastIndexOf("-");
    return {
      fontWeight: Number(key.slice(0, dash)),
      fontStyle: key.slice(dash + 1) as "normal" | "italic",
    };
  });

  const id = linkIdForFamily(family);
  let link = document.getElementById(id) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }
  link.href = buildGoogleFontsUrl(family, allSpecs);
}

/** Loads common weights for font-picker previews. */
export function loadGoogleFont(family: string): void {
  ensureGoogleFontVariants(family, PICKER_PREVIEW_VARIANTS);
}

export function loadGoogleFonts(families: string[]): void {
  families.forEach(loadGoogleFont);
}

/** Loads every weight/style variant used in the typography hierarchy. */
export function loadGoogleFontsFromTypography(typography: TypographyStyle[]): void {
  const byFamily = new Map<string, FontStyleSpec[]>();

  const add = (family: string, fontWeight: number, fontStyle: "normal" | "italic") => {
    const list = byFamily.get(family) ?? [];
    const key = variantKey(fontWeight, fontStyle);
    if (!list.some((v) => variantKey(v.fontWeight, v.fontStyle) === key)) {
      list.push({ fontWeight, fontStyle });
      byFamily.set(family, list);
    }
  };

  for (const style of typography) {
    if (style.fontSource === "local") continue;
    add(style.fontFamily, style.fontWeight, style.fontStyle);
  }

  for (const [family, variants] of byFamily) {
    ensureGoogleFontVariants(family, variants);
  }
}

type CTAFontEntry = {
  typographySource?: CTATypographySource;
  customTypography?: CTACustomTypography;
};

function eachCTACustomTypography(
  styles: CTAFontEntry[] | undefined,
  visit: (custom: CTACustomTypography) => void,
): void {
  for (const style of styles ?? []) {
    if (style.typographySource !== "custom" || !style.customTypography?.fontFamily) continue;
    visit(style.customTypography);
  }
}

/** Loads Google / local faces used by per-button custom type rules. */
export function loadCTACustomFonts(styles: CTAFontEntry[] | undefined): void {
  const byFamily = new Map<string, FontStyleSpec[]>();

  eachCTACustomTypography(styles, (custom) => {
    if (custom.fontSource === "local") {
      if (custom.localFontStyle) void ensureLocalFontFace(custom.fontFamily, custom.localFontStyle);
      return;
    }
    const list = byFamily.get(custom.fontFamily) ?? [];
    const style = custom.fontStyle ?? "normal";
    const key = variantKey(custom.fontWeight, style);
    if (!list.some((v) => variantKey(v.fontWeight, v.fontStyle) === key)) {
      list.push({ fontWeight: custom.fontWeight, fontStyle: style });
      byFamily.set(custom.fontFamily, list);
    }
  });

  for (const [family, variants] of byFamily) {
    ensureGoogleFontVariants(family, variants);
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}
export function getCachedLocalFonts(): string[] | null {
  return cachedLocalFonts;
}

const LOCAL_FONT_PROBE = "mmmmmmmmmmlliwi";

function measureTextWidth(fontSpec: string): number {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return 0;
  ctx.font = fontSpec;
  return ctx.measureText(LOCAL_FONT_PROBE).width;
}

/**
 * Detects whether a locally installed font family is available on this device.
 * Uses the Local Font Access cache when present, otherwise a canvas measurement
 * against generic fallbacks (no permission prompt).
 */
export function isLocalFontInstalled(family: string): boolean {
  if (typeof document === "undefined") return true;
  const name = family.trim();
  if (!name) return false;

  const cached = getCachedLocalFonts();
  if (cached) {
    const lower = name.toLowerCase();
    if (cached.some((entry) => entry.toLowerCase() === lower)) return true;
  }

  const escaped = name.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const quoted = `"${escaped}"`;
  return (["monospace", "serif", "sans-serif"] as const).some((fallback) => {
    const baseline = measureTextWidth(`72px ${fallback}`);
    const withFamily = measureTextWidth(`72px ${quoted}, ${fallback}`);
    return withFamily !== baseline;
  });
}

export function areLocalFontsEnabled(): boolean {
  return localFontsAccessGranted;
}

/** True when the Local Font Access API (`queryLocalFonts`) is available (Chrome / Chromium). */
export function isLocalFontApiSupported(): boolean {
  // @ts-expect-error Local Font Access API
  return typeof window !== "undefined" && typeof window.queryLocalFonts === "function";
}

/**
 * Display name for unsupported-local-fonts messaging.
 * Only used when `isLocalFontApiSupported()` is false (Edge Chromium usually supports the API).
 */
export function getBrowserDisplayName(): string {
  if (typeof navigator === "undefined") return "This browser";
  const ua = navigator.userAgent;
  if (/Firefox\//i.test(ua)) return "Firefox";
  if (/Edg\//i.test(ua)) return "Edge";
  // Safari UA also matches Chrome; exclude Chromium-based browsers.
  if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua) && !/Chromium\//i.test(ua)) {
    return "Safari";
  }
  return "This browser";
}

/** Resolves whether the user must grant local-font access (first-time prompt only). */
export async function getLocalFontPermissionState(): Promise<LocalFontPermissionState> {
  if (localFontsAccessGranted || readPersistedLocalFontPermission()) {
    localFontsAccessGranted = true;
    return "granted";
  }

  if (!isLocalFontApiSupported()) return "unsupported";

  try {
    if (typeof navigator !== "undefined" && navigator.permissions?.query) {
      // @ts-expect-error Permissions API — local-fonts is not in standard TS lib yet
      const status = await navigator.permissions.query({ name: "local-fonts" });
      if (status.state === "granted") {
        localFontsAccessGranted = true;
        persistLocalFontPermissionGranted();
        return "granted";
      }
      if (status.state === "denied") return "denied";
      return "prompt";
    }
  } catch {
    // Permissions API may not support the local-fonts name in this browser
  }

  return "prompt";
}

/** @deprecated Prefer getLocalFontPermissionState() === "prompt" for overlay gating. */
export function needsLocalFontPermission(): boolean {
  if (localFontsAccessGranted) return false;
  return isLocalFontApiSupported();
}

const PUBLIC_GOOGLE_FONT_EXCLUSIONS = new Set(["Google Sans"]);

export function splitGoogleFonts(fonts: GoogleFontEntry[]): {
  top: GoogleFontEntry[];
  rest: GoogleFontEntry[];
} {
  const ranked = [...fonts]
    .filter((f) => !PUBLIC_GOOGLE_FONT_EXCLUSIONS.has(f.family))
    .sort((a, b) => (a.popularity ?? 9999) - (b.popularity ?? 9999));
  const top = ranked.slice(0, 20);
  const topFamilies = new Set(top.map((f) => f.family));
  const rest = fonts
    .filter((f) => !topFamilies.has(f.family))
    .sort((a, b) => a.family.localeCompare(b.family, undefined, { sensitivity: "base" }));
  return { top, rest };
}

export async function fetchGoogleFonts(): Promise<GoogleFontEntry[]> {
  if (cachedGoogleFonts) return cachedGoogleFonts;

  try {
    const res = await fetch("/google-fonts.json");
    if (!res.ok) throw new Error(`Failed to load Google Fonts catalog (${res.status})`);
    const list = (await res.json()) as GoogleFontEntry[];
    cachedGoogleFonts = list;
    return list;
  } catch {
    const fallback: GoogleFontEntry[] = [
      { family: "Open Sans", category: "Sans Serif", popularity: 2 },
      { family: "Roboto", category: "Sans Serif", popularity: 3 },
      { family: "Inter", category: "Sans Serif", popularity: 5 },
      { family: "Montserrat", category: "Sans Serif", popularity: 6 },
      { family: "Poppins", category: "Sans Serif", popularity: 10 },
      { family: "Lato", category: "Sans Serif", popularity: 12 },
      { family: "DM Sans", category: "Sans Serif", popularity: 14 },
      { family: "Playfair Display", category: "Serif", popularity: 20 },
      { family: "Instrument Serif", category: "Serif", popularity: 67 },
      { family: "Fraunces", category: "Serif" },
      { family: "Merriweather", category: "Serif" },
      { family: "Libre Baskerville", category: "Serif" },
      { family: "JetBrains Mono", category: "Monospace" },
    ];
    cachedGoogleFonts = fallback;
    return fallback;
  }
}

export async function fetchLocalFonts(options?: { force?: boolean }): Promise<string[]> {
  if (!options?.force && cachedLocalFonts !== null) return cachedLocalFonts;
  try {
    // @ts-expect-error Local Font Access API
    if (!window.queryLocalFonts) return [];
    // @ts-expect-error Local Font Access API
    const fonts = await window.queryLocalFonts();
    const families = fonts.map((f: { family: string }) => f.family);

    const stylesByFamily = new Map<string, string[]>();
    const facesByFamily = new Map<string, LocalFontFaceMeta[]>();
    for (const font of fonts as {
      family: string;
      style?: string;
      fullName?: string;
      postscriptName?: string;
    }[]) {
      const style = font.style?.trim();
      if (!style) continue;
      const list = stylesByFamily.get(font.family) ?? [];
      if (!list.includes(style)) list.push(style);
      stylesByFamily.set(font.family, list);

      const faces = facesByFamily.get(font.family) ?? [];
      if (!faces.some((face) => face.style === style)) {
        faces.push({
          style,
          fullName: font.fullName?.trim() || `${font.family} ${style}`,
          postscriptName: font.postscriptName?.trim() || "",
        });
        facesByFamily.set(font.family, faces);
      }
    }
    cachedLocalFontStyles = stylesByFamily;
    cachedLocalFontFaces = facesByFamily;

    cachedLocalFonts = Array.from(new Set<string>(families)).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" }),
    );
    localFontsAccessGranted = true;
    persistLocalFontPermissionGranted();
    return cachedLocalFonts;
  } catch {
    return cachedLocalFonts ?? [];
  }
}

/** Actual installed style names (e.g. "Regular", "Hairline Italic") for a local font family. */
export async function fetchLocalFontStyles(family: string): Promise<string[]> {
  if (cachedLocalFontStyles.size === 0) {
    await fetchLocalFonts();
  }
  return cachedLocalFontStyles.get(family) ?? [];
}
