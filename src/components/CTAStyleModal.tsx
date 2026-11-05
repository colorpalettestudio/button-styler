import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type {
  ApprovedColorPairing,
  BrandColor,
  CTAEditorFill,
  CTAEditorShape,
  CTAStyleDefinition,
  CTATextDecoration,
  TextTransform,
  TypographyRole,
  TypographyStyle,
} from "../types";
import {
  CTA_EDITOR_FILL_LABELS,
  CTA_EDITOR_FILLS,
  CTA_EDITOR_SHAPES,
  CTA_EDITOR_SHAPE_LABELS,
  CTA_TEXT_DECORATION_LABELS,
  CTA_TEXT_DECORATIONS,
  TEXT_TRANSFORM_OPTIONS,
  defaultCtaStyleName,
  resolveCTASampleText,
} from "../types";
import { BUTTON_TYPOGRAPHY_STYLE_ID, CTA_TEMPLATE_MAP } from "../data/ctaTemplates";
import {
  definitionToCTAStyle,
  ensureContrastingText,
  getEffectivePairings,
  isTextOnlyStyle,
  mapApprovedPairingToCtaColors,
  presetIdFromEditorOptions,
  resolveUserApprovedPairings,
  suggestHoverColors,
  textDecorationFromDefinition,
  TEXT_ONLY_PRESET_ID,
  type ApprovedPairingMapOptions,
  type ResolvedApprovedPairing,
} from "../utils/ctaResolve";
import {
  CTA_PADDING_X_SLIDER,
  CTA_PADDING_Y_SLIDER,
  CTA_RADIUS_SLIDER,
  CTA_SHAPE_RADIUS_PX,
  CTA_STROKE_SLIDER,
  clampCtaPaddingX,
  clampCtaPaddingY,
  isDefaultCtaLetterSpacing,
  parseCtaPaddingPx,
  resolveCtaLetterSpacing,
} from "../utils/ctaCss";
import {
  formatLetterSpacingEm,
  formatRem,
  LETTER_SPACING_SLIDER,
  parseLetterSpacingEm,
  parseRem,
} from "../utils/typographySliders";
import CTAPreview from "./CTAPreview";
import TypographySlider from "./TypographySlider";

type CTAEditorStyleType = "button" | "text-only";

interface CTAStyleModalProps {
  definition?: CTAStyleDefinition;
  colors: BrandColor[];
  typography: TypographyStyle[];
  approvedPairings: ApprovedColorPairing[];
  /** Pairings came from a Studio Code import rather than the contrast check. */
  pairingsAreFavorites?: boolean;
  previewBackground?: string;
  isNew?: boolean;
  /** Used for fallback style names in saved data (e.g. 1 → "Style 1"). */
  fallbackStyleIndex?: number;
  onSave: (definition: CTAStyleDefinition) => void;
  onClose: () => void;
}

const CTA_TEXT_CASE_OPTIONS: { value: TextTransform; label: string; ariaLabel: string }[] =
  TEXT_TRANSFORM_OPTIONS.map((option) => ({
    value: option.value,
    label:
      option.value === "none"
        ? "Normal"
        : option.value === "uppercase"
          ? "Upper"
          : option.value === "lowercase"
            ? "Lower"
            : "Title",
    ariaLabel: option.label,
  }));

const SHAPE_ICON_RADIUS: Record<CTAEditorShape, string> = {
  square: "1px",
  soft: "3px",
  rounded: "5px",
  pill: "999px",
  oval: "50%",
};

const BUTTON_SIZE_SLIDER = { min: 0.7, max: 2.5, step: 0.05 } as const;

function defaultStrokeForFill(fill: CTAEditorFill): number {
  return fill === "solid" ? 0 : 2;
}

function fallbackStyleName(
  _styleType: CTAEditorStyleType,
  fallbackStyleIndex?: number,
): string {
  return defaultCtaStyleName(fallbackStyleIndex ?? 1);
}

function EditorGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="cta-editor__group">
      <h3 className="cta-editor__group-title">{title}</h3>
      <div className="cta-editor__group-body">{children}</div>
    </section>
  );
}

