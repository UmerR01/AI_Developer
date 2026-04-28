"use client";

import { useState } from "react";
import { LoginForm } from "./LoginForm";
import { SignupForm } from "./SignupForm";

type Mode = "login" | "signup";

interface AuthPageProps {
  initialMode?: Mode;
}

export function AuthPage({ initialMode = "login" }: AuthPageProps) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const isLogin = mode === "login";

  return (
    <div className="auth-root">

      {/* ── Animated background blobs ───────────────────────── */}
      <div className="auth-bg" aria-hidden="true">
        <span className="auth-blob auth-blob--a" />
        <span className="auth-blob auth-blob--b" />
        <span className="auth-blob auth-blob--c" />
        <span className="auth-blob auth-blob--d" />
        {/* Subtle grid / noise overlay */}
        <span className="auth-grid-overlay" />
      </div>

      {/* ── Main split card ─────────────────────────────────── */}
      <div className={`auth-card${isLogin ? "" : " auth-card--signup"}`}>

        {/* ════ LEFT PANEL ════════════════════════════════════ */}
        <div className={`auth-panel auth-panel--left${isLogin ? " auth-panel--glass" : " auth-panel--solid"}`}>
          <div className="auth-panel-grid">

            {/* Form layer — signup (shown when signup active) */}
            <div className={`auth-layer auth-layer--form${!isLogin ? " auth-layer--visible" : ""}`}>
              <AuthBrand />
              <div className="auth-form-head">
                <p className="auth-kicker">SIGNUP</p>
                <h2 className="auth-form-title">Create Account</h2>
              </div>
              <SignupForm />
              <p className="auth-switch-note">
                Already have an account?{" "}
                <button type="button" className="auth-switch-link" onClick={() => setMode("login")}>
                  Sign in
                </button>
              </p>
            </div>

            {/* Glass layer — CTA (shown when login active) */}
            <div className={`auth-layer auth-layer--glass${isLogin ? " auth-layer--visible" : ""}`}>
              <div className="auth-glass-inner auth-glass-inner--compact">
                <span className="auth-eyebrow">NEW USER?</span>
                <h3 className="auth-glass-title auth-glass-title--sm">
                  Ready to<br />Join?
                </h3>
                <p className="auth-glass-body">
                  Signup now and start using your workspace.
                </p>
                <button
                  type="button"
                  className="auth-glass-cta"
                  onClick={() => setMode("signup")}
                >
                  <span>Go to signup page</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* ════ DIVIDER ════════════════════════════════════════ */}
        <div className="auth-divider" aria-hidden="true" />

        {/* ════ RIGHT PANEL ═══════════════════════════════════ */}
        <div className={`auth-panel auth-panel--right${isLogin ? " auth-panel--solid" : " auth-panel--glass"}`}>
          <div className="auth-panel-grid">

            {/* Form layer — login (shown when login active) */}
            <div className={`auth-layer auth-layer--form${isLogin ? " auth-layer--visible" : ""}`}>
              <AuthBrand />
              <div className="auth-form-head">
                <p className="auth-kicker">LOGIN</p>
                <h2 className="auth-form-title">Welcome back</h2>
                <p className="auth-form-subtitle">
                  Sign in to access your workspace demo.
                </p>
              </div>
              <LoginForm />
              <p className="auth-switch-note">
                Need a new admin account?{" "}
                <button type="button" className="auth-switch-link" onClick={() => setMode("signup")}>
                  Open the signup page.
                </button>
              </p>
            </div>

            {/* Glass layer — CTA (shown when signup active) */}
            <div className={`auth-layer auth-layer--glass${!isLogin ? " auth-layer--visible" : ""}`}>
              <div className="auth-glass-inner auth-glass-inner--compact">
                <span className="auth-eyebrow">EXISTING USER?</span>
                <h3 className="auth-glass-title auth-glass-title--sm">
                  Already a<br />member?
                </h3>
                <p className="auth-glass-body">
                  Return to an existing workspace session and sign in with your credentials.
                </p>
                <button
                  type="button"
                  className="auth-glass-cta"
                  onClick={() => setMode("login")}
                >
                  <span>Go to login page</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}

function AuthBrand() {
  return (
    <div className="auth-brand">
      {/* 2×2 grid logo mark */}
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <rect x="0"  y="0"  width="9" height="9" rx="2.5" fill="currentColor" opacity="1" />
        <rect x="13" y="0"  width="9" height="9" rx="2.5" fill="currentColor" opacity="0.55" />
        <rect x="0"  y="13" width="9" height="9" rx="2.5" fill="currentColor" opacity="0.55" />
        <rect x="13" y="13" width="9" height="9" rx="2.5" fill="currentColor" opacity="1" />
      </svg>
      <span>AI Developer</span>
    </div>
  );
}