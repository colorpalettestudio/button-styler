import { useEffect, useMemo, useState } from "react";
import type { ButtonStylerProject } from "../types";
import { downloadBlob, renderButtonImage, renderButtonSheet } from "../utils/buttonImages";
import {
  buildButtonCss,
  buildExportedStyles,
  buildPreviewDocument,
  exportFileBase,
  slugify,
} from "../utils/exportButtons";
import { copyTextToClipboard, downloadTextFile } from "../utils/downloadText";
import { loadCTACustomFonts, loadGoogleFontsFromTypography } from "../utils/fontUtils";
import { createZip } from "../utils/zip";
import CTAPreview from "./CTAPreview";
import ScaleToFit from "./ScaleToFit";

interface ExportPanelProps {
  project: ButtonStylerProject;
  previewBackground: string;
  onBrandNameChange: (name: string) => void;
  onBack: () => void;
}

type ImageLayout = "sheet" | "separate";
type ImageBackground = "transparent" | "preview";

function OptionGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string; swatch?: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="export-images__group">
      <span className="export-images__group-label">{label}</span>
      <div className="export-images__options" role="radiogroup" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            className={`export-images__option${value === option.value ? " export-images__option--active" : ""}`}
            onClick={() => onChange(option.value)}
          >
            {option.swatch && (
              <span
                className="export-images__swatch"
                style={{ backgroundColor: option.swatch }}
                aria-hidden="true"
              />
            )}
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ExportPanel({
  project,
  previewBackground,
  onBrandNameChange,
  onBack,
}: ExportPanelProps) {
  const [copied, setCopied] = useState(false);
  const [layout, setLayout] = useState<ImageLayout>("sheet");
  const [imageBackground, setImageBackground] = useState<ImageBackground>("preview");
  const [busy, setBusy] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  useEffect(() => {
    loadGoogleFontsFromTypography(project.typography);
    loadCTACustomFonts(project.ctaStyles);
  }, [project.typography, project.ctaStyles]);

  const css = useMemo(() => buildButtonCss(project), [project]);
  const styles = useMemo(() => buildExportedStyles(project), [project]);
  const previewDoc = useMemo(
    () => buildPreviewDocument(project, previewBackground),
    [project, previewBackground],
  );
  const base = exportFileBase(project);
  const background = imageBackground === "preview" ? previewBackground : null;
  const imageCount = styles.length * 2;

  const copyCss = async () => {
    if (await copyTextToClipboard(css)) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    }
  };

  const downloadImages = async () => {
    setBusy(true);
    setImageError(null);
    try {
      const { colors, typography } = project;
      if (layout === "sheet") {
        const title = `${project.brandName.trim() || "Brand"} buttons & links`;
        const blob = await renderButtonSheet(
          styles.map((s) => s.cta),
          colors,
          typography,
          background,
          previewBackground,
          title,
        );
        downloadBlob(blob, `${base}.png`);
      } else {
        const files = [];
        for (const { cta } of styles) {
          for (const state of ["default", "hover"] as const) {
            files.push({
              name: `${slugify(cta.name)}-${state}.png`,
              blob: await renderButtonImage(cta, state, colors, typography, background),
            });
          }
        }
        downloadBlob(await createZip(files), `${base}.zip`);
      }
    } catch {
      setImageError("Couldn't create the images. Try again, or use a different browser.");
    } finally {
      setBusy(false);
    }
  };

  const imagesPanel = (
      <section className="panel export-images" aria-label="Images">
        <div className="panel__head">
          <div>
            <h2 className="panel__title">Images</h2>
            <p className="panel__subtitle">High-resolution PNGs of every default and hover state.</p>
          </div>
        </div>

        <ul className="export-images__list" style={{ backgroundColor: previewBackground }}>
          {styles.map(({ cta }) => (
            <li key={cta.id} className="export-images__row">
              <span className="export-images__name">{cta.name}</span>
              {(["default", "hover"] as const).map((state) => (
                <div key={state} className="export-images__cell">
                  <span className="export-images__state">
                    {state === "default" ? "Default" : "Hover"}
                  </span>
                  <ScaleToFit>
                    <CTAPreview
                      cta={cta}
                      colors={project.colors}
                      typography={project.typography}
                      state={state}
                    />
                  </ScaleToFit>
                </div>
              ))}
            </li>
          ))}
        </ul>

        <div className="export-images__controls">
          <label className="export-images__group export-images__filename">
            <span className="export-images__group-label">Name your files (optional)</span>
            <input
              className="export-images__filename-input"
              value={project.brandName}
              onChange={(e) => onBrandNameChange(e.target.value)}
              placeholder="e.g. Dewberry Studio"
              maxLength={60}
            />
          </label>
          <OptionGroup
            label="Layout"
            value={layout}
            onChange={setLayout}
            options={[
              { value: "sheet", label: "All on one page" },
              { value: "separate", label: "Each button separately" },
            ]}
          />
          <OptionGroup
            label="Background"
            value={imageBackground}
            onChange={setImageBackground}
            options={[
              { value: "preview", label: "Preview color", swatch: previewBackground },
              { value: "transparent", label: "Transparent" },
            ]}
          />
          <div className="export-images__download">
            <button
              type="button"
              className="btn-primary"
              onClick={() => void downloadImages()}
              disabled={!styles.length || busy}
            >
              {busy ? "Creating…" : "Download"}
            </button>
            <span className="export-images__file">
              {layout === "sheet" ? `${base}.png` : `${base}.zip · ${imageCount} PNGs`}
            </span>
          </div>
        </div>
        {imageError && (
          <p className="panel__error" role="alert">
            {imageError}
          </p>
        )}
      </section>
  );

  return (
    <div className="step step--full">
      <header className="step__header">
        <p className="step__eyebrow">Step 4</p>
        <h1 className="step__title">Export</h1>
        <p className="step__lede">
          Test your buttons, copy the CSS to use them on your website, or download images for
          decks, mockups and brand docs.
        </p>
      </header>

      <section className="panel export-preview" aria-label="Live test">
        <div className="panel__head">
          <div>
            <h2 className="panel__title">Live test</h2>
            <p className="panel__subtitle">
              Rendered from the exported CSS only. Hover and tab through to check each state.
            </p>
          </div>
        </div>
        <iframe
          className="export-preview__frame"
          title="Exported buttons preview"
          srcDoc={previewDoc}
          sandbox=""
        />
      </section>

      <div className="export-grid">
        <section className="panel export-code" aria-label="CSS">
          <div className="panel__head">
            <div>
              <h2 className="panel__title">CSS</h2>
              <p className="panel__subtitle">
                Paste into your site stylesheet, Webflow/Shopify custom code, or WordPress
                Additional CSS.
              </p>
            </div>
          </div>
          <pre className="export-code__pre" tabIndex={0}>
            <code>{css}</code>
          </pre>
          <div className="export-code__actions">
            <button type="button" className="btn-primary" onClick={() => void copyCss()}>
              {copied ? "Copied ✓" : "Copy CSS"}
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => downloadTextFile(css, `${base}.css`, "text/css")}
            >
              Download .css
            </button>
          </div>
        </section>

        {imagesPanel}
      </div>

      <footer className="step__footer">
        <button type="button" className="btn-ghost" onClick={onBack}>
          ← Back to buttons
        </button>
      </footer>
    </div>
  );
}
