export function downloadTextFile(content: string, filename: string, mime = "text/plain"): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function looksLikeMarkdown(content: string): boolean {
  const trimmed = content.trimStart();
  return (
    trimmed.startsWith("#") ||
    trimmed.startsWith(">") ||
    /^#{1,6}\s/m.test(content) ||
    /^\s*[-*+]\s/m.test(content) ||
    /\*\*[^*]+\*\*/.test(content) ||
    /\[.+\]\(.+\)/.test(content)
  );
}

/** Keep markdown-ish prompts as-is; wrap plain text so the file is a valid .md. */
export function asMarkdownDocument(content: string, fallbackTitle = "Brand prompt"): string {
  const trimmed = content.trim();
  if (!trimmed) return `# ${fallbackTitle}\n`;
  if (looksLikeMarkdown(trimmed)) return trimmed.endsWith("\n") ? trimmed : `${trimmed}\n`;
  return `# ${fallbackTitle}\n\n${trimmed}\n`;
}

export function downloadMarkdownFile(
  content: string,
  filename: string,
  fallbackTitle = "Brand prompt",
): void {
  downloadTextFile(asMarkdownDocument(content, fallbackTitle), filename, "text/markdown");
}

function hasClipboardWriteUserGesture(): boolean {
  return (
    typeof navigator !== "undefined" &&
    "userActivation" in navigator &&
    navigator.userActivation?.isActive === true
  );
}

/** Select + execCommand on a visible input (share URL field). */
export function copyFromInputElement(
  input: HTMLInputElement | HTMLTextAreaElement | null | undefined,
): boolean {
  if (!input || !input.value) return false;
  try {
    input.focus({ preventScroll: true });
    input.select();
    input.setSelectionRange(0, input.value.length);
    return document.execCommand("copy");
  } catch {
    return false;
  }
}

/**
 * Classic execCommand path that survives lost userActivation after async work.
 * Avoid display:none / zero-size / readonly traps that make browsers skip the copy.
 */
function copyWithExecCommand(text: string): boolean {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("aria-hidden", "true");
  // Real on-screen layout box; opacity alone hides it.
  textarea.style.cssText = [
    "position:fixed",
    "top:0",
    "left:0",
    "width:8px",
    "height:8px",
    "padding:0",
    "margin:0",
    "border:0",
    "outline:none",
    "box-shadow:none",
    "background:transparent",
    "opacity:0.01",
    "color:transparent",
    "caret-color:transparent",
    "z-index:2147483647",
    "pointer-events:none",
    "white-space:pre",
  ].join(";");

  document.body.appendChild(textarea);

  try {
    textarea.focus({ preventScroll: true });
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
}

/** contentEditable range selection — backup when bare textareas are rejected. */
function copyWithContentEditable(text: string): boolean {
  const el = document.createElement("div");
  el.textContent = text;
  el.contentEditable = "true";
  el.setAttribute("aria-hidden", "true");
  el.style.cssText = [
    "position:fixed",
    "top:0",
    "left:0",
    "width:auto",
    "height:auto",
    "max-width:80vw",
    "padding:0",
    "margin:0",
    "border:0",
    "opacity:0.01",
    "z-index:2147483647",
    "pointer-events:none",
    "white-space:pre",
    "user-select:text",
    "-webkit-user-select:text",
  ].join(";");

  document.body.appendChild(el);

  try {
    const range = document.createRange();
    range.selectNodeContents(el);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    el.focus();
    const ok = document.execCommand("copy");
    selection?.removeAllRanges();
    return ok;
  } catch {
    return false;
  } finally {
    document.body.removeChild(el);
  }
}

function copyTextSync(text: string, input?: HTMLInputElement | HTMLTextAreaElement | null): boolean {
  if (!text) return false;
  if (copyFromInputElement(input)) return true;
  if (copyWithExecCommand(text)) return true;
  if (copyWithContentEditable(text)) return true;
  return false;
}

/**
 * Copy text without requesting clipboard-read permission.
 * After async work, userActivation is usually dead — prefer execCommand and never
 * call writeText unless a live gesture is still active.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  if (hasClipboardWriteUserGesture() && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through — do not claim Clipboard API works without a gesture.
    }
  }

  return copyTextSync(text);
}

/**
 * Start a clipboard write during the click handler so the user gesture survives
 * an async PDF upload. Call this synchronously from the click callback.
 *
 * Uses ClipboardItem with a delayed Blob when available (gesture-preserving).
 * Always falls back to execCommand / visible input once the URL resolves.
 */
export function copyDeferredToClipboard(
  textPromise: Promise<string | null | undefined>,
  getInput?: () => HTMLInputElement | HTMLTextAreaElement | null | undefined,
): Promise<boolean> {
  let clipboardWrite: Promise<boolean> | null = null;

  // Must construct ClipboardItem synchronously inside the user gesture.
  if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
    try {
      const item = new ClipboardItem({
        "text/plain": textPromise.then((text) => {
          if (!text) throw new Error("Empty share URL");
          return new Blob([text], { type: "text/plain" });
        }),
      });
      clipboardWrite = navigator.clipboard
        .write([item])
        .then(() => true)
        .catch(() => false);
    } catch {
      clipboardWrite = null;
    }
  }

  return (async () => {
    const text = await textPromise;
    if (!text) return false;

    if (clipboardWrite) {
      const ok = await clipboardWrite;
      if (ok) return true;
    }

    // Gesture may still be alive briefly; try writeText, then robust fallbacks.
    if (hasClipboardWriteUserGesture() && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        /* fall through */
      }
    }

    // Let React paint the share URL input before selecting it.
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });

    return copyTextSync(text, getInput?.() ?? null);
  })();
}
