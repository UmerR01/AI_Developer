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
      <div className={`auth-card${isLogin ? "" : " auth-card--signup"}`}>

        {/* ═══ LEFT PANEL ═══ */}
        <div className={`auth-panel auth-panel--left${isLogin ? " auth-panel--cta" : " auth-panel--form"}`}>
          <div className="auth-panel-grid">

            {/* Signup form (visible when signup active) */}
            <div className={`auth-layer auth-layer--form${!isLogin ? " auth-layer--visible" : ""}`}>
              <AuthBrand />
              <div className="auth-form-head">
                <p className="auth-kicker">Create Account</p>
                <h2 className="auth-form-title">Get started</h2>
                <p className="auth-form-subtitle">Set up your admin workspace in seconds.</p>
              </div>
              <SignupForm />
              <p className="auth-switch-note">
                Already have an account?{" "}
                <button type="button" className="auth-switch-link" onClick={() => setMode("login")}>
                  Sign in
                </button>
              </p>
            </div>

            {/* CTA panel (visible when login active) */}
            <div className={`auth-layer auth-layer--cta${isLogin ? " auth-layer--visible" : ""}`}>
              <div className="auth-cta-inner">
                <h3 className="auth-cta-title">Ready to<br />Join?</h3>
                <p className="auth-cta-body">
                  Signup now and start using your workspace.
                </p>
                <button type="button" className="auth-cta-btn" onClick={() => setMode("signup")}>
                  Go to signup page
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* ═══ DIVIDER ═══ */}
        <div className="auth-divider" aria-hidden="true" />

        {/* ═══ RIGHT PANEL ═══ */}
        <div className={`auth-panel auth-panel--right${isLogin ? " auth-panel--form" : " auth-panel--cta"}`}>
          <div className="auth-panel-grid">

            {/* Login form (visible when login active) */}
            <div className={`auth-layer auth-layer--form${isLogin ? " auth-layer--visible" : ""}`}>
              <AuthBrand />
              <div className="auth-form-head">
                <p className="auth-kicker">Welcome back</p>
                <h2 className="auth-form-title">Sign in</h2>
                <p className="auth-form-subtitle">Access your workspace and continue building.</p>
              </div>
              <LoginForm />
              <p className="auth-switch-note">
                Don&apos;t have an account?{" "}
                <button type="button" className="auth-switch-link" onClick={() => setMode("signup")}>
                  Create one
                </button>
              </p>
            </div>

            {/* CTA panel (visible when signup active) */}
            <div className={`auth-layer auth-layer--cta${!isLogin ? " auth-layer--visible" : ""}`}>
              <div className="auth-cta-inner">
                <h3 className="auth-cta-title">Already a<br />Member?</h3>
                <p className="auth-cta-body">
                  Sign in to your workspace and pick up where you left off.
                </p>
                <button type="button" className="auth-cta-btn" onClick={() => setMode("login")}>
                  Go to sign in
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
      <span className="auth-brand-mark">A</span>
      <span className="auth-brand-text">AI Developer</span>
    </div>
  );
}
