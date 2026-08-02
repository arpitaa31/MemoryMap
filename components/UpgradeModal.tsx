"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { linkCurrentUserToGoogle } from "../lib/auth/google";
import { useAuth } from "../app/providers/AuthProvider";

function getLinkErrorMessage(error: unknown) {
  const code = typeof error === "object" && error !== null && "code" in error && typeof error.code === "string" ? error.code : "";
  if (code === "auth/credential-already-in-use" || code === "auth/email-already-in-use") {
    return "That Google account already has a MemoryMap account. Your guest campus is still here; sign out and use that account to continue.";
  }
  if (code === "auth/popup-closed-by-user") return "Google sign-in was cancelled.";
  if (code === "auth/popup-blocked") return "Allow pop-ups in your browser to continue with Google.";
  return "We could not upgrade this guest session. Your guest campus is still safe here. Please try again.";
}

export default function UpgradeModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { user } = useAuth();
  const [message, setMessage] = useState("");
  const [linking, setLinking] = useState(false);

  if (!user?.isAnonymous) return null;

  const linkGoogle = async () => {
    setMessage("");
    setLinking(true);
    try {
      await linkCurrentUserToGoogle(user);
      onClose();
      router.refresh();
    } catch (error) {
      setMessage(getLinkErrorMessage(error));
    } finally {
      setLinking(false);
    }
  };

  return (
    <div className="mm-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !linking) onClose(); }}>
      <div className="mm-create-modal mm-upgrade-modal" role="dialog" aria-modal="true" aria-labelledby="upgrade-modal-title">
        <p className="mm-eyebrow mm-eyebrow--ochre">Guest mode</p>
        <h2 id="upgrade-modal-title">Save and share your MemoryMap</h2>
        <p>Continue with Google to keep your campus, upload photos and invite friends.</p>
        {message && <p className="mm-auth-message mm-auth-message--error" role="alert">{message}</p>}
        <div className="mm-create-modal__actions">
          <button type="button" className="mm-button mm-button--outline" onClick={onClose} disabled={linking}>Not now</button>
          <button type="button" className="mm-button mm-button--coral" onClick={() => void linkGoogle()} disabled={linking}>{linking ? "Connecting…" : "Continue with Google"}</button>
        </div>
      </div>
    </div>
  );
}
