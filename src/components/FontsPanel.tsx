import { useEffect } from "react";
import type { FontSource, TypographyStyle } from "../types";
import { MAX_BRAND_FONTS, createDefaultTypography, newBrandFontId } from "../types";
import {
  ensureGoogleFontVariants,
  ensureLocalFontFace,
  isLocalFontApiSupported,
  resolveCssFontFamily,
} from "../utils/fontUtils";
import FontPicker from "./FontPicker";
import FontStyleSelect from "./FontStyleSelect";
import LocalFontMissingNotice from "./LocalFontMissingNotice";

interface FontsPanelProps {
  typography: TypographyStyle[];
  onTypographyChange: (typography: TypographyStyle[]) => void;
  onContinue: () => void;
  onBack: () => void;
}

const SUGGESTED_FAMILIES = ["Instrument Serif", "Space Grotesk", "Caveat", "Inter", "Playfair Display"];

function FontCard({
  index,
  style,
  onChange,
  onRemove,
}: {
  index: number;
  style: TypographyStyle;
  onChange: (updates: Partial<TypographyStyle>) => void;
  onRemove?: () => void;
}) {
  const source = style.fontSource ?? "google";

  useEffect(() => {
    if (source === "google") {
      ensureGoogleFontVariants(style.fontFamily, [
        { fontWeight: style.fontWeight, fontStyle: style.fontStyle },
      ]);
    } else if (style.localFontStyle) {
      void ensureLocalFontFace(style.fontFamily, style.localFontStyle);
    }
  }, [source, style.fontFamily, style.fontWeight, style.fontStyle, style.localFontStyle]);

  const specimenStyle = {
    fontFamily: resolveCssFontFamily(style.fontFamily, source, style.localFontStyle),
    fontWeight: style.fontWeight,
    fontStyle: style.fontStyle,
  };

  return (
    <li className="brand-font">
      <div className="brand-font__specimen" style={specimenStyle} aria-hidden="true">
        Aa
      </div>

      <div className="brand-font__main">
        <div className="brand-font__head">
          <h2 className="brand-font__label">Brand Font {index + 1}</h2>
          {onRemove ? (
            <button
              type="button"
              className="brand-font__remove"
              onClick={onRemove}
              aria-label={`Remove Brand Font ${index + 1}`}
              title="Remove font"
            >
              ×
            </button>
          ) : null}
        </div>

        <div className="brand-font__controls">
          <div className="field">
            <label>Font</label>
            <FontPicker
              value={style.fontFamily}
              source={source}
              suggestFor="body"
              onChange={(family: string, nextSource: FontSource) =>
                onChange({
                  fontFamily: family,
                  label: family,
                  fontSource: nextSource,
                  localFontStyle: undefined,
                })
              }
            />
          </div>
          <FontStyleSelect
            id={`font-style-${style.id}`}
            family={style.fontFamily}
            source={source}
            fontWeight={style.fontWeight}
            fontStyle={style.fontStyle}
            localFontStyle={style.localFontStyle}
            onChange={(fontWeight, fontStyle, localFontStyle) =>
              onChange({ fontWeight, fontStyle, localFontStyle })
            }
          />
        </div>

        <LocalFontMissingNotice family={style.fontFamily} source={source} />
      </div>
    </li>
  );
}

export default function FontsPanel({
  typography,
  onTypographyChange,
  onContinue,
  onBack,
}: FontsPanelProps) {
  const update = (id: string, updates: Partial<TypographyStyle>) => {
    onTypographyChange(typography.map((t) => (t.id === id ? { ...t, ...updates } : t)));
  };

  const addFont = () => {
    if (typography.length >= MAX_BRAND_FONTS) return;
    const used = new Set(typography.map((t) => t.fontFamily));
    const family = SUGGESTED_FAMILIES.find((f) => !used.has(f)) ?? "DM Sans";
    onTypographyChange([...typography, createDefaultTypography(newBrandFontId(), family)]);
  };

  const removeFont = (id: string) => {
    onTypographyChange(typography.filter((t) => t.id !== id));
  };

  return (
    <div className="step">
      <header className="step__header">
        <p className="step__eyebrow">Step 2</p>
        <h1 className="step__title">Brand fonts</h1>
        <p className="step__lede">
          Add the fonts your buttons use. Pick from 1,800+ Google Fonts, or choose{" "}
          <strong>Your fonts</strong> in the picker to use fonts installed on your computer.
        </p>
        {!isLocalFontApiSupported() && (
          <p className="step__note">
            Heads up: using your own installed fonts requires Google Chrome or Edge. Google Fonts
            work in every browser.
          </p>
        )}
      </header>

      <ul className="brand-fonts">
        {typography.map((style, index) => (
          <FontCard
            key={style.id}
            index={index}
            style={style}
            onChange={(updates) => update(style.id, updates)}
            onRemove={typography.length > 1 ? () => removeFont(style.id) : undefined}
          />
        ))}
        {typography.length < MAX_BRAND_FONTS && (
          <li>
            <button type="button" className="brand-fonts__add" onClick={addFont}>
              + Add brand font
            </button>
          </li>
        )}
      </ul>

      <footer className="step__footer">
        <button type="button" className="btn-ghost" onClick={onBack}>
          ← Back
        </button>
        <button type="button" className="btn-primary" onClick={onContinue}>
          Next: Buttons →
        </button>
      </footer>
    </div>
  );
}
