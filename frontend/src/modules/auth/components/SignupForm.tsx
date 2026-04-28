"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { performSignup } from "../api";
import { setStoredSession } from "../session";

export function SignupForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const result = await performSignup(username, email, password);

    if (!result.success || !result.accessToken) {
      setError(result.message || "Unable to create account.");
      setLoading(false);
      return;
    }

    setStoredSession(result.accessToken, result.user || null);
    router.push("/dashboard");
  };

  return (
    <form onSubmit={handleSubmit} className="auth-form">
      <div className="auth-field">
        <label className="auth-form-label" htmlFor="signup-username">
          Username
        </label>
        <input
          className="auth-form-input"
          id="signup-username"
          name="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          placeholder="choose a username"
        />
      </div>

      <div className="auth-field">
        <label className="auth-form-label" htmlFor="signup-email">
          Email
        </label>
        <input
          className="auth-form-input"
          id="signup-email"
          name="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          placeholder="you@example.com"
        />
      </div>

      <div className="auth-field">
        <label className="auth-form-label" htmlFor="signup-password">
          Password
        </label>
        <div className="auth-input-wrap">
          <input
            className="auth-form-input"
            id="signup-password"
            name="password"
            type={showPw ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            placeholder="••••••••"
          />
          <button
            type="button"
            className="auth-eye-btn"
            onClick={() => setShowPw((v) => !v)}
            aria-label={showPw ? "Hide password" : "Show password"}
          >
            {showPw ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {error && <p className="auth-error">{error}</p>}

      <button type="submit" disabled={loading} className="auth-form-button">
        {loading ? (
          <>
            <span className="auth-spinner" aria-hidden="true" />
            Creating account…
          </>
        ) : (
          "Create Account"
        )}
      </button>
    </form>
  );
}