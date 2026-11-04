import { useEffect, useRef, useState } from "react";
import type {
  ApprovedColorPairing,
  BrandColor,
  CTAStyle,
  CTAStyleDefinition,
  TypographyStyle,
} from "../types";
import { DEFAULT_CTA_SAMPLE_TEXT, resolveCTASampleText } from "../types";
import { buildCTAStyle } from "../utils/ctaCss";
import {
  definitionToCTAStyle,
  getStyleDisplayName,
  isTextOnlyStyle,
  reconcileCTAStyleDefinitions,
} from "../utils/ctaResolve";
import { loadCTACustomFonts, loadGoogleFontsFromTypography } from "../utils/fontUtils";
import CTAPreview from "./CTAPreview";
import CTAStyleModal from "./CTAStyleModal";

interface ButtonsPanelProps {
  ctaStyles: CTAStyleDefinition[];
  colors: BrandColor[];
  typography: TypographyStyle[];
  approvedPairings: ApprovedColorPairing[];
  pairingsAreFavorites: boolean;
  previewBackground: string;
  onPreviewBackgroundChange: (hex: string) => void;
  onStylesChange: (styles: CTAStyleDefinition[]) => void;
  onContinue: () => void;
  onBack: () => void;
}

const WHITE = "#FFFFFF";

