import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { FontSource } from "../types";
import TypographyActiveFontIndicator from "./TypographyActiveFontIndicator";
import {
  FONT_ROLE_SUGGESTIONS,
  getRoleSuggestionLabel,
  queryGoogleFonts,
  resolveSuggestedFonts,
  type FontRoleSuggestion,
} from "../utils/fontPickerCatalog";
import LocalFontPermissionOverlay from "./LocalFontPermissionOverlay";
import {
  fetchGoogleFonts,
  fetchLocalFonts,
  areLocalFontsEnabled,
  getCachedLocalFonts,
  loadGoogleFont,
  loadGoogleFonts,
  getLocalFontPermissionState,
  getBrowserDisplayName,
  isLocalFontApiSupported,
  type GoogleFontEntry,
} from "../utils/fontUtils";
import { clearLocalVariantsCache } from "../utils/fontVariants";

type FontTab = "google" | "local";

export interface FontPickerActiveFontIndicator {
  roleLabel: string;
  fontWeight: number;
  fontStyle: "normal" | "italic";
  localFontStyle?: string;
}

interface FontPickerProps {
  value: string;
  source?: FontSource;
  onChange: (family: string, source: FontSource) => void;
  /** @deprecated Use modal — dropdown now opens the same modal overlay */
  layout?: "modal" | "dropdown" | "browse";
  suggestFor?: FontRoleSuggestion;
  hideSource?: boolean;
  triggerVariant?: "default" | "link" | "display";
  triggerLabel?: string;
  /** Open the font picker dialog on mount (trigger variants only). */
  defaultOpen?: boolean;
  /** Inline embeds the font list in the parent panel instead of a nested dialog. */
  variant?: "trigger" | "inline";
  /** Prominent current-font box above search (inline picker). */
  activeFontIndicator?: FontPickerActiveFontIndicator;
}

interface FontOptionProps {
  family: string;
  tab: FontTab;
  selected: boolean;
  highlighted: boolean;
  listRoot: HTMLDivElement | null;
  onSelect: (family: string) => void;
}

const GOOGLE_LIST_LIMIT = 64;
const DEFAULT_CATEGORY = "all" as const;
const DEFAULT_SORT = "popular" as const;

function fontTabForSource(source: FontSource): FontTab {
  return source === "local" ? "local" : "google";
}

function getFontTabOrder(localEnabled: boolean): FontTab[] {
  return localEnabled ? ["local", "google"] : ["google", "local"];
}

/** Default tab when opening the picker: Your fonts first when connected, else Google Fonts. */
function resolveOpenFontTab(source: FontSource): FontTab {
  if (areLocalFontsEnabled()) return "local";
  return fontTabForSource(source);
}

function syncTabToSource(source: FontSource, setTab: (tab: FontTab) => void) {
  if (source === "local") {
    setTab("local");
  } else if (!areLocalFontsEnabled()) {
    setTab("google");
  }
}

