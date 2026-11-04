import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ApprovedColorPairing, BrandColor } from "../types";
import { getContrastColor, getDefaultNewColorHex, normalizeHex } from "../utils/colorUtils";
import { parseStudioCode } from "../utils/studioCode";
import ColorPickerPopover from "./ColorPickerPopover";

interface ColorsPanelProps {
  colors: BrandColor[];
  onColorsChange: (colors: BrandColor[], favoritePairings?: ApprovedColorPairing[]) => void;
  onContinue: () => void;
}

const MAX_COLORS = 12;
const BARS_MIN_HEIGHT = 256;
const BARS_MAX_VIEWPORT = 0.7;

/** Size the bars to fill the screen space left by the rest of the step (capped at 70vh). */
function useFillHeight(deps: unknown[]) {
  const ref = useRef<HTMLUListElement>(null);
  const [height, setHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    const measure = () => {
      const bars = ref.current;
      const step = bars?.closest(".step");
      const main = bars?.closest(".main");
      if (!bars || !step || !main) return;
      const mainStyle = getComputedStyle(main);
      const mainPadding = parseFloat(mainStyle.paddingTop) + parseFloat(mainStyle.paddingBottom);
      const otherContent = (step as HTMLElement).offsetHeight - bars.offsetHeight + mainPadding;
      const available = window.innerHeight - otherContent;
      const cap = window.innerHeight * BARS_MAX_VIEWPORT;
      setHeight(Math.round(Math.max(BARS_MIN_HEIGHT, Math.min(available, cap))));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, deps);

  return { ref, height };
}

function newColor(hex: string): BrandColor {
  return {
    id: `color-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: hex,
    hex,
    role: "accent",
  };
}

type PickerState =
  | { mode: "add"; anchor: HTMLElement; initialHex: string }
  | { mode: "edit"; anchor: HTMLElement; id: string; initialHex: string };

function HexInput({ value, onCommit }: { value: string; onCommit: (hex: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const invalid = draft.trim() !== "" && normalizeHex(draft) === null;

  return (
    <input
      className={`color-bar__hex${invalid ? " color-bar__hex--invalid" : ""}`}
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value);
        const hex = normalizeHex(e.target.value);
        if (hex && e.target.value.replace(/^#/, "").length === 6) onCommit(hex);
      }}
      onBlur={() => {
        const hex = normalizeHex(draft);
        if (hex) onCommit(hex);
        else setDraft(value);
      }}
      aria-label="Hex code"
      spellCheck={false}
      maxLength={7}
    />
  );
}

export default function ColorsPanel({ colors, onColorsChange, onContinue }: ColorsPanelProps) {
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteDraft, setPasteDraft] = useState("");
  const [picker, setPicker] = useState<PickerState | null>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const bars = useFillHeight([pasteOpen, colors.length === 0]);

  const setHex = (id: string, hex: string) => {
    onColorsChange(colors.map((c) => (c.id === id ? { ...c, hex, name: hex } : c)));
  };

  const removeColor = (id: string) => {
    onColorsChange(colors.filter((c) => c.id !== id));
  };

  const openAddPicker = () => {
    if (colors.length >= MAX_COLORS || !addButtonRef.current) return;
    setPicker({
      mode: "add",
      anchor: addButtonRef.current,
      initialHex: getDefaultNewColorHex(colors.map((c) => c.hex)),
    });
  };

  const cancelPicker = () => {
    if (picker?.mode === "edit") setHex(picker.id, picker.initialHex);
    setPicker(null);
  };

  const studioCode = useMemo(() => parseStudioCode(pasteDraft), [pasteDraft]);

  const pastedHexes = useMemo(() => {
    if (studioCode) return studioCode.hexes.slice(0, MAX_COLORS);
    const matches = pasteDraft.match(/#?\b[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) ?? [];
    const existing = new Set(colors.map((c) => c.hex.toUpperCase()));
    const unique: string[] = [];
    for (const match of matches) {
      const hex = normalizeHex(match);
      if (hex && !existing.has(hex) && !unique.includes(hex)) unique.push(hex);
    }
    return unique.slice(0, MAX_COLORS - colors.length);
  }, [pasteDraft, colors, studioCode]);

  const addPasted = () => {
    if (studioCode) {
      const imported = pastedHexes.map(newColor);
      const idByHex = new Map(imported.map((c) => [c.hex, c.id]));
      const pairings = studioCode.pairings.flatMap((p) => {
        const textColorId = idByHex.get(p.textHex);
        const backgroundColorId = idByHex.get(p.backgroundHex);
        return textColorId && backgroundColorId ? [{ textColorId, backgroundColorId }] : [];
      });
      onColorsChange(imported, pairings);
    } else {
      onColorsChange([...colors, ...pastedHexes.map(newColor)]);
    }
    setPasteDraft("");
    setPasteOpen(false);
  };

  return (
    <div className="step step--wide">
      <header className="step__header">
        <p className="step__eyebrow">Step 1</p>
        <h1 className="step__title">Brand colors</h1>
        <p className="step__lede">
          Add the colors from your brand guidelines, paste hex codes, or import a Studio Code.
          Click a color to change it.
        </p>
      </header>

      <section className="panel" aria-label="Palette">
        <div className="panel__head">
          <h2 className="panel__title">Palette</h2>
          <div className="panel__actions">
            {colors.length > 0 && (
              <button
                type="button"
                className="btn-ghost btn-ghost--danger"
                onClick={() => {
                  if (window.confirm("Clear all colors from your palette?")) {
                    setPicker(null);
                    onColorsChange([], []);
                  }
                }}
              >
                Clear palette
              </button>
            )}
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setPasteOpen((open) => !open)}
              aria-expanded={pasteOpen}
            >
              Paste hex codes or Studio Code
            </button>
            <button
              ref={addButtonRef}
              type="button"
              className="btn-ghost"
              onClick={() => (picker?.mode === "add" ? setPicker(null) : openAddPicker())}
              disabled={colors.length >= MAX_COLORS}
              aria-expanded={picker?.mode === "add"}
            >
              + Add color
            </button>
          </div>
        </div>

        {pasteOpen && (
          <div className="paste-palette">
            <textarea
              className="paste-palette__input"
              placeholder="Paste hex codes (e.g. #1F2A44, #F4B400, #FFFFFF) or a Studio Code from Color Palette Studio"
              value={pasteDraft}
              onChange={(e) => setPasteDraft(e.target.value)}
              rows={3}
              autoFocus
            />
            <div className="paste-palette__footer">
              <div className="paste-palette__chips" aria-live="polite">
                {pastedHexes.map((hex) => (
                  <span key={hex} className="paste-palette__chip" style={{ backgroundColor: hex }}>
                    <span className="sr-only">{hex}</span>
                  </span>
                ))}
                <span className="paste-palette__count">
                  {studioCode
                    ? `Studio Code · ${pastedHexes.length} color${pastedHexes.length === 1 ? "" : "s"}${studioCode.pairings.length ? ` · ${studioCode.pairings.length} favorite pairing${studioCode.pairings.length === 1 ? "" : "s"}` : ""}`
                    : pastedHexes.length
                      ? `${pastedHexes.length} new color${pastedHexes.length === 1 ? "" : "s"} found`
                      : "No new hex codes yet"}
                </span>
              </div>
              <button
                type="button"
                className="btn-primary btn-sm"
                onClick={addPasted}
                disabled={!pastedHexes.length}
              >
                {studioCode ? "Replace palette" : "Add to palette"}
              </button>
            </div>
          </div>
        )}

        {colors.length === 0 ? (
          <p className="panel__empty">No colors yet. Add your first brand color to get started.</p>
        ) : (
          <ul
            ref={bars.ref}
            className="color-bars"
            style={bars.height ? { height: bars.height } : undefined}
          >
            {colors.map((color) => (
              <li
                key={color.id}
                className={`color-bar${picker?.mode === "edit" && picker.id === color.id ? " color-bar--editing" : ""}`}
                style={{ backgroundColor: color.hex, color: getContrastColor(color.hex) }}
              >
                <button
                  type="button"
                  className="color-bar__picker"
                  onClick={(e) =>
                    setPicker(
                      picker?.mode === "edit" && picker.id === color.id
                        ? null
                        : {
                            mode: "edit",
                            anchor: e.currentTarget,
                            id: color.id,
                            initialHex: color.hex,
                          },
                    )
                  }
                  aria-label={`Change ${color.hex}`}
                />
                <div className="color-bar__top">
                  {colors.length > 1 && (
                    <button
                      type="button"
                      className="color-bar__remove"
                      onClick={() => removeColor(color.id)}
                      title="Remove color"
                      aria-label={`Remove ${color.hex}`}
                    >
                      ×
                    </button>
                  )}
                </div>
                <HexInput value={color.hex} onCommit={(hex) => setHex(color.id, hex)} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {picker && (
        <ColorPickerPopover
          key={picker.mode === "edit" ? picker.id : "add"}
          anchor={picker.anchor}
          initialHex={picker.initialHex}
          confirmLabel={picker.mode === "add" ? "Add color" : "Done"}
          onChange={picker.mode === "edit" ? (hex) => setHex(picker.id, hex) : undefined}
          onConfirm={(hex) => {
            if (picker.mode === "add") onColorsChange([...colors, newColor(hex)]);
            else setHex(picker.id, hex);
            setPicker(null);
          }}
          onCancel={cancelPicker}
          onClose={() => setPicker(null)}
        />
      )}

      <footer className="step__footer">
        <button type="button" className="btn-primary" onClick={onContinue}>
          Next: Fonts →
        </button>
      </footer>
    </div>
  );
}
