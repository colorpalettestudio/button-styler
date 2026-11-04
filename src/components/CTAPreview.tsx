import type { BrandColor, CTAStyle, TypographyStyle } from "../types";
import { buildCTAAlignmentStyle, buildCTAStyle } from "../utils/ctaCss";

interface CTAPreviewProps {
  cta: CTAStyle;
  colors: BrandColor[];
  typography: TypographyStyle[];
  state?: "default" | "hover";
  className?: string;
  showAlignment?: boolean;
  /** When true, preview text may wrap instead of staying on one line (modal editor). */
  allowTextWrap?: boolean;
}

export default function CTAPreview({
  cta,
  colors,
  typography,
  state = "default",
  className = "",
  showAlignment = false,
  allowTextWrap = false,
}: CTAPreviewProps) {
  const style = {
    ...buildCTAStyle(cta, state, colors, typography),
    ...(allowTextWrap
      ? { whiteSpace: "normal" as const, wordBreak: "break-word" as const, maxWidth: "100%" }
      : {}),
  };
  const text = cta.showArrow ? `${cta.sampleText} →` : cta.sampleText;

  const element = (
    <span className={`cta-preview__element ${className}`} style={style}>
      {text}
    </span>
  );

  if (!showAlignment || !cta.alignment) return element;

  return (
    <div className="cta-preview__align" style={buildCTAAlignmentStyle(cta.alignment)}>
      {element}
    </div>
  );
}