function FontOption({ family, tab, selected, highlighted, listRoot, onSelect }: FontOptionProps) {
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (tab !== "google") return;
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) loadGoogleFont(family);
      },
      { root: listRoot, rootMargin: "120px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [family, tab, listRoot]);

  useEffect(() => {
    if (selected || highlighted) ref.current?.scrollIntoView({ block: "nearest" });
  }, [selected, highlighted]);

  return (
    <button
      ref={ref}
      type="button"
      className={[
        "font-picker__option",
        selected ? "selected" : "",
        highlighted ? "highlighted" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={() => onSelect(family)}
      onMouseEnter={() => tab === "google" && loadGoogleFont(family)}
      aria-current={selected ? "true" : undefined}
    >
      {selected ? (
        <span className="font-picker__option-check" aria-hidden="true">
          <svg viewBox="0 0 16 16" width="14" height="14">
            <path
              d="M3 8.5l3.2 3.2L13 4.9"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      ) : (
        <span className="font-picker__option-check font-picker__option-check--placeholder" aria-hidden="true" />
      )}
      <span
        className="font-picker__option-name"
        style={{ fontFamily: `"${family}", sans-serif` }}
      >
        {family}
      </span>
    </button>
  );
}

interface FontPickerListProps {
  value: string;
  source: FontSource;
  tab: FontTab;
  suggestFor?: FontRoleSuggestion;
  onTabChange: (tab: FontTab) => void;
  onSelect: (family: string) => void;
  autoFocusSearch?: boolean;
  activeFontIndicator?: FontPickerActiveFontIndicator;
}

function FontPickerList({
  value,
  source,
  tab,
  suggestFor,
  onTabChange,
  onSelect,
  autoFocusSearch = false,
  activeFontIndicator,
}: FontPickerListProps) {
  const [search, setSearch] = useState("");
  const [googleFonts, setGoogleFonts] = useState<GoogleFontEntry[]>([]);
  const [localFonts, setLocalFonts] = useState<string[]>(() => getCachedLocalFonts() ?? []);
  const [localEnabled, setLocalEnabled] = useState(areLocalFontsEnabled);
  const [localLoading, setLocalLoading] = useState(false);
  const [localPermissionPending, setLocalPermissionPending] = useState(false);
  const [listRoot, setListRoot] = useState<HTMLDivElement | null>(null);
  const [highlightedFamily, setHighlightedFamily] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchGoogleFonts().then(setGoogleFonts);
    if (autoFocusSearch) searchRef.current?.focus();
  }, [autoFocusSearch]);

  const loadLocalFontList = async (force = false) => {
    setLocalLoading(true);
    const permissionState = await getLocalFontPermissionState();
    if (permissionState === "prompt") setLocalPermissionPending(true);
    try {
      const fonts = await fetchLocalFonts({ force });
      clearLocalVariantsCache();
      setLocalFonts(fonts);
      setLocalEnabled(areLocalFontsEnabled());
      return fonts;
    } finally {
      setLocalLoading(false);
      setLocalPermissionPending(false);
    }
  };

  const localApiSupported = isLocalFontApiSupported();
  const browserName = getBrowserDisplayName();
  const keepUsingBrowser =
    browserName === "This browser" ? "this browser" : browserName;

  useEffect(() => {
    if (tab === "local" && localApiSupported) {
      void loadLocalFontList(true);
    }
  }, [tab, localApiSupported]);

  const suggestedFonts = useMemo(() => {
    if (tab !== "google" || !suggestFor || search.trim()) return [];
    return resolveSuggestedFonts(googleFonts, FONT_ROLE_SUGGESTIONS[suggestFor]);
  }, [tab, suggestFor, search, googleFonts]);

  const suggestedFamilies = useMemo(
    () => new Set(suggestedFonts.map((font) => font.family)),
    [suggestedFonts],
  );

  const googleResults = useMemo(() => {
    if (tab !== "google") return [];

    const hasActiveFilter = Boolean(search.trim());

    return queryGoogleFonts(googleFonts, {
      search,
      category: DEFAULT_CATEGORY,
      sort: DEFAULT_SORT,
      limit: GOOGLE_LIST_LIMIT + (hasActiveFilter ? 0 : suggestedFamilies.size),
      excludeFamilies: hasActiveFilter ? undefined : suggestedFamilies,
    });
  }, [tab, googleFonts, search, suggestedFamilies]);

  const localResults = useMemo(() => {
    if (tab !== "local") return [];
    if (!search.trim()) return localFonts;
    const q = search.toLowerCase();
    return localFonts.filter((family) => family.toLowerCase().includes(q));
  }, [tab, localFonts, search]);

  const showActiveFontIndicator = Boolean(value && activeFontIndicator);

  const showCurrentSelection = Boolean(
    value && fontTabForSource(source) === tab && !search.trim() && !showActiveFontIndicator,
  );

  /** Stable catalog order for keyboard navigation (unaffected by pinned current row). */
  const navigationOrder = useMemo(() => {
    if (tab === "local") {
      if (localLoading || (!localEnabled && !localLoading)) return [];
      return localResults;
    }
    if (tab === "google") {
      return [
        ...suggestedFonts.map((font) => font.family),
        ...googleResults.map((font) => font.family),
      ];
    }
    return [];
  }, [tab, suggestedFonts, googleResults, localResults, localLoading, localEnabled]);

  const navigationContextKey = `${tab}|${search}`;

  useEffect(() => {
    if (navigationOrder.length === 0) {
      setHighlightedFamily(null);
      return;
    }
    setHighlightedFamily((prev) => {
      if (prev && navigationOrder.includes(prev)) return prev;
      if (value && navigationOrder.includes(value)) return value;
      return navigationOrder[0];
    });
  }, [navigationContextKey, navigationOrder]);

  const handleSelect = useCallback(
    (family: string) => {
      setHighlightedFamily(family);
      onSelect(family);
    },
    [onSelect],
  );

  const navigateHighlight = useCallback(
    (delta: number) => {
      if (navigationOrder.length === 0) return;
      const activeFamily =
        highlightedFamily && navigationOrder.includes(highlightedFamily)
          ? highlightedFamily
          : value && navigationOrder.includes(value)
            ? value
            : navigationOrder[0];
      const currentIndex = navigationOrder.indexOf(activeFamily);
      const base = currentIndex >= 0 ? currentIndex : 0;
      const next = Math.max(0, Math.min(navigationOrder.length - 1, base + delta));
      const family = navigationOrder[next];
      if (family) handleSelect(family);
    },
    [navigationOrder, highlightedFamily, value, handleSelect],
  );

  const handleListKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        event.stopPropagation();
        navigateHighlight(1);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        event.stopPropagation();
        navigateHighlight(-1);
        return;
      }
      if (event.key === "Enter") {
        const family =
          highlightedFamily && navigationOrder.includes(highlightedFamily)
            ? highlightedFamily
            : value && navigationOrder.includes(value)
              ? value
              : navigationOrder[0];
        if (family) {
          event.preventDefault();
          event.stopPropagation();
          handleSelect(family);
        }
      }
    },
    [navigateHighlight, highlightedFamily, navigationOrder, value, handleSelect],
  );

  useEffect(() => {
    if (tab !== "google") return;
    loadGoogleFont(value);
    loadGoogleFonts([
      ...suggestedFonts.map((font) => font.family),
      ...googleResults.slice(0, 16).map((font) => font.family),
    ]);
  }, [tab, value, suggestedFonts, googleResults]);

  const enableLocal = async () => {
    await loadLocalFontList(true);
    onTabChange("local");
  };

  const handleListWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.stopPropagation();
  };

  const renderGoogleOption = (font: GoogleFontEntry, keyPrefix: string) => {
    if (showCurrentSelection && font.family === value) return null;
    return (
      <FontOption
        key={`${keyPrefix}-${font.family}`}
        family={font.family}
        tab={tab}
        selected={value === font.family && fontTabForSource(source) === tab}
        highlighted={highlightedFamily === font.family}
        listRoot={listRoot}
        onSelect={handleSelect}
      />
    );
  };

  const renderCurrentSelection = () => {
    if (!showCurrentSelection) return null;
    return (
      <>
        <p className="font-picker-modal__section-label font-picker-modal__section-label--current">
          Current selection
        </p>
        <FontOption
          key={`current-${value}`}
          family={value}
          tab={tab}
          selected
          highlighted={highlightedFamily === value}
          listRoot={listRoot}
          onSelect={handleSelect}
        />
      </>
    );
  };

  const hasActiveFilter = Boolean(search.trim());

  return (
    <>
      {localPermissionPending ? <LocalFontPermissionOverlay /> : null}

      {showActiveFontIndicator && activeFontIndicator ? (
        <TypographyActiveFontIndicator
          roleLabel={activeFontIndicator.roleLabel}
          family={value}
          source={source}
          fontWeight={activeFontIndicator.fontWeight}
          fontStyle={activeFontIndicator.fontStyle}
          localFontStyle={activeFontIndicator.localFontStyle}
        />
      ) : null}

      <div className="font-picker-modal__search-wrap">
        <span className="font-picker-modal__search-icon" aria-hidden="true">
          <svg viewBox="0 0 20 20" width="16" height="16">
            <path
              d="M8.5 3a5.5 5.5 0 014.07 9.18l3.34 3.34-1.06 1.06-3.34-3.34A5.5 5.5 0 118.5 3zm0 1.5a4 4 0 100 8 4 4 0 000-8z"
              fill="currentColor"
            />
          </svg>
        </span>
        <input
          ref={searchRef}
          className="font-picker-modal__search"
          placeholder="Search fonts"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleListKeyDown}
        />
        {search ? (
          <button
            type="button"
            className="font-picker-modal__search-clear"
            onClick={() => setSearch("")}
            aria-label="Clear search"
          >
            ×
          </button>
        ) : null}
      </div>

      <div className="font-picker-modal__source-tabs" role="tablist" aria-label="Font source">
        {getFontTabOrder(localEnabled).map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={tab === item}
            className={`font-picker-modal__source-tab${tab === item ? " font-picker-modal__source-tab--active" : ""}`}
            onClick={() => onTabChange(item)}
          >
            {item === "google" ? "Google Fonts" : "Your fonts"}
          </button>
        ))}
      </div>

      {tab === "local" && !localEnabled && !localLoading ? (
        <div className="font-picker-modal__local-prompt">
          {localApiSupported ? (
            <>
              <p>Browse fonts installed on your computer.</p>
              <button type="button" className="btn-primary btn-sm" onClick={enableLocal}>
                Enable local fonts
              </button>
              <p className="font-picker-modal__local-hint">
                Local fonts work in Google Chrome.
              </p>
            </>
          ) : (
            <>
              <p>Heads up! {browserName} doesn't allow local fonts to load.</p>
              <p>
                To use fonts installed on your computer, open this tool in Google Chrome.
              </p>
              <p className="font-picker-modal__local-hint">
                If you want to keep using {keepUsingBrowser}, you can use Google Fonts.
              </p>
            </>
          )}
        </div>
      ) : null}

      <div
        ref={setListRoot}
        className="font-picker-modal__list"
        onWheel={handleListWheel}
        tabIndex={-1}
        onKeyDownCapture={handleListKeyDown}
      >
        {tab === "local" && localLoading ? (
          <p className="font-picker-modal__empty">Loading your fonts…</p>
        ) : tab === "google" ? (
          <>
            {renderCurrentSelection()}

            {suggestedFonts.length > 0 ? (
              <>
                <p className="font-picker-modal__section-label">
                  {getRoleSuggestionLabel(suggestFor!)}
                </p>
                {suggestedFonts.map((font) => renderGoogleOption(font, "suggested"))}
              </>
            ) : null}

            {googleResults.length > 0 ? (
              <>
                {suggestedFonts.length > 0 || hasActiveFilter || showCurrentSelection ? (
                  <p className="font-picker-modal__section-label">
                    {hasActiveFilter ? "Results" : "More fonts"}
                  </p>
                ) : null}
                {googleResults.map((font) => renderGoogleOption(font, "results"))}
              </>
            ) : !showCurrentSelection ? (
              <p className="font-picker-modal__empty">No fonts found.</p>
            ) : null}
          </>
        ) : !localEnabled ? null : localResults.length === 0 ? (
          <p className="font-picker-modal__empty">No fonts found.</p>
        ) : (
          <>
            {renderCurrentSelection()}
            {localResults
              .filter((family) => !showCurrentSelection || family !== value)
              .map((family) => (
                <FontOption
                  key={`local-${family}`}
                  family={family}
                  tab={tab}
                  selected={value === family && fontTabForSource(source) === tab}
                  highlighted={highlightedFamily === family}
                  listRoot={listRoot}
                  onSelect={handleSelect}
                />
              ))}
          </>
        )}
      </div>
    </>
  );
}

