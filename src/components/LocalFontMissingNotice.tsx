import { useMemo } from "react";
import type { FontSource } from "../types";
import { isLocalFontInstalled } from "../utils/fontUtils";

interface LocalFontMissingNoticeProps {
  family: string;
  source?: FontSource;
  className?: string;
}

/** True when a local/system font is selected but not installed on this device. */
export function useLocalFontMissing(family: string, source: FontSource = "google"): boolean {
  return useMemo(() => {
    if (source !== "local") return false;
    return !isLocalFontInstalled(family);
  }, [family, source]);
}

export default function LocalFontMissingNotice({
  family,
  source = "google",
  className,
}: LocalFontMissingNoticeProps) {
  const missing = useLocalFontMissing(family, source);
  if (!missing) return null;

  return (
    <p
      className={["local-font-missing", className].filter(Boolean).join(" ")}
      role="status"
    >
      <span className="local-font-missing__label">Can&apos;t preview on this device</span>
      <span className="local-font-missing__body">
        “{family}” isn&apos;t installed here, so you&apos;re seeing a fallback. Install the font on
        this computer, or switch to a Google Font to preview accurately everywhere.
      </span>
    </p>
  );
}
