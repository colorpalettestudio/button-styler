export type StepId = "colors" | "fonts" | "buttons" | "export";

export const STEPS: { id: StepId; label: string }[] = [
  { id: "colors", label: "Brand colors" },
  { id: "fonts", label: "Fonts" },
  { id: "buttons", label: "Buttons & links" },
  { id: "export", label: "Export" },
];

interface SidebarProps {
  activeStep: StepId;
  completed: Record<StepId, boolean>;
  lastSavedAt: Date | null;
  onStepChange: (step: StepId) => void;
}

export default function Sidebar({
  activeStep,
  completed,
  lastSavedAt,
  onStepChange,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <header className="sidebar-header">
        <div className="sidebar-brand">
          <h1 className="sidebar-title">
            <span className="sidebar-title__line">Button</span>
            <span className="sidebar-title__line">Styler</span>
          </h1>
        </div>
      </header>

      <nav className="sidebar-nav" aria-label="Steps">
        {STEPS.map((step, index) => {
          const isActive = step.id === activeStep;
          const isComplete = completed[step.id] && !isActive;
          return (
            <button
              key={step.id}
              type="button"
              className={`nav-item${isActive ? " active" : ""}${isComplete ? " nav-item--complete" : ""}`}
              onClick={() => onStepChange(step.id)}
              aria-current={isActive ? "step" : undefined}
            >
              <span className="nav-item__step">{isComplete ? "✓" : index + 1}</span>
              <span className="nav-item__text">
                <span className="nav-label">{step.label}</span>
              </span>
            </button>
          );
        })}
      </nav>

      <footer className="sidebar-footer">
        <p className="sidebar-save">
          <span className="sidebar-save__dot" aria-hidden="true" />
          {lastSavedAt
            ? `Autosaved ${lastSavedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
            : "Autosave on"}
        </p>
      </footer>
    </aside>
  );
}