interface FontPickerDialogProps {
  value: string;
  source: FontSource;
  tab: FontTab;
  suggestFor?: FontRoleSuggestion;
  onClose: () => void;
  onConfirm: () => void;
  onTabChange: (tab: FontTab) => void;
  onSelect: (family: string) => void;
}

function FontPickerDialog({
  value,
  source,
  tab,
  suggestFor,
  onClose,
  onConfirm,
  onTabChange,
  onSelect,
}: FontPickerDialogProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="font-picker-modal__dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="font-picker-modal-title"
      onMouseDown={(event) => event.stopPropagation()}
    >
      <header className="font-picker-modal__header">
        <h2 id="font-picker-modal-title" className="font-picker-modal__title">
          Fonts
        </h2>
        <button
          type="button"
          className="font-picker-modal__close"
          onClick={onClose}
          aria-label="Close font picker"
        >
          ×
        </button>
      </header>

      <FontPickerList
        value={value}
        source={source}
        tab={tab}
        suggestFor={suggestFor}
        onTabChange={onTabChange}
        onSelect={onSelect}
        autoFocusSearch
      />

      <footer className="font-picker-modal__footer">
        <div className="font-picker-modal__footer-copy">
          <span className="font-picker-modal__footer-label">Selected</span>
          <span
            className="font-picker-modal__footer-name"
            style={{ fontFamily: `"${value}", sans-serif` }}
          >
            {value}
          </span>
          <span className="font-picker-modal__footer-source">
            {source === "local" ? "Your fonts" : "Google Fonts"}
          </span>
        </div>
        <button type="button" className="btn-primary font-picker-modal__confirm" onClick={onConfirm}>
          Select font
        </button>
      </footer>
    </div>
  );
}

function useFontPickerSelection(
  source: FontSource,
  onChange: (family: string, source: FontSource) => void,
  open = false,
) {
  const [tab, setTab] = useState<FontTab>(() => resolveOpenFontTab(source));

  useEffect(() => {
    syncTabToSource(source, setTab);
  }, [source]);

  useEffect(() => {
    if (open) setTab(resolveOpenFontTab(source));
  }, [open, source]);

  const select = (family: string) => {
    if (tab === "google") loadGoogleFont(family);
    onChange(family, tab);
  };

  return { tab, setTab, select };
}

export default function FontPicker({
  value,
  source = "google",
  onChange,
  suggestFor,
  hideSource = false,
  triggerVariant = "default",
  triggerLabel,
  defaultOpen = false,
  variant = "trigger",
  activeFontIndicator,
}: FontPickerProps) {
  const [open, setOpen] = useState(defaultOpen);
  const { tab, setTab, select } = useFontPickerSelection(source, onChange, open);

  useEffect(() => {
    if (open) loadGoogleFont(value);
  }, [open, value]);

  if (variant === "inline") {
    return (
      <div className="font-picker font-picker--inline">
        <div className="font-picker-inline__panel">
          <FontPickerList
            value={value}
            source={source}
            tab={tab}
            suggestFor={suggestFor}
            onTabChange={setTab}
            onSelect={select}
            autoFocusSearch
            activeFontIndicator={activeFontIndicator}
          />
        </div>
      </div>
    );
  }

  const sourceLabel = source === "local" ? "Your fonts" : "Google Fonts";
  const triggerText = triggerLabel ?? value;

  if (triggerVariant === "display") {
    return (
      <>
        <button
          type="button"
          className="font-picker__display-trigger"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-haspopup="dialog"
        >
          <span
            className="font-picker__display-name"
            style={{ fontFamily: `"${value}", sans-serif` }}
          >
            {value}
          </span>
          <span className="font-picker__display-action">Change font</span>
        </button>

        {open
          ? createPortal(
              <div
                className="font-picker-modal"
                role="presentation"
                onMouseDown={() => setOpen(false)}
              >
                <FontPickerDialog
                  value={value}
                  source={source}
                  tab={tab}
                  suggestFor={suggestFor}
                  onClose={() => setOpen(false)}
                  onConfirm={() => setOpen(false)}
                  onTabChange={setTab}
                  onSelect={select}
                />
              </div>,
              document.body,
            )
          : null}
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        className={[
          "font-picker__trigger",
          triggerVariant === "link" ? "font-picker__trigger--link" : "",
          hideSource ? "font-picker__trigger--no-source" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <span
          className="font-picker__name"
          style={
            triggerLabel
              ? undefined
              : { fontFamily: `"${value}", sans-serif` }
          }
        >
          {triggerText}
        </span>
        <span className="font-picker__chevron" aria-hidden="true">
          ▾
        </span>
        {!hideSource ? <span className="font-picker__source">{sourceLabel}</span> : null}
      </button>

      {open
        ? createPortal(
            <div
              className="font-picker-modal"
              role="presentation"
              onMouseDown={() => setOpen(false)}
            >
              <FontPickerDialog
                value={value}
                source={source}
                tab={tab}
                suggestFor={suggestFor}
                onClose={() => setOpen(false)}
                onConfirm={() => setOpen(false)}
                onTabChange={setTab}
                onSelect={select}
              />
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
