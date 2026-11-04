import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { normalizeHex } from "../utils/colorUtils";

interface Hsv {
  h: number;
  s: number;
  v: number;
}

function hexToHsv(hex: string): Hsv {
  const value = normalizeHex(hex) ?? "#000000";
  const r = parseInt(value.slice(1, 3), 16) / 255;
  const g = parseInt(value.slice(3, 5), 16) / 255;
  const b = parseInt(value.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return { h, s: max ? d / max : 0, v: max };
}

function hsvToHex({ h, s, v }: Hsv): string {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  const hex = (x: number) =>
    Math.round(x * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${hex(f(5))}${hex(f(3))}${hex(f(1))}`.toUpperCase();
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

type EyeDropperCtor = new () => { open: () => Promise<{ sRGBHex: string }> };

function getEyeDropper(): EyeDropperCtor | null {
  return (window as unknown as { EyeDropper?: EyeDropperCtor }).EyeDropper ?? null;
}

interface ColorPickerPopoverProps {
  anchor: HTMLElement;
  initialHex: string;
  confirmLabel: string;
  /** Called on every change while the picker is open (live editing). */
  onChange?: (hex: string) => void;
  onConfirm: (hex: string) => void;
  /** Cancel button / Escape. */
  onCancel: () => void;
  /** Click outside the popover. */
  onClose: () => void;
}

const POPOVER_WIDTH = 260;

export default function ColorPickerPopover({
  anchor,
  initialHex,
  confirmLabel,
  onChange,
  onConfirm,
  onCancel,
  onClose,
}: ColorPickerPopoverProps) {
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(initialHex));
  const [draft, setDraft] = useState(() => normalizeHex(initialHex) ?? "#000000");
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const popoverRef = useRef<HTMLDivElement>(null);
  const hex = hsvToHex(hsv);
  const EyeDropper = getEyeDropper();

  const apply = (next: Hsv, syncDraft = true) => {
    setHsv(next);
    const nextHex = hsvToHex(next);
    if (syncDraft) setDraft(nextHex);
    onChange?.(nextHex);
  };

  useLayoutEffect(() => {
    const place = () => {
      const rect = anchor.getBoundingClientRect();
      const height = popoverRef.current?.offsetHeight ?? 360;
      let left = rect.left + rect.width / 2 - POPOVER_WIDTH / 2;
      left = Math.max(12, Math.min(left, window.innerWidth - POPOVER_WIDTH - 12));
      let top = rect.bottom + 8;
      if (top + height > window.innerHeight - 12) top = Math.max(12, rect.top - height - 8);
      setPosition({ top, left });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [anchor]);

  useEffect(() => {
    const onPointerDown = (event: globalThis.PointerEvent) => {
      const target = event.target as Node;
      if (popoverRef.current?.contains(target) || anchor.contains(target)) return;
      onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [anchor, onCancel, onClose]);

  const dragHandler =
    (update: (x: number, y: number) => Hsv) => (event: PointerEvent<HTMLDivElement>) => {
      const el = event.currentTarget;
      const move = (clientX: number, clientY: number) => {
        const rect = el.getBoundingClientRect();
        apply(
          update(clamp01((clientX - rect.left) / rect.width), clamp01((clientY - rect.top) / rect.height)),
        );
      };
      el.setPointerCapture(event.pointerId);
      move(event.clientX, event.clientY);
      const onMove = (e: globalThis.PointerEvent) => move(e.clientX, e.clientY);
      const onUp = () => {
        el.removeEventListener("pointermove", onMove);
        el.removeEventListener("pointerup", onUp);
      };
      el.addEventListener("pointermove", onMove);
      el.addEventListener("pointerup", onUp);
    };

  const pickFromScreen = async () => {
    if (!EyeDropper) return;
    try {
      const result = await new EyeDropper().open();
      const picked = normalizeHex(result.sRGBHex);
      if (picked) apply(hexToHsv(picked));
    } catch {
      // User cancelled the eyedropper.
    }
  };

  const draftInvalid = normalizeHex(draft) === null;

  return createPortal(
    <div
      ref={popoverRef}
      className="color-popover"
      style={{ top: position.top, left: position.left, width: POPOVER_WIDTH }}
      role="dialog"
      aria-label="Choose a color"
    >
      <div
        className="color-popover__sv"
        style={{ backgroundColor: hsvToHex({ h: hsv.h, s: 1, v: 1 }) }}
        onPointerDown={dragHandler((x, y) => ({ h: hsv.h, s: x, v: 1 - y }))}
        role="slider"
        aria-label="Saturation and brightness"
        aria-valuetext={hex}
        tabIndex={0}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 0.1 : 0.02;
          const moves: Record<string, Partial<Hsv>> = {
            ArrowLeft: { s: clamp01(hsv.s - step) },
            ArrowRight: { s: clamp01(hsv.s + step) },
            ArrowUp: { v: clamp01(hsv.v + step) },
            ArrowDown: { v: clamp01(hsv.v - step) },
          };
          if (moves[e.key]) {
            e.preventDefault();
            apply({ ...hsv, ...moves[e.key] });
          }
        }}
      >
        <span
          className="color-popover__sv-thumb"
          style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, backgroundColor: hex }}
        />
      </div>

      <div className="color-popover__row">
        <span className="color-popover__preview" style={{ backgroundColor: hex }} />
        <div
          className="color-popover__hue"
          onPointerDown={dragHandler((x) => ({ ...hsv, h: Math.min(359.9, x * 360) }))}
          role="slider"
          aria-label="Hue"
          aria-valuemin={0}
          aria-valuemax={360}
          aria-valuenow={Math.round(hsv.h)}
          tabIndex={0}
          onKeyDown={(e) => {
            const step = e.shiftKey ? 15 : 3;
            if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
              e.preventDefault();
              const h = (hsv.h + (e.key === "ArrowRight" ? step : -step) + 360) % 360;
              apply({ ...hsv, h });
            }
          }}
        >
          <span className="color-popover__hue-thumb" style={{ left: `${(hsv.h / 360) * 100}%` }} />
        </div>
      </div>

      <div className="color-popover__row">
        <input
          className={`color-popover__hex${draftInvalid ? " color-popover__hex--invalid" : ""}`}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            const parsed = normalizeHex(e.target.value);
            if (parsed && e.target.value.replace(/^#/, "").length === 6) {
              apply(hexToHsv(parsed), false);
            }
          }}
          onBlur={() => setDraft(hex)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !draftInvalid) onConfirm(normalizeHex(draft) ?? hex);
          }}
          aria-label="Hex code"
          spellCheck={false}
          maxLength={7}
          autoFocus
        />
        {EyeDropper && (
          <button
            type="button"
            className="color-popover__eyedropper"
            onClick={() => void pickFromScreen()}
            title="Pick a color from your screen"
            aria-label="Pick a color from your screen"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path
                d="M17.6 3.4a2.1 2.1 0 0 1 3 3l-2.3 2.3 1 1-1.4 1.4-1-1-7.7 7.7H6.4L4 20l-1-1 2.2-2.4v-2.8l7.7-7.7-1-1 1.4-1.4 1 1 2.3-2.3Zm-3.3 4.7-7.1 7.1V17h1.8l7.1-7.1-1.8-1.8Z"
                fill="currentColor"
              />
            </svg>
          </button>
        )}
      </div>

      <div className="color-popover__actions">
        <button type="button" className="btn-ghost btn-sm" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="btn-primary btn-sm" onClick={() => onConfirm(hex)}>
          {confirmLabel}
        </button>
      </div>
    </div>,
    document.body,
  );
}
