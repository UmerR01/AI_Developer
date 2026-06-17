"use client";

import { useEffect, useState } from "react";
import { LoginForm } from "./LoginForm";
import { SignupForm } from "./SignupForm";
import { AuthLottie } from "./AuthLottie";

type Mode = "login" | "signup";

interface AuthPageProps {
  initialMode?: Mode;
}

const heroSlides = [
  {
    kicker: "AI DEVELOPER WORKSPACE",
    title: "Create projects faster",
    body: "Start a new build from the dashboard and let your AI developer prepare the workspace instantly.",
  },
  {
    kicker: "AI CHAT BUILDER",
    title: "Prompt your AI developer",
    body: "Type what you want to build, send it, and guide each change through a focused chat workflow.",
  },
  {
    kicker: "GENERATED FILES",
    title: "Ship from done states",
    body: "Watch generated files complete with clear status updates so you know exactly when the build is ready.",
  },
];

const heroSlideDurations = [2700, 3400, 3600];

export function AuthPage({ initialMode = "login" }: AuthPageProps) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [activeHeroIndex, setActiveHeroIndex] = useState(0);

  const isLogin = mode === "login";
  const activeHero = heroSlides[activeHeroIndex];

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setActiveHeroIndex((current) => (current + 1) % heroSlides.length);
    }, heroSlideDurations[activeHeroIndex] ?? 3600);

    return () => window.clearTimeout(timeout);
  }, [activeHeroIndex]);

  return (
    <main className="auth-root">
      <section className="auth-shell" aria-label="Authentication">
        <aside className="auth-visual-panel" aria-hidden="true">
          <div className="auth-brand auth-brand--visual">
            <span className="auth-brand-mark">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M5 19L19 5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
                <path
                  d="M8 5H19V16"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path d="M5 8L8 5M16 19L19 16" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
              </svg>
            </span>
            <span className="auth-brand-text">AI Developer</span>
          </div>

          <div className="auth-scene">
            <AuthLottie activeIndex={activeHeroIndex} />
            <div className="auth-scene-glow" />
            <div className="auth-scene-mountains" />
          </div>

          <div className="auth-hero-copy" key={activeHero.title}>
            <p className="auth-type-kicker">{activeHero.kicker}</p>

            <h1 className="auth-type-title">
              <span className="auth-typewriter" key={activeHero.title}>
                <span className="auth-typewriter-text">{activeHero.title}</span>
              </span>
            </h1>

            <p>{activeHero.body}</p>
          </div>

          <div className="auth-hero-dots" aria-hidden="true">
            {heroSlides.map((slide, index) => (
              <button
                key={slide.title}
                type="button"
                className={index === activeHeroIndex ? "is-active" : ""}
                onClick={() => setActiveHeroIndex(index)}
                aria-label={`Show ${slide.title}`}
              />
            ))}
          </div>
        </aside>

        <section className="auth-form-panel">
          <div className="auth-form-card">
            <div className="auth-mobile-brand">
              <span className="auth-brand-mark">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M5 19L19 5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
                  <path
                    d="M8 5H19V16"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path d="M5 8L8 5M16 19L19 16" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
                </svg>
              </span>
              <span className="auth-brand-text">AI Developer</span>
            </div>

            <div className="auth-form-head">
              <h2 className="auth-form-title">{isLogin ? "Welcome Back" : "Create Account"}</h2>
              <p className="auth-form-subtitle">
                {isLogin ? "Ready to continue your quest?" : "Join the realm and start your journey."}
              </p>
            </div>

            <div
              className={isLogin ? "auth-tabs" : "auth-tabs auth-tabs--signup"}
              role="tablist"
              aria-label="Authentication mode"
            >
              <button
                type="button"
                role="tab"
                aria-selected={isLogin}
                className={isLogin ? "auth-tab auth-tab--active" : "auth-tab"}
                onClick={() => setMode("login")}
              >
                Login
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={!isLogin}
                className={!isLogin ? "auth-tab auth-tab--active" : "auth-tab"}
                onClick={() => setMode("signup")}
              >
                Sign Up
              </button>
            </div>

            <div className="auth-form-stack">
              <div className={isLogin ? "auth-form-layer auth-form-layer--active" : "auth-form-layer"}>
                <LoginForm />
              </div>

              <div className={!isLogin ? "auth-form-layer auth-form-layer--active" : "auth-form-layer"}>
                <SignupForm />
              </div>
            </div>

            <div className="auth-social-divider">
              <span />
              <p>OR CONTINUE WITH</p>
              <span />
            </div>

            <div className="auth-social-row">
              <button type="button" className="auth-social-btn" aria-label="Continue with Google">
                <span className="auth-social-icon auth-social-icon--google" aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 24 24">
                    <path
                      fill="#EA4335"
                      d="M12 10.2v3.9h5.4c-.24 1.26-.96 2.33-2.04 3.04l3.3 2.56c1.92-1.77 3.03-4.38 3.03-7.49 0-.71-.06-1.39-.18-2.01H12Z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 22c2.7 0 4.96-.9 6.61-2.44l-3.3-2.56c-.91.61-2.07.97-3.31.97-2.54 0-4.69-1.71-5.46-4.01l-3.42 2.64C4.77 19.86 8.11 22 12 22Z"
                    />
                    <path
                      fill="#4A90E2"
                      d="M6.54 13.96a6 6 0 0 1 0-3.82L3.12 7.5a10 10 0 0 0 0 9.1l3.42-2.64Z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M12 6.03c1.47 0 2.78.51 3.82 1.5l2.87-2.87C16.95 3.05 14.69 2 12 2 8.11 2 4.77 4.14 3.12 7.5l3.42 2.64c.77-2.3 2.92-4.11 5.46-4.11Z"
                    />
                  </svg>
                </span>
                Google
              </button>

              <button type="button" className="auth-social-btn" aria-label="Continue with GitHub">
                <span className="auth-social-icon auth-social-icon--github" aria-hidden="true">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 .5A11.5 11.5 0 0 0 8.36 22.9c.58.11.79-.25.79-.56v-2.02c-3.22.7-3.9-1.38-3.9-1.38-.53-1.33-1.29-1.69-1.29-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.2 1.77 1.2 1.04 1.76 2.72 1.25 3.38.96.1-.75.4-1.25.73-1.54-2.57-.29-5.28-1.29-5.28-5.72 0-1.26.45-2.3 1.19-3.11-.12-.29-.52-1.47.11-3.07 0 0 .98-.31 3.18 1.19A10.98 10.98 0 0 1 12 6.07c.98 0 1.96.13 2.88.39 2.2-1.5 3.17-1.19 3.17-1.19.64 1.6.24 2.78.12 3.07.74.81 1.18 1.85 1.18 3.11 0 4.45-2.71 5.43-5.29 5.72.42.36.79 1.08.79 2.18v3c0 .31.21.68.8.56A11.5 11.5 0 0 0 12 .5Z" />
                  </svg>
                </span>
                GitHub
              </button>
            </div>

            <p className="auth-switch-note">
              {isLogin ? "Don’t have a character yet?" : "Already have an account?"}{" "}
              <button
                type="button"
                className="auth-switch-link"
                onClick={() => setMode(isLogin ? "signup" : "login")}
              >
                {isLogin ? "Create Account" : "Login"}
              </button>
            </p>
          </div>

          <p className="auth-panel-footer">© 2026 Developer</p>
        </section>
      </section>
    </main>
  );
}
