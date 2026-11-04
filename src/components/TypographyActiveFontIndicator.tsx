import { useEffect } from "react";
import type { FontSource } from "../types";
import { ensureLocalFontFace, loadGoogleFont, resolveCssFontFamily } from "../utils/fontUtils";
import { formatTypographyVariantLabel } from "../utils/fontVariants";
import LocalFontMissingNotice from "./LocalFontMissingNotice";

export interface TypographyActiveFontIndicatorProps {
  roleLabel?: string;
  family: string;
  source?: FontSource;
  fontWeight?: number;
  fontStyle?: "normal" | "italic";
  localFontStyle?: string;
}

export default function TypographyActiveFontIndicator({
  roleLabel = "Current font",
  family,
  source = "google",
  fontWeight = 400,
  fontStyle = "normal",
  localFontStyle,
}: TypographyActiveFontIndicatorProps) {
  useEffect(() => {
    if (source === "google") loadGoogleFont(family);
    else if (localFontStyle) void ensureLocalFontFace(family, localFontStyle);
  }, [family, source, localFontStyle]);

  const variantLabel = formatTypographyVariantLabel(fontWeight, fontStyle, localFontStyle);

  return (
    <div className="type-font-active-indicator" role="status" aria-live="polite">
      <p className="type-font-active-indicator__label">{roleLabel}</p>
      <p
        className="type-font-active-indicator__name"
        style={{
          fontFamily: resolveCssFontFamily(family, source, localFontStyle),
          fontWeight,
          fontStyle,
        }}
      >
        {family}
      </p>
      <p className="type-font-active-indicator__variant">{variantLabel}</p>
      <LocalFontMissingNotice family={family} source={source} />
    </div>
  );
}
