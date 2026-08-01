"use client";

import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { assertFirebaseConfig, auth } from "../../lib/firebase/client";
import { useAuth } from "../providers/AuthProvider";

function getGoogleErrorMessage(error: unknown) {
  const code = typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
    ? error.code
    : "";

  switch (code) {
    case "auth/popup-closed-by-user":
      return "Google sign-in was cancelled.";
    case "auth/popup-blocked":
      return "Allow pop-ups in your browser to continue with Google.";
    case "auth/cancelled-popup-request":
      return "Another sign-in window is already open.";
    case "auth/network-request-failed":
      return "We could not connect. Check your internet connection.";
    case "auth/unauthorized-domain":
      return "This website domain is not authorised for Google sign-in.";
    case "auth/account-exists-with-different-credential":
      return "An account already exists with this email using another sign-in method.";
    default:
      return "We could not sign you in with Google. Please try again.";
  }
}

export default function LoginForm() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [loading, router, user]);

  const handleGoogleSignIn = async () => {
    setMessage("");
    setIsSubmitting(true);

    try {
      assertFirebaseConfig();
      if (!auth) throw new Error("Firebase authentication is unavailable.");
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      await signInWithPopup(auth, provider);
      router.replace("/dashboard");
    } catch (error) {
      setMessage(getGoogleErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <p className="mm-login-auth-state" role="status" aria-live="polite">Checking your session…</p>;
  }

  if (user) {
    return <p className="mm-login-auth-state" role="status" aria-live="polite">Taking you to your dashboard…</p>;
  }

  return (
    <div className="mm-login-form">
      <button type="button" className="mm-google-button" onClick={handleGoogleSignIn} disabled={isSubmitting}>
        <svg className="mm-google-mark" aria-hidden="true" viewBox="0 0 24 24" focusable="false">
          <path fill="#4285F4" d="M21.35 12.27c0-.78-.07-1.54-.22-2.27H12v4.3h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.69 2.91-4.18 2.91-7.42Z" />
          <path fill="#34A853" d="M12 21.9c2.63 0 4.84-.87 6.45-2.36l-3.14-2.45c-.87.58-1.98.92-3.31.92-2.54 0-4.69-1.72-5.46-4.03H3.3v2.53A9.75 9.75 0 0 0 12 21.9Z" />
          <path fill="#FBBC05" d="M6.54 13.98a5.86 5.86 0 0 1 0-3.96V7.49H3.3a9.76 9.76 0 0 0 0 9.02l3.24-2.53Z" />
          <path fill="#EA4335" d="M12 5.99c1.43 0 2.72.49 3.73 1.45l2.8-2.8C16.83 3.08 14.63 2.1 12 2.1a9.75 9.75 0 0 0-8.7 5.39l3.24 2.53C7.31 7.71 9.46 5.99 12 5.99Z" />
        </svg>
        {isSubmitting ? "Connecting…" : "Continue with Google"}
      </button>
      <p className="mm-login-privacy">By continuing, you agree to use MemoryMap only for campuses and memories you are authorised to access.</p>
      <Link href="/" className="mm-login-back">Back to home</Link>
      <p className="mm-login-message" role={message ? "alert" : undefined} aria-live="polite">{message}</p>
    </div>
  );
}