function newStyleId(): string {
  return `cta-style-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function ArrowIcon() {
  return (
    <svg
      className="cta-row__arrow-icon"
      width="44"
      height="12"
      viewBox="0 0 44 12"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M1 6h40m0 0-5-5m5 5-5 5"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg className="cta-row__action-icon" viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
      <path
        d="M11.3 2.7a1.2 1.2 0 011.7 0l1.3 1.3a1.2 1.2 0 010 1.7l-8.6 8.6H2.5v-3.2l8.8-8.4zm1.2-1.2a2.7 2.7 0 00-3.8 0l-.9.9 4.8 4.8.9-.9a2.7 2.7 0 000-3.8z"
        fill="currentColor"
      />
    </svg>
  );
}

function DuplicateIcon() {
  return (
    <svg className="cta-row__action-icon" viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
      <rect x="6.5" y="6.5" width="10" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M13.5 4.5v-1a1.5 1.5 0 00-1.5-1.5H5A1.5 1.5 0 003.5 3.5V12A1.5 1.5 0 005 13.5h1" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg className="cta-row__action-icon" viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
      <path
        d="M5.5 5.5l9 9M14.5 5.5l-9 9"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Default-state button that turns into an inline input on double-click. */
function EditableSampleButton({
  cta,
  colors,
  typography,
  sampleText,
  onSampleTextChange,
}: {
  cta: CTAStyle;
  colors: BrandColor[];
  typography: TypographyStyle[];
  sampleText: string;
  onSampleTextChange: (text: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(sampleText);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isEditing) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [isEditing]);

  const commit = () => {
    onSampleTextChange(draft.trim() || DEFAULT_CTA_SAMPLE_TEXT);
    setIsEditing(false);
  };

  if (isEditing) {
    const style = buildCTAStyle(cta, "default", colors, typography);
    return (
      <input
        ref={inputRef}
        className="cta-row__text-input"
        style={{ ...style, width: `${Math.max(draft.length, 8) + 6}ch` }}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            setDraft(sampleText);
            setIsEditing(false);
          }
        }}
        aria-label="Edit button text"
      />
    );
  }

  return (
    <span
      className="cta-row__btn"
      onDoubleClick={() => {
        setDraft(sampleText);
        setIsEditing(true);
      }}
      title="Double-click to edit button text"
    >
      <CTAPreview cta={cta} colors={colors} typography={typography} state="default" />
    </span>
  );
}

function EditableStyleName({
  value,
  onChange,
}: {
  value: string;
  onChange: (name: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isEditing) setDraft(value);
  }, [isEditing, value]);

  useEffect(() => {
    if (!isEditing) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [isEditing]);

  const commit = () => {
    const next = draft.trim() || value;
    onChange(next);
    setDraft(next);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        className="cta-row__name-input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            setDraft(value);
            setIsEditing(false);
          }
        }}
        aria-label="Button label"
        maxLength={48}
      />
    );
  }

  return (
    <button
      type="button"
      className="cta-row__name"
      onClick={() => {
        setDraft(value);
        setIsEditing(true);
      }}
      title="Click to rename"
    >
      {value}
    </button>
  );
}

function StyleRow({
  definition,
  colors,
  typography,
  approvedPairings,
  onSampleTextChange,
  onNameChange,
  onEdit,
  onDuplicate,
  onDelete,
  styleIndex,
}: {
  definition: CTAStyleDefinition;
  colors: BrandColor[];
  typography: TypographyStyle[];
  approvedPairings: ApprovedColorPairing[];
  onSampleTextChange: (text: string) => void;
  onNameChange: (name: string) => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  styleIndex: number;
}) {
  const sampleText = resolveCTASampleText(definition.sampleText);
  const cta = definitionToCTAStyle(
    { ...definition, sampleText },
    colors,
    typography,
    approvedPairings,
    styleIndex,
  );
  if (!cta) return null;

  const styleLabel = getStyleDisplayName(definition, null, styleIndex);
  const isTextOnly = isTextOnlyStyle(definition);

  return (
    <li className={`cta-row ${isTextOnly ? "cta-row--link" : ""}`}>
      <div className="cta-row__meta">
        <EditableStyleName value={styleLabel} onChange={onNameChange} />
        <div className="cta-row__actions">
          <button
            type="button"
            className="cta-row__action cta-row__action--edit"
            onClick={onEdit}
            aria-label={`Edit ${styleLabel}`}
            title={`Edit ${styleLabel}`}
          >
            <EditIcon />
          </button>
          <button
            type="button"
            className="cta-row__action cta-row__action--edit"
            onClick={onDuplicate}
            aria-label={`Duplicate ${styleLabel}`}
            title={`Duplicate ${styleLabel}`}
          >
            <DuplicateIcon />
          </button>
          <button
            type="button"
            className="cta-row__action cta-row__action--delete"
            onClick={onDelete}
            aria-label={`Delete ${styleLabel}`}
            title={`Delete ${styleLabel}`}
          >
            <DeleteIcon />
          </button>
        </div>
      </div>
      <div className="cta-row__previews">
        <div className="cta-row__cell cta-row__cell--style">
          <span className="cta-row__mobile-label" aria-hidden="true">
            {isTextOnly ? "Text style" : "Button style"}
          </span>
          <div className="cta-row__style-wrap">
            <EditableSampleButton
              cta={cta}
              colors={colors}
              typography={typography}
              sampleText={sampleText}
              onSampleTextChange={onSampleTextChange}
            />
          </div>
        </div>
        <span className="cta-row__arrow" aria-hidden="true">
          <ArrowIcon />
        </span>
        <div className="cta-row__cell">
          <span className="cta-row__mobile-label" aria-hidden="true">
            Hover style
          </span>
          <CTAPreview cta={cta} colors={colors} typography={typography} state="hover" />
        </div>
      </div>
    </li>
  );
}

export default function ButtonsPanel({
  ctaStyles,
  colors,
  typography,
  approvedPairings,
  pairingsAreFavorites,
  previewBackground,
  onPreviewBackgroundChange,
  onStylesChange,
  onContinue,
  onBack,
}: ButtonsPanelProps) {
  const [modalState, setModalState] = useState<
    { mode: "add" } | { mode: "edit"; definition: CTAStyleDefinition } | null
  >(null);

  // Re-resolve stored colors when palette or approved pairings change.
  const paletteSignature = useRef("");
  useEffect(() => {
    if (!ctaStyles.length) return;
    const signature = JSON.stringify({
      colors: colors.map((c) => `${c.id}:${c.hex}:${c.role}`),
      pairings: approvedPairings,
      ids: ctaStyles.map((s) => s.id),
    });
    if (paletteSignature.current === signature) return;
    paletteSignature.current = signature;

    const reconciled = reconcileCTAStyleDefinitions(ctaStyles, colors, approvedPairings);
    const changed = reconciled.some(
      (style, index) => JSON.stringify(style) !== JSON.stringify(ctaStyles[index]),
    );
    if (changed) {
      onStylesChange(reconciled);
    }
  }, [ctaStyles, colors, approvedPairings, onStylesChange]);

  useEffect(() => {
    loadGoogleFontsFromTypography(typography);
  }, [typography]);

  useEffect(() => {
    loadCTACustomFonts(ctaStyles);
  }, [ctaStyles]);

  const setSampleText = (id: string, text: string) => {
    onStylesChange(
      ctaStyles.map((s) =>
        s.id === id ? { ...s, sampleText: resolveCTASampleText(text) } : s,
      ),
    );
  };

  const handleSave = (definition: CTAStyleDefinition) => {
    if (modalState?.mode === "add") {
      onStylesChange([...ctaStyles, definition]);
    } else {
      onStylesChange(ctaStyles.map((s) => (s.id === definition.id ? definition : s)));
    }
    setModalState(null);
  };

  const renameStyle = (id: string, name: string) => {
    onStylesChange(ctaStyles.map((s) => (s.id === id ? { ...s, name } : s)));
  };

  const duplicateStyle = (id: string) => {
    const index = ctaStyles.findIndex((s) => s.id === id);
    if (index < 0) return;
    const source = ctaStyles[index];
    const copy: CTAStyleDefinition = {
      ...source,
      id: newStyleId(),
      name: `${getStyleDisplayName(source, null, index)} copy`,
    };
    onStylesChange([...ctaStyles.slice(0, index + 1), copy, ...ctaStyles.slice(index + 1)]);
  };

  const deleteStyle = (id: string) => {
    onStylesChange(ctaStyles.filter((s) => s.id !== id));
  };

  const hasRows = ctaStyles.some(
    (def) => definitionToCTAStyle(def, colors, typography, approvedPairings) !== null,
  );

  const backgroundOptions = [
    { id: "white", name: "White", hex: WHITE },
    ...colors.map((c) => ({ id: c.id, name: c.hex.toUpperCase(), hex: c.hex })),
  ].filter(
    (option, index, all) =>
      all.findIndex((o) => o.hex.toUpperCase() === option.hex.toUpperCase()) === index,
  );

  return (
    <div className="step step--wide">
      <header className="step__header">
        <p className="step__eyebrow">Step 3</p>
        <h1 className="step__title">Buttons & links</h1>
        <p className="step__lede">
          Name each style, then edit its colors, font, shape and spacing. Double-click a button
          to change its label.
        </p>
      </header>

      <div className="preview-surface" role="radiogroup" aria-label="Preview background">
        <span className="preview-surface__label">Preview on</span>
        {backgroundOptions.map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={previewBackground.toUpperCase() === option.hex.toUpperCase()}
            className={`preview-surface__dot${
              previewBackground.toUpperCase() === option.hex.toUpperCase()
                ? " preview-surface__dot--selected"
                : ""
            }`}
            style={{ backgroundColor: option.hex }}
            onClick={() => onPreviewBackgroundChange(option.hex)}
            title={option.name}
            aria-label={`Preview on ${option.name}`}
          />
        ))}
      </div>

      <section className="cta-board" aria-label="Buttons and links">
        <div className="cta-board__main" style={{ backgroundColor: previewBackground }}>
          {hasRows ? (
            <>
              <div className="cta-board__headers" aria-hidden="true">
                <span className="cta-board__heading">Button style:</span>
                <span className="cta-board__heading-spacer" />
                <span className="cta-board__heading">Hover style:</span>
              </div>
              <ul className="cta-rows">
                {ctaStyles.map((definition, index) => (
                  <StyleRow
                    key={definition.id}
                    definition={definition}
                    colors={colors}
                    typography={typography}
                    approvedPairings={approvedPairings}
                    onSampleTextChange={(text) => setSampleText(definition.id, text)}
                    onNameChange={(name) => renameStyle(definition.id, name)}
                    onEdit={() => setModalState({ mode: "edit", definition })}
                    onDuplicate={() => duplicateStyle(definition.id)}
                    onDelete={() => deleteStyle(definition.id)}
                    styleIndex={index}
                  />
                ))}
              </ul>
            </>
          ) : (
            <p className="cta-board__empty">Add your first button or link style to get started.</p>
          )}
        </div>
      </section>

      <footer className="step__footer">
        <button type="button" className="btn-ghost" onClick={onBack}>
          ← Back
        </button>
        <div className="step__footer-actions">
          <button
            type="button"
            className="btn-dark"
            onClick={() => setModalState({ mode: "add" })}
            disabled={colors.length === 0}
          >
            + Add style
          </button>
          <button type="button" className="btn-primary" onClick={onContinue}>
            Next: Export →
          </button>
        </div>
      </footer>

      {modalState && (
        <CTAStyleModal
          definition={modalState.mode === "edit" ? modalState.definition : undefined}
          colors={colors}
          typography={typography}
          approvedPairings={approvedPairings}
          pairingsAreFavorites={pairingsAreFavorites}
          isNew={modalState.mode === "add"}
          fallbackStyleIndex={
            modalState.mode === "add"
              ? ctaStyles.length + 1
              : ctaStyles.findIndex((s) => s.id === modalState.definition.id) + 1
          }
          onSave={handleSave}
          onClose={() => setModalState(null)}
        />
      )}
    </div>
  );
}
