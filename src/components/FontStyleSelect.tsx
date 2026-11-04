import { useEffect, useState } from "react";
import type { FontSource } from "../types";
import {
  currentVariantKey,
  fetchFontVariants,
  formatFontVariantLabel,
  parseFontVariantSelection,
  snapToVariantList,
} from "../utils/fontVariants";

interface FontStyleSelectProps {
  id: string;
  family: string;
  source?: FontSource;
  fontWeight: number;
  fontStyle: "normal" | "italic";
  localFontStyle?: string;
  onChange: (
    fontWeight: number,
    fontStyle: "normal" | "italic",
    localFontStyle?: string,
  ) => void;
}

export default function FontStyleSelect({
  id,
  family,
  source = "google",
  fontWeight,
  fontStyle,
  localFontStyle,
  onChange,
}: FontStyleSelectProps) {
  const [variants, setVariants] = useState<string[]>([]);
  const current = currentVariantKey(source, fontWeight, fontStyle, localFontStyle);

  useEffect(() => {
    let cancelled = false;
    setVariants([]);
    fetchFontVariants(family, source).then((result) => {
      if (!cancelled) setVariants(result);
    });
    return () => {
      cancelled = true;
    };
  }, [family, source]);

  // Keep stored weight/style aligned with what the dropdown shows when the font
  // does not include the current variant (e.g. accent defaults to italic).
  useEffect(() => {
    if (variants.length === 0 || variants.includes(current)) return;
    const snapped = snapToVariantList(variants, fontWeight, fontStyle, localFontStyle);
    if (
      snapped.fontWeight !== fontWeight ||
      snapped.fontStyle !== fontStyle ||
      (snapped.localFontStyle ?? undefined) !== (localFontStyle ?? undefined)
    ) {
      onChange(snapped.fontWeight, snapped.fontStyle, snapped.localFontStyle);
    }
  }, [variants, current, fontWeight, fontStyle, localFontStyle, onChange]);

  // While loading, show only the current style rather than a made-up list.
  const options = variants.length > 0 ? variants : [current];

  const value = options.includes(current) ? current : options[0];

  return (
    <div className="field">
      <label htmlFor={id}>Style</label>
      <select
        id={id}
        value={value}
        onChange={(e) => {
          const parsed = parseFontVariantSelection(e.target.value);
          onChange(parsed.fontWeight, parsed.fontStyle, parsed.localFontStyle);
        }}
      >
        {options.map((variant) => (
          <option key={variant} value={variant}>
            {formatFontVariantLabel(variant)}
          </option>
        ))}
      </select>
    </div>
  );
}
