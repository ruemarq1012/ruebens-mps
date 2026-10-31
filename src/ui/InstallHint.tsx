import { useState } from "react";
import { Icon } from "./bits";

const KEY = "mps-install-hint-dismissed";

/** A one-time nudge to add the app to the home screen when it's opened in a browser tab. */
export function InstallHint() {
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone;
  const [hidden, setHidden] = useState(() => {
    try {
      return !!localStorage.getItem(KEY);
    } catch {
      return false;
    }
  });
  if (standalone || hidden) return null;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* ignore */
    }
  };
  return (
    <aside className="install-hint">
      <Icon name="share" />
      <p>
        {ios ? (
          <>
            Make it an app: tap <b>Share</b>, then <b>Add to Home Screen</b>.
          </>
        ) : (
          <>
            Make it an app: open your browser menu and choose <b>Install app</b>{" "}
            or <b>Add to Home screen</b>.
          </>
        )}
      </p>
      <button className="icon-btn" onClick={dismiss} aria-label="Dismiss">
        <Icon name="close" size={18} />
      </button>
    </aside>
  );
}
