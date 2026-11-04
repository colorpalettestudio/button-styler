import { createPortal } from "react-dom";

export default function LocalFontPermissionOverlay() {
  return createPortal(
    <div
      className="local-font-permission-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="local-font-permission-message"
    >
      <div className="local-font-permission-overlay__scrim" aria-hidden="true" />
      <p id="local-font-permission-message" className="local-font-permission-overlay__message">
        Click <strong>Allow</strong> in the browser prompt above to use your computer fonts.
      </p>
    </div>,
    document.body,
  );
}