function SegmentToggle<T extends string>({
  label,
  options,
  value,
  onChange,
  ariaLabel,
  segmentClassName = "",
  buttonClassName = "",
}: {
  label: string;
  options: { value: T; label: string; ariaLabel?: string }[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
  segmentClassName?: string;
  buttonClassName?: string;
}) {
  return (
    <div className="cta-editor__field">
      <span className="cta-editor__label">{label}</span>
      <div
        className={`cta-editor__segment ${segmentClassName}`.trim()}
        role="radiogroup"
        aria-label={ariaLabel ?? label}
      >
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            aria-label={option.ariaLabel ?? option.label}
            className={`cta-editor__segment-btn ${buttonClassName} ${value === option.value ? "cta-editor__segment-btn--selected" : ""}`.trim()}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function PaletteDots({
  label,
  ariaLabel,
  paletteColors,
  value,
  onChange,
  onNone,
}: {
  label: string;
  ariaLabel?: string;
  paletteColors: BrandColor[];
  value: string | undefined;
  onChange: (colorId: string) => void;
  /** Adds a leading "None" option, selected when value is undefined. */
  onNone?: () => void;
}) {
  return (
    <div className="cta-editor__field">
      <span className="cta-editor__label">{label}</span>
      <div className="cta-editor__dots" role="radiogroup" aria-label={ariaLabel ?? label}>
        {onNone && (
          <button
            type="button"
            role="radio"
            aria-checked={value === undefined}
            className={`cta-editor__dot ${value === undefined ? "cta-editor__dot--selected" : ""}`}
            onClick={onNone}
            title="None"
            aria-label="None"
          >
            <span className="cta-editor__chip cta-editor__chip--none" />
          </button>
        )}
        {paletteColors.map((color) => (
          <button
            key={color.id}
            type="button"
            role="radio"
            aria-checked={value === color.id}
            className={`cta-editor__dot ${value === color.id ? "cta-editor__dot--selected" : ""}`}
            onClick={() => onChange(color.id)}
            title={color.hex.toUpperCase()}
            aria-label={color.hex.toUpperCase()}
          >
            <span className="cta-editor__chip" style={{ backgroundColor: color.hex }} />
          </button>
        ))}
      </div>
    </div>
  );
}

function PairingChips({
  pairings,
  isSelected,
  onPick,
  ariaLabel,
}: {
  pairings: ResolvedApprovedPairing[];
  isSelected: (resolved: ResolvedApprovedPairing) => boolean;
  onPick: (resolved: ResolvedApprovedPairing) => void;
  ariaLabel: string;
}) {
  return (
    <div className="cta-editor__pairings" role="radiogroup" aria-label={ariaLabel}>
      {pairings.map((resolved) => {
        const pairingLabel = `${resolved.text.hex.toUpperCase()} on ${resolved.background.hex.toUpperCase()}`;
        const selected = isSelected(resolved);
        return (
          <button
            key={`${resolved.pairing.textColorId}|${resolved.pairing.backgroundColorId}`}
            type="button"
            role="radio"
            aria-checked={selected}
            className={`cta-editor__pairing ${selected ? "cta-editor__pairing--selected" : ""}`}
            onClick={() => onPick(resolved)}
            title={pairingLabel}
            aria-label={`Use ${pairingLabel} for ${ariaLabel}`}
          >
            <span
              className="cta-editor__pairing-swatch"
              style={{
                backgroundColor: resolved.background.hex,
                color: resolved.text.hex,
              }}
              aria-hidden="true"
            >
              Aa
            </span>
            <span className="cta-editor__pairing-name">{pairingLabel}</span>
          </button>
        );
      })}
    </div>
  );
}

function ColorStateSection({
  label,
  pairings,
  isPairingSelected,
  onPickPairing,
  pairingAriaLabel,
  children,
}: {
  label: string;
  pairings: ResolvedApprovedPairing[];
  isPairingSelected: (resolved: ResolvedApprovedPairing) => boolean;
  onPickPairing: (resolved: ResolvedApprovedPairing) => void;
  pairingAriaLabel: string;
  children: ReactNode;
}) {
  return (
    <div className="cta-editor__color-state">
      <span className="cta-editor__color-state-label">{label}</span>
      {pairings.length > 0 && (
        <PairingChips
          pairings={pairings}
          isSelected={isPairingSelected}
          onPick={onPickPairing}
          ariaLabel={pairingAriaLabel}
        />
      )}
      <div className="cta-editor__color-swatches">{children}</div>
    </div>
  );
}

function defaultFillColorId(
  definition: CTAStyleDefinition | undefined,
  paletteColors: BrandColor[],
  approvedPairings: ApprovedColorPairing[],
  textOnly: boolean,
): string | undefined {
  if (definition?.initialFillColorId) return definition.initialFillColorId;
  if (textOnly) {
    return (
      paletteColors.find((c) => c.role === "accent")?.id ??
      paletteColors.find((c) => c.role === "hero")?.id ??
      paletteColors[0]?.id
    );
  }
  const pairings = getEffectivePairings(approvedPairings, paletteColors);
  const firstPairing = pairings[0];
  return (
    firstPairing?.backgroundColorId ??
    paletteColors.find((c) => c.role === "hero")?.id ??
    paletteColors[0]?.id
  );
}

function defaultBorderColorId(
  definition: CTAStyleDefinition | undefined,
  paletteColors: BrandColor[],
  fillColorId: string | undefined,
): string | undefined {
  if (definition?.initialBorderColorId) return definition.initialBorderColorId;
  return (
    paletteColors.find((c) => c.role === "hero" && c.id !== fillColorId)?.id ??
    paletteColors.find((c) => c.role === "accent" && c.id !== fillColorId)?.id ??
    paletteColors.find((c) => c.id !== fillColorId)?.id ??
    paletteColors[0]?.id
  );
}

function defaultHoverBorderColorId(
  definition: CTAStyleDefinition | undefined,
  borderColorId: string | undefined,
  hoverFillColorId: string | undefined,
  paletteColors: BrandColor[],
): string | undefined {
  if (definition?.hoverBorderColorId) return definition.hoverBorderColorId;
  return (
    borderColorId ??
    paletteColors.find((c) => c.id !== hoverFillColorId)?.id ??
    paletteColors[0]?.id
  );
}

export default function CTAStyleModal({
  definition,
  colors,
  typography,
  approvedPairings,
  pairingsAreFavorites = false,
  previewBackground,
  isNew = false,
  fallbackStyleIndex,
  onSave,
  onClose,
}: CTAStyleModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  const paletteColors = useMemo(
    () => colors.filter((c) => (c.role as string) !== "semantic"),
    [colors],
  );

  const initialStyleType: CTAEditorStyleType =
    definition && isTextOnlyStyle(definition) ? "text-only" : "button";

  const [id] = useState(
    () =>
      definition?.id ??
      `cta-style-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  );
  const [name, setName] = useState(() => definition?.name?.trim() ?? "");
  const [previewText, setPreviewText] = useState(() =>
    resolveCTASampleText(definition?.sampleText),
  );
  const [styleType, setStyleType] = useState<CTAEditorStyleType>(initialStyleType);
  const [textDecoration, setTextDecoration] = useState<CTATextDecoration>(() =>
    textDecorationFromDefinition(definition ?? {}),
  );
  const [shape, setShape] = useState<CTAEditorShape>(definition?.shape ?? "square");
  const [fill, setFill] = useState<CTAEditorFill>(definition?.fill ?? "solid");
  const [borderRadius, setBorderRadius] = useState<number | undefined>(
    () => definition?.borderRadius,
  );
  const [borderWidth, setBorderWidth] = useState<number | undefined>(
    () => definition?.borderWidth,
  );
  const [paddingX, setPaddingX] = useState<number | undefined>(() => definition?.paddingX);
  const [paddingY, setPaddingY] = useState<number | undefined>(() => definition?.paddingY);
  const [fillColorId, setFillColorId] = useState<string | undefined>(() =>
    defaultFillColorId(definition, paletteColors, approvedPairings, initialStyleType === "text-only"),
  );
  const [borderColorId, setBorderColorId] = useState<string | undefined>(() =>
    defaultBorderColorId(definition, paletteColors, definition?.initialFillColorId),
  );
  const [hoverFillColorId, setHoverFillColorId] = useState<string | undefined>(() => {
    if (definition?.hoverFillColorId) return definition.hoverFillColorId;
    if (!fillColorId) return undefined;
    if (initialStyleType === "text-only") {
      const accent =
        paletteColors.find((c) => c.role === "hero" && c.id !== fillColorId)?.id ??
        paletteColors.find((c) => c.id !== fillColorId)?.id;
      return accent;
    }
    const text = ensureContrastingText(fillColorId, undefined, approvedPairings, paletteColors);
    return suggestHoverColors(fillColorId, text, approvedPairings, paletteColors).hoverFillColorId;
  });
  const [textColorId, setTextColorId] = useState<string | undefined>(() => {
    if (definition?.textColorId) return definition.textColorId;
    if (!fillColorId) return undefined;
    if (initialStyleType === "text-only") return fillColorId;
    const initialFill = definition?.fill ?? "solid";
    if (initialFill === "outline") return fillColorId;
    return ensureContrastingText(fillColorId, undefined, approvedPairings, paletteColors);
  });
  const [hoverTextColorId, setHoverTextColorId] = useState<string | undefined>(() => {
    if (definition?.hoverTextColorId) return definition.hoverTextColorId;
    if (!hoverFillColorId) return undefined;
    if (initialStyleType === "text-only") return hoverFillColorId;
    return ensureContrastingText(hoverFillColorId, undefined, approvedPairings, paletteColors);
  });
  const [hoverBorderColorId, setHoverBorderColorId] = useState<string | undefined>(() =>
    defaultHoverBorderColorId(
      definition,
      definition?.initialBorderColorId ?? borderColorId,
      definition?.hoverFillColorId,
      paletteColors,
    ),
  );
  const [typographyStyleId, setTypographyStyleId] = useState<TypographyRole>(
    () => definition?.typographyStyleId ?? BUTTON_TYPOGRAPHY_STYLE_ID,
  );
  const [roleFontSize, setRoleFontSize] = useState<string | undefined>(() => definition?.fontSize);
  const [textTransform, setTextTransform] = useState<TextTransform>(
    () => definition?.textTransform ?? "uppercase",
  );
  const [letterSpacing, setLetterSpacing] = useState(() => {
    if (definition?.letterSpacing != null && definition.letterSpacing !== "") {
      return definition.letterSpacing;
    }
    // New styles start at 0. Existing omitted buttons keep the 0.08em pin.
    if (isNew) return "0";
    return resolveCtaLetterSpacing(
      undefined,
      initialStyleType === "text-only" ? "link" : "button",
    );
  });

  const typographyOptions = useMemo(
    () =>
      typography.map((style, index) => ({
        value: style.id,
        label: style.fontFamily,
        ariaLabel: `Font ${index + 1}: ${style.fontFamily}`,
      })),
    [typography],
  );

  const resolvedTypographyStyleId = useMemo((): TypographyRole => {
    if (typographyOptions.some((option) => option.value === typographyStyleId)) {
      return typographyStyleId;
    }
    return typographyOptions[0]?.value ?? BUTTON_TYPOGRAPHY_STYLE_ID;
  }, [typographyOptions, typographyStyleId]);

  const roleFontSizeDefault =
    typography.find((style) => style.id === resolvedTypographyStyleId)?.fontSize ?? "1.00rem";

  const shapeRadiusDefault = CTA_SHAPE_RADIUS_PX[shape];
  const radiusSliderValue = borderRadius ?? shapeRadiusDefault ?? 0;
  const strokeSliderValue = borderWidth ?? defaultStrokeForFill(fill);
  const templatePadding = useMemo(() => {
    const presetId = presetIdFromEditorOptions("button", shape, fill, "underline");
    const template = CTA_TEMPLATE_MAP.get(presetId);
    return {
      x: parseCtaPaddingPx(template?.paddingX) || 20,
      y: parseCtaPaddingPx(template?.paddingY) || 10,
    };
  }, [shape, fill]);
  const paddingXSliderValue = clampCtaPaddingX(paddingX ?? templatePadding.x);
  const paddingYSliderValue = clampCtaPaddingY(paddingY ?? templatePadding.y);
  const showRadiusSlider = styleType === "button" && shapeRadiusDefault !== null;
  const showStrokeSlider = styleType === "button";
  const showBorderColorPickers =
    styleType === "button" &&
    strokeSliderValue > 0 &&
    (fill === "solid-outline" || fill === "solid");
  const showPairingChips = styleType === "button" && fill !== "outline";
  const userApprovedPairings = useMemo(
    () => resolveUserApprovedPairings(approvedPairings, paletteColors),
    [approvedPairings, paletteColors],
  );

  const hoverTouchedRef = useRef(Boolean(definition?.hoverFillColorId));
  const hoverTextTouchedRef = useRef(Boolean(definition?.hoverTextColorId));
  const hoverBorderTouchedRef = useRef(Boolean(definition?.hoverBorderColorId));
  const [hoverBackgroundColorId, setHoverBackgroundColorId] = useState<string | undefined>(
    definition?.hoverBackgroundColorId,
  );
  const textTouchedRef = useRef(Boolean(definition?.textColorId));
  const borderTouchedRef = useRef(Boolean(definition?.initialBorderColorId));
  const [advancedOpen, setAdvancedOpen] = useState(true);
  const commitRef = useRef<() => void>(() => {});
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") commitRef.current();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    const trapFocus = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", trapFocus);
    return () => document.removeEventListener("keydown", trapFocus);
  }, []);

  const pairingMapOptions = useMemo(
    (): ApprovedPairingMapOptions => ({
      styleType,
      fill,
      needsBorder: showBorderColorPickers,
    }),
    [styleType, fill, showBorderColorPickers],
  );

  const pickTextOnlyColor = (colorId: string) => {
    setFillColorId(colorId);
    setTextColorId(colorId);
    textTouchedRef.current = true;
  };

  const pickTextOnlyHoverColor = (colorId: string) => {
    hoverTouchedRef.current = true;
    setHoverFillColorId(colorId);
    setHoverTextColorId(colorId);
    hoverTextTouchedRef.current = true;
  };

  const pickFillColor = (colorId: string) => {
    if (styleType === "text-only") {
      pickTextOnlyColor(colorId);
      return;
    }
    setFillColorId(colorId);
    if (!textTouchedRef.current) {
      setTextColorId(
        fill === "outline"
          ? colorId
          : ensureContrastingText(colorId, undefined, approvedPairings, paletteColors),
      );
    }
    if (!hoverTouchedRef.current) {
      const text = ensureContrastingText(colorId, undefined, approvedPairings, paletteColors);
      const suggested = suggestHoverColors(colorId, text, approvedPairings, paletteColors);
      setHoverFillColorId(suggested.hoverFillColorId);
      if (!hoverTextTouchedRef.current) {
        setHoverTextColorId(
          fill === "outline" ? suggested.hoverFillColorId : suggested.hoverTextColorId,
        );
      }
    }
  };

  const pickHoverColor = (colorId: string) => {
    if (styleType === "text-only") {
      pickTextOnlyHoverColor(colorId);
      return;
    }
    hoverTouchedRef.current = true;
    setHoverFillColorId(colorId);
    if (!hoverTextTouchedRef.current) {
      setHoverTextColorId(
        fill === "outline"
          ? colorId
          : ensureContrastingText(colorId, undefined, approvedPairings, paletteColors),
      );
    }
  };

  const pickTextColor = (colorId: string) => {
    textTouchedRef.current = true;
    setTextColorId(colorId);
  };

  const pickHoverTextColor = (colorId: string) => {
    hoverTextTouchedRef.current = true;
    setHoverTextColorId(colorId);
  };

  const pickBorderColor = (colorId: string) => {
    borderTouchedRef.current = true;
    setBorderColorId(colorId);
  };

  const pickHoverBorderColor = (colorId: string) => {
    hoverBorderTouchedRef.current = true;
    setHoverBorderColorId(colorId);
  };

  const pickHoverBackgroundColor = (colorId: string | undefined) => {
    setHoverBackgroundColorId(colorId);
    if (!hoverTextTouchedRef.current) {
      setHoverTextColorId(
        colorId
          ? ensureContrastingText(colorId, hoverTextColorId, approvedPairings, paletteColors)
          : hoverFillColorId,
      );
    }
  };

  const applyApprovedPairingToState = (
    resolved: ResolvedApprovedPairing,
    state: "initial" | "hover",
  ) => {
    const mapped = mapApprovedPairingToCtaColors(resolved.pairing, pairingMapOptions);

    if (styleType === "text-only") {
      if (state === "initial") {
        setFillColorId(mapped.fillColorId);
        setTextColorId(mapped.textColorId);
        textTouchedRef.current = true;
      } else {
        setHoverFillColorId(mapped.fillColorId);
        setHoverTextColorId(mapped.textColorId);
        hoverTouchedRef.current = true;
        hoverTextTouchedRef.current = true;
      }
      return;
    }

    if (state === "initial") {
      setFillColorId(mapped.fillColorId);
      setTextColorId(mapped.textColorId);
      textTouchedRef.current = true;
      if (mapped.borderColorId && showBorderColorPickers) {
        setBorderColorId(mapped.borderColorId);
        borderTouchedRef.current = true;
      }
      return;
    }

    setHoverFillColorId(mapped.fillColorId);
    setHoverTextColorId(mapped.textColorId);
    hoverTouchedRef.current = true;
    hoverTextTouchedRef.current = true;
    if (showBorderColorPickers) {
      setHoverBorderColorId(mapped.borderColorId ?? mapped.textColorId);
      hoverBorderTouchedRef.current = true;
    }
  };

  const pairingColorsMatch = (
    mapped: { fillColorId: string; textColorId: string; borderColorId?: string },
    fillId: string | undefined,
    textId: string | undefined,
    borderId: string | undefined,
  ): boolean => {
    if (mapped.fillColorId !== fillId || mapped.textColorId !== textId) return false;
    if (mapped.borderColorId && showBorderColorPickers) {
      return mapped.borderColorId === borderId;
    }
    return true;
  };

  const isApprovedPairingSelected = (resolved: ResolvedApprovedPairing): boolean => {
    const mapped = mapApprovedPairingToCtaColors(resolved.pairing, pairingMapOptions);
    return pairingColorsMatch(mapped, fillColorId, textColorId, borderColorId);
  };

  const isApprovedPairingHover = (resolved: ResolvedApprovedPairing): boolean => {
    const mapped = mapApprovedPairingToCtaColors(resolved.pairing, pairingMapOptions);
    return pairingColorsMatch(mapped, hoverFillColorId, hoverTextColorId, hoverBorderColorId);
  };

  const ensureStrokeColors = () => {
    if (!borderColorId) {
      setBorderColorId(defaultBorderColorId(undefined, paletteColors, fillColorId));
    }
    if (!hoverBorderColorId) {
      setHoverBorderColorId(
        defaultHoverBorderColorId(undefined, borderColorId, hoverFillColorId, paletteColors),
      );
    }
  };

  const switchFill = (next: CTAEditorFill) => {
    setFill(next);
    setBorderWidth(undefined);
    if (!textTouchedRef.current && fillColorId) {
      setTextColorId(
        next === "outline"
          ? fillColorId
          : ensureContrastingText(fillColorId, undefined, approvedPairings, paletteColors),
      );
    }
    if (!hoverTextTouchedRef.current && hoverFillColorId) {
      setHoverTextColorId(
        next === "outline"
          ? hoverFillColorId
          : ensureContrastingText(hoverFillColorId, undefined, approvedPairings, paletteColors),
      );
    }
    if (next === "solid-outline") {
      ensureStrokeColors();
    }
  };

  const switchShape = (next: CTAEditorShape) => {
    setShape(next);
    setBorderRadius(undefined);
  };

  const switchStroke = (value: number) => {
    setBorderWidth(value);
    if (fill === "solid" && value > 0) {
      ensureStrokeColors();
    }
  };

  const switchStyleType = (next: CTAEditorStyleType) => {
    setStyleType(next);
    if (next === "text-only" && fillColorId) {
      // Text-only renders from textColorId; keep it in sync with the text color picker.
      setTextColorId(fillColorId);
      textTouchedRef.current = false;

      let nextHover = hoverFillColorId;
      if (!nextHover) {
        nextHover =
          paletteColors.find((c) => c.role === "hero" && c.id !== fillColorId)?.id ??
          paletteColors.find((c) => c.id !== fillColorId)?.id;
        if (nextHover) setHoverFillColorId(nextHover);
      }
      if (nextHover) {
        setHoverTextColorId(nextHover);
        hoverTextTouchedRef.current = false;
      }
    } else if (next === "button" && fillColorId) {
      textTouchedRef.current = false;
      hoverTextTouchedRef.current = false;
      hoverTouchedRef.current = false;

      setTextColorId(
        fill === "outline"
          ? fillColorId
          : ensureContrastingText(fillColorId, undefined, approvedPairings, paletteColors),
      );
      const text = ensureContrastingText(fillColorId, undefined, approvedPairings, paletteColors);
      const suggested = suggestHoverColors(fillColorId, text, approvedPairings, paletteColors);
      setHoverFillColorId(suggested.hoverFillColorId);
      setHoverTextColorId(suggested.hoverTextColorId);
    }
  };

  const resolvedDefinition = useMemo((): CTAStyleDefinition | null => {
    if (!fillColorId || !hoverFillColorId || !textColorId || !hoverTextColorId) return null;
    if (styleType === "button" && showBorderColorPickers && (!borderColorId || !hoverBorderColorId)) {
      return null;
    }

    const resolvedName = name.trim() || fallbackStyleName(styleType, fallbackStyleIndex);
    const sharedType = {
      typographyStyleId: resolvedTypographyStyleId,
      typographySource: "role" as const,
      letterSpacing,
      ...(roleFontSize ? { fontSize: roleFontSize } : {}),
    };

    if (styleType === "text-only") {
      return {
        id,
        name: resolvedName,
        kind: "link",
        presetId: TEXT_ONLY_PRESET_ID,
        initialFillColorId: fillColorId,
        hoverFillColorId,
        textColorId,
        hoverTextColorId,
        sampleText: resolveCTASampleText(previewText),
        textDecoration,
        ...sharedType,
      };
    }

    return {
      id,
      name: resolvedName,
      kind: "button",
      presetId: presetIdFromEditorOptions("button", shape, fill, "underline"),
      shape,
      fill,
      alignment: definition?.alignment ?? "center",
      initialFillColorId: fillColorId,
      textColorId,
      hoverFillColorId,
      hoverTextColorId,
      ...(showBorderColorPickers
        ? {
            initialBorderColorId: borderColorId,
            hoverBorderColorId,
          }
        : {}),
      ...(fill === "outline" && hoverBackgroundColorId ? { hoverBackgroundColorId } : {}),
      ...(typeof borderRadius === "number" ? { borderRadius } : {}),
      borderWidth: strokeSliderValue,
      ...(typeof paddingX === "number" ? { paddingX } : {}),
      ...(typeof paddingY === "number" ? { paddingY } : {}),
      textTransform,
      sampleText: resolveCTASampleText(previewText),
      ...sharedType,
    };
  }, [
    id,
    name,
    definition,
    fallbackStyleIndex,
    styleType,
    textDecoration,
    shape,
    fill,
    borderRadius,
    borderWidth,
    strokeSliderValue,
    paddingX,
    paddingY,
    fillColorId,
    borderColorId,
    hoverBorderColorId,
    hoverBackgroundColorId,
    hoverFillColorId,
    textColorId,
    hoverTextColorId,
    resolvedTypographyStyleId,
    roleFontSize,
    textTransform,
    letterSpacing,
    previewText,
    showBorderColorPickers,
  ]);

  const previewCta = resolvedDefinition
    ? definitionToCTAStyle(resolvedDefinition, colors, typography, approvedPairings)
    : null;

  const commit = () => {
    if (!resolvedDefinition) {
      onClose();
      return;
    }
    if (styleType !== "button") {
      const { letterSpacing: _omit, ...rest } = resolvedDefinition;
      onSave(
        definition?.letterSpacing !== undefined
          ? { ...rest, letterSpacing: definition.letterSpacing }
          : rest,
      );
      return;
    }
    // Persist explicit 0 so it does not fall back to the legacy 0.08em pin.
    onSave(resolvedDefinition);
  };
  commitRef.current = commit;

  const modalTitle =
    styleType === "text-only"
      ? isNew
        ? "New text link"
        : "Edit text link"
      : isNew
        ? "New button"
        : "Edit button";

  const fillColorLabel =
    styleType === "text-only"
      ? "Text color"
      : fill === "outline"
        ? "Border color"
        : "Fill";
  const labelPlaceholder =
    styleType === "text-only" ? "e.g. Footer link" : "e.g. Main CTA";

  return (
    <div
      className="type-modal-backdrop"
      role="presentation"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) commit();
      }}
    >
      <div
        ref={dialogRef}
        className="type-modal cta-editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cta-editor-title"
        tabIndex={-1}
      >
        <header className="type-modal__header">
          <h2 id="cta-editor-title" className="type-modal__title">
            {modalTitle}
          </h2>
          <button type="button" className="type-modal__close" onClick={commit} aria-label="Close">
            ×
          </button>
        </header>

        <div className="cta-editor__body">
          <aside
            className="cta-editor__preview"
            aria-label="Button preview"
            style={previewBackground ? { backgroundColor: previewBackground } : undefined}
          >
            <div className="cta-editor__preview-inner">
              {previewCta ? (
                <>
                  <div className="cta-editor__preview-state">
                    <span className="cta-editor__preview-label">Initial</span>
                    <CTAPreview
                      cta={previewCta}
                      colors={colors}
                      typography={typography}
                      state="default"
                      className={styleType === "text-only" ? "cta-preview__element--text-only" : ""}
                    />
                  </div>
                  <div className="cta-editor__preview-state">
                    <span className="cta-editor__preview-label">Hover</span>
                    <CTAPreview
                      cta={previewCta}
                      colors={colors}
                      typography={typography}
                      state="hover"
                      className={styleType === "text-only" ? "cta-preview__element--text-only" : ""}
                    />
                  </div>
                </>
              ) : (
                <p className="cta-editor__preview-fallback">Add colors in the Brand colors step first.</p>
              )}
            </div>
            {name.trim() ? (
              <p className="cta-editor__preview-caption">{name.trim()}</p>
            ) : null}
          </aside>

          <div className="cta-editor__controls">
            <div className="cta-editor__identity">
              <div className="cta-editor__field cta-editor__field--stack">
                <label className="cta-editor__label" htmlFor="cta-editor-name">
                  Label
                </label>
                <input
                  id="cta-editor-name"
                  type="text"
                  className="cta-editor__name-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={labelPlaceholder}
                  maxLength={48}
                />
              </div>
              <div className="cta-editor__field cta-editor__field--stack">
                <label className="cta-editor__label" htmlFor="cta-editor-preview-text">
                  Button preview text
                </label>
                <input
                  id="cta-editor-preview-text"
                  type="text"
                  className="cta-editor__name-input"
                  value={previewText}
                  onChange={(e) => setPreviewText(e.target.value)}
                  placeholder="Work with us"
                  maxLength={48}
                />
              </div>
            </div>

            <div className="cta-editor__essentials">
              <div className="cta-editor__essentials-options">
                <SegmentToggle
                  label="Style type"
                  options={[
                    { value: "button", label: "Button" },
                    { value: "text-only", label: "Text only" },
                  ]}
                  value={styleType}
                  onChange={switchStyleType}
                />

                {styleType === "text-only" && (
                  <SegmentToggle
                    label="Style"
                    options={CTA_TEXT_DECORATIONS.map((value) => ({
                      value,
                      label: CTA_TEXT_DECORATION_LABELS[value],
                    }))}
                    value={textDecoration}
                    onChange={setTextDecoration}
                  />
                )}

                {styleType === "button" && (
                  <SegmentToggle
                    label="Fill"
                    options={CTA_EDITOR_FILLS.map((value) => ({
                      value,
                      label: CTA_EDITOR_FILL_LABELS[value],
                    }))}
                    value={fill}
                    onChange={switchFill}
                  />
                )}

                {styleType === "button" && (
                  <div className="cta-editor__field cta-editor__field--shape">
                    <span className="cta-editor__label">Shape</span>
                    <div className="cta-editor__shapes" role="radiogroup" aria-label="Shape">
                      {CTA_EDITOR_SHAPES.map((option) => (
                        <button
                          key={option}
                          type="button"
                          role="radio"
                          aria-checked={shape === option}
                          className={`cta-editor__shape ${shape === option ? "cta-editor__shape--selected" : ""}`}
                          onClick={() => switchShape(option)}
                          title={CTA_EDITOR_SHAPE_LABELS[option]}
                          aria-label={CTA_EDITOR_SHAPE_LABELS[option]}
                        >
                          <span
                            className="cta-editor__shape-icon"
                            style={{ borderRadius: SHAPE_ICON_RADIUS[option] }}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <EditorGroup title="Colors">
              {!showPairingChips ? (
                <p className="cta-editor__hint">
                  {styleType === "text-only" ? "Text links" : "Outline buttons"} have no fill, so
                  they sit right on your page background. Pick colors that stand out against it.
                  {styleType === "button" && " You can still add a fill on hover."}
                </p>
              ) : userApprovedPairings.length === 0 ? (
                <p className="cta-editor__hint">
                  None of your colors have enough contrast together for readable text. Add a very
                  light or very dark color in Brand colors.
                </p>
              ) : pairingsAreFavorites ? (
                <p className="cta-editor__hint">
                  <strong>Favorite pairings</strong> from your Studio Code. Pick one to set the
                  fill and text color together.
                </p>
              ) : (
                <p className="cta-editor__hint">
                  <strong>Recommended pairings</strong> have a contrast ratio of 4.5:1 or higher
                  (WCAG AA), so the text stays easy to read. Pick one to set the fill and text color
                  together.
                </p>
              )}
              <ColorStateSection
                label="Initial"
                pairings={showPairingChips ? userApprovedPairings : []}
                isPairingSelected={isApprovedPairingSelected}
                onPickPairing={(resolved) => applyApprovedPairingToState(resolved, "initial")}
                pairingAriaLabel="Initial pairing"
              >
                <PaletteDots
                  label={fillColorLabel}
                  ariaLabel={`Initial ${fillColorLabel.toLowerCase()}`}
                  paletteColors={paletteColors}
                  value={styleType === "text-only" ? textColorId : fillColorId}
                  onChange={styleType === "text-only" ? pickTextOnlyColor : pickFillColor}
                />
                {styleType === "button" && (
                  <PaletteDots
                    label="Text color"
                    ariaLabel="Initial text color"
                    paletteColors={paletteColors}
                    value={textColorId}
                    onChange={pickTextColor}
                  />
                )}
                {showBorderColorPickers && (
                  <PaletteDots
                    label="Border color"
                    ariaLabel="Initial border color"
                    paletteColors={paletteColors}
                    value={borderColorId}
                    onChange={pickBorderColor}
                  />
                )}
              </ColorStateSection>
              <ColorStateSection
                label="Hover"
                pairings={showPairingChips ? userApprovedPairings : []}
                isPairingSelected={isApprovedPairingHover}
                onPickPairing={(resolved) => applyApprovedPairingToState(resolved, "hover")}
                pairingAriaLabel="Hover pairing"
              >
                <PaletteDots
                  label={fillColorLabel}
                  ariaLabel={`Hover ${fillColorLabel.toLowerCase()}`}
                  paletteColors={paletteColors}
                  value={styleType === "text-only" ? hoverTextColorId : hoverFillColorId}
                  onChange={styleType === "text-only" ? pickTextOnlyHoverColor : pickHoverColor}
                />
                {styleType === "button" && fill === "outline" && (
                  <PaletteDots
                    label="Fill"
                    ariaLabel="Hover fill"
                    paletteColors={paletteColors}
                    value={hoverBackgroundColorId}
                    onChange={pickHoverBackgroundColor}
                    onNone={() => pickHoverBackgroundColor(undefined)}
                  />
                )}
                {styleType === "button" && (
                  <PaletteDots
                    label="Text color"
                    ariaLabel="Hover text color"
                    paletteColors={paletteColors}
                    value={hoverTextColorId}
                    onChange={pickHoverTextColor}
                  />
                )}
                {showBorderColorPickers && (
                  <PaletteDots
                    label="Border color"
                    ariaLabel="Hover border color"
                    paletteColors={paletteColors}
                    value={hoverBorderColorId}
                    onChange={pickHoverBorderColor}
                  />
                )}
              </ColorStateSection>
            </EditorGroup>

            <details
              className="cta-editor__advanced"
              open={advancedOpen}
              onToggle={(event) => setAdvancedOpen(event.currentTarget.open)}
            >
              <summary className="cta-editor__advanced-summary">Type, shape & spacing</summary>
              <div className="cta-editor__advanced-body">
                <EditorGroup title="Type">
                  {typographyOptions.length > 0 && (
                    <div className="cta-editor__custom-type-row">
                      <SegmentToggle
                        label="Font"
                        options={typographyOptions}
                        value={resolvedTypographyStyleId}
                        onChange={setTypographyStyleId}
                        ariaLabel="Button text typography"
                        segmentClassName="cta-editor__segment--typography"
                        buttonClassName="cta-editor__segment-btn--compact"
                      />
                      <div className="cta-editor__slider">
                        <TypographySlider
                          id="cta-editor-role-font-size"
                          label="Size"
                          value={parseRem(roleFontSize ?? roleFontSizeDefault)}
                          min={BUTTON_SIZE_SLIDER.min}
                          max={BUTTON_SIZE_SLIDER.max}
                          step={BUTTON_SIZE_SLIDER.step}
                          display={`${roleFontSize ?? roleFontSizeDefault} · ${Math.round(parseRem(roleFontSize ?? roleFontSizeDefault) * 16)}px`}
                          onChange={(value) => setRoleFontSize(formatRem(value))}
                        />
                      </div>
                    </div>
                  )}

                  {styleType === "button" && (
                    <div className="cta-editor__custom-type-row">
                      <SegmentToggle
                        label="Text case"
                        options={CTA_TEXT_CASE_OPTIONS}
                        value={textTransform}
                        onChange={setTextTransform}
                        ariaLabel="Button text case"
                        segmentClassName="cta-editor__segment--typography"
                        buttonClassName="cta-editor__segment-btn--compact"
                      />
                      <div className="cta-editor__slider">
                        <TypographySlider
                          id="cta-editor-letter-spacing"
                          label="Letter spacing"
                          value={parseLetterSpacingEm(letterSpacing)}
                          min={LETTER_SPACING_SLIDER.min}
                          max={LETTER_SPACING_SLIDER.max}
                          step={LETTER_SPACING_SLIDER.step}
                          display={
                            isDefaultCtaLetterSpacing(letterSpacing)
                              ? "0"
                              : letterSpacing
                          }
                          onChange={(value) =>
                            setLetterSpacing(
                              isDefaultCtaLetterSpacing(value)
                                ? "0"
                                : formatLetterSpacingEm(value),
                            )
                          }
                        />
                      </div>
                    </div>
                  )}
                </EditorGroup>

                {styleType === "button" && (
                  <EditorGroup title="Shape & spacing">
                    <div className="cta-editor__sliders">
                      <div className="cta-editor__slider">
                        {showRadiusSlider ? (
                          <TypographySlider
                            id="cta-editor-radius"
                            label="Radius"
                            value={radiusSliderValue}
                            min={CTA_RADIUS_SLIDER.min}
                            max={CTA_RADIUS_SLIDER.max}
                            step={CTA_RADIUS_SLIDER.step}
                            display={`${radiusSliderValue}px`}
                            onChange={setBorderRadius}
                          />
                        ) : (
                          <div className="cta-editor__slider-note">
                            <span className="cta-editor__label">Radius</span>
                            <p>Fully rounded for this shape.</p>
                          </div>
                        )}
                      </div>
                      {showStrokeSlider && (
                        <div className="cta-editor__slider">
                          <TypographySlider
                            id="cta-editor-stroke"
                            label="Border"
                            value={strokeSliderValue}
                            min={CTA_STROKE_SLIDER.min}
                            max={CTA_STROKE_SLIDER.max}
                            step={CTA_STROKE_SLIDER.step}
                            display={`${strokeSliderValue}px`}
                            onChange={switchStroke}
                          />
                        </div>
                      )}
                      <div className="cta-editor__slider">
                        <TypographySlider
                          id="cta-editor-padding-x"
                          label="Horizontal padding"
                          value={paddingXSliderValue}
                          min={CTA_PADDING_X_SLIDER.min}
                          max={CTA_PADDING_X_SLIDER.max}
                          step={CTA_PADDING_X_SLIDER.step}
                          display={`${paddingXSliderValue}px`}
                          onChange={setPaddingX}
                        />
                      </div>
                      <div className="cta-editor__slider">
                        <TypographySlider
                          id="cta-editor-padding-y"
                          label="Vertical padding"
                          value={paddingYSliderValue}
                          min={CTA_PADDING_Y_SLIDER.min}
                          max={CTA_PADDING_Y_SLIDER.max}
                          step={CTA_PADDING_Y_SLIDER.step}
                          display={`${paddingYSliderValue}px`}
                          onChange={setPaddingY}
                        />
                      </div>
                    </div>
                  </EditorGroup>
                )}
              </div>
            </details>
          </div>
        </div>

        <footer className="type-modal__footer cta-editor__footer">
          <button type="button" className="cta-editor__cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="cta-editor__save"
            onClick={commit}
            disabled={!resolvedDefinition}
          >
            {isNew ? "Add style" : "Done"}
          </button>
        </footer>
      </div>
    </div>
  );
}
