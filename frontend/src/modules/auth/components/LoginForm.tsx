"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { performLogin } from "../api";
import { setStoredSession } from "../session";

export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const result = await performLogin(username, password);

    if (!result.success || !result.accessToken) {
      setError(result.message || "Invalid credentials.");
      setLoading(false);
      return;
    }

    setStoredSession(result.accessToken, result.user || null);
    router.push("/dashboard");
  };

  return (
    <form onSubmit={handleSubmit} className="auth-form">
      <div className="auth-field">
        <label className="auth-form-label" htmlFor="username">
          Email Address
        </label>
        <div className="auth-input-wrap auth-input-wrap--icon">
          <span className="auth-input-icon" aria-hidden="true">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
              <path d="M4 6.5h16v11H4z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
              <path
                d="m4.5 7 7.5 6 7.5-6"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <input
            className="auth-form-input"
            id="username"
            name="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            placeholder="hero@example.com"
            required
          />
        </div>
      </div>

      <div className="auth-field">
        <div className="auth-label-row">
          <label className="auth-form-label" htmlFor="password">
            Password
          </label>
          <button type="button" className="auth-subtle-link">
            Forgot password?
          </button>
        </div>

        <div className="auth-input-wrap auth-input-wrap--icon">
          <span className="auth-input-icon" aria-hidden="true">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
              <rect x="5" y="10" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.8" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </span>

          <input
            className="auth-form-input"
            id="password"
            name="password"
            type={showPw ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            placeholder="••••••••"
            required
          />

          <button
            type="button"
            className="auth-eye-btn"
            onClick={() => setShowPw((v) => !v)}
            aria-label={showPw ? "Hide password" : "Show password"}
          >
            {showPw ? (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>
      </div>

      <label className="auth-check-row">
        <input checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} type="checkbox" />
        <span>Keep me logged in to the realm</span>
      </label>

      {error && <p className="auth-error">{error}</p>}

      <button type="submit" disabled={loading} className="auth-form-button">
        {loading ? (
          <>
            <span className="auth-spinner" aria-hidden="true" />
            Entering…
          </>
        ) : (
          "Login"
        )}
      </button>
    </form>
  );
}