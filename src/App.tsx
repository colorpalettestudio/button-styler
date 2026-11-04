import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  ApprovedColorPairing,
  BrandColor,
  ButtonStylerProject,
  CTAStyleDefinition,
  TypographyStyle,
} from "./types";
import ButtonsPanel from "./components/ButtonsPanel";
import ColorsPanel from "./components/ColorsPanel";
import ExportPanel from "./components/ExportPanel";
import FontsPanel from "./components/FontsPanel";
import Sidebar, { STEPS, type StepId } from "./components/Sidebar";
import { remapCtaColorsAfterPaletteChange } from "./utils/colorResolve";
import { assignColorRoles } from "./utils/colorRoles";
import { computeAccessiblePairings } from "./utils/ctaResolve";
import { loadProject, saveProject } from "./utils/projectStorage";
import "./App.css";
import "./panels.css";

const SAVE_DEBOUNCE_MS = 300;

function stepFromHash(): StepId {
  const hash = window.location.hash.replace("#", "");
  return STEPS.some((s) => s.id === hash) ? (hash as StepId) : "colors";
}

function defaultPreviewBackground(colors: BrandColor[]): string {
  return colors.find((c) => c.role === "light-neutral")?.hex ?? "#FFFFFF";
}

export default function App() {
  const [project, setProject] = useState<ButtonStylerProject>(loadProject);
  const [step, setStep] = useState<StepId>(stepFromHash);
  const [visited, setVisited] = useState<Set<StepId>>(() => new Set([stepFromHash()]));
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [previewBackground, setPreviewBackground] = useState(() =>
    defaultPreviewBackground(project.colors),
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (saveProject(project)) setLastSavedAt(new Date());
    }, SAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [project]);

  useEffect(() => {
    const onHashChange = () => setStep(stepFromHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const goTo = useCallback((next: StepId) => {
    setVisited((prev) => new Set(prev).add(next));
    setStep(next);
    if (window.location.hash !== `#${next}`) {
      window.history.replaceState(null, "", `#${next}`);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const update = useCallback(
    (updater: (prev: ButtonStylerProject) => ButtonStylerProject) =>
      setProject((prev) => ({ ...updater(prev), updatedAt: new Date().toISOString() })),
    [],
  );

  const handleColorsChange = useCallback(
    (nextColors: BrandColor[], favoritePairings?: ApprovedColorPairing[]) =>
      update((prev) => {
        const colors = assignColorRoles(nextColors);
        const ids = new Set(colors.map((c) => c.id));
        return {
          ...prev,
          colors,
          favoritePairings: (favoritePairings ?? prev.favoritePairings).filter(
            (p) => ids.has(p.textColorId) && ids.has(p.backgroundColorId),
          ),
          ctaStyles: remapCtaColorsAfterPaletteChange(prev.colors, colors, prev.ctaStyles),
        };
      }),
    [update],
  );

  const pairings = useMemo(
    () =>
      project.favoritePairings.length
        ? project.favoritePairings
        : computeAccessiblePairings(project.colors),
    [project.colors, project.favoritePairings],
  );

  const handleTypographyChange = useCallback(
    (typography: TypographyStyle[]) =>
      update((prev) => {
        const ids = new Set(typography.map((t) => t.id));
        const fallbackId = typography[0]?.id;
        return {
          ...prev,
          typography,
          ctaStyles: prev.ctaStyles.map((style) =>
            fallbackId && !ids.has(style.typographyStyleId ?? "")
              ? { ...style, typographyStyleId: fallbackId }
              : style,
          ),
        };
      }),
    [update],
  );

  const handleStylesChange = useCallback(
    (ctaStyles: CTAStyleDefinition[]) => update((prev) => ({ ...prev, ctaStyles })),
    [update],
  );

  const completed: Record<StepId, boolean> = {
    colors: visited.has("fonts") && project.colors.length > 0,
    fonts: visited.has("buttons"),
    buttons: visited.has("export") && project.ctaStyles.length > 0,
    export: false,
  };

  return (
    <div className="app">
      <div className="app__body">
        <Sidebar
          activeStep={step}
          completed={completed}
          lastSavedAt={lastSavedAt}
          onStepChange={goTo}
        />

        <main className="main">
          {step === "colors" && (
            <ColorsPanel
              colors={project.colors}
              onColorsChange={handleColorsChange}
              onContinue={() => goTo("fonts")}
            />
          )}
          {step === "fonts" && (
            <FontsPanel
              typography={project.typography}
              onTypographyChange={handleTypographyChange}
              onContinue={() => goTo("buttons")}
              onBack={() => goTo("colors")}
            />
          )}
          {step === "buttons" && (
            <ButtonsPanel
              ctaStyles={project.ctaStyles}
              colors={project.colors}
              typography={project.typography}
              approvedPairings={pairings}
              pairingsAreFavorites={project.favoritePairings.length > 0}
              previewBackground={previewBackground}
              onPreviewBackgroundChange={setPreviewBackground}
              onStylesChange={handleStylesChange}
              onContinue={() => goTo("export")}
              onBack={() => goTo("fonts")}
            />
          )}
          {step === "export" && (
            <ExportPanel
              project={project}
              previewBackground={previewBackground}
              onBrandNameChange={(brandName) => update((prev) => ({ ...prev, brandName }))}
              onBack={() => goTo("buttons")}
            />
          )}
        </main>
      </div>
    </div>
  );
}
