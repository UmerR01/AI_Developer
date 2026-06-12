"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { performSignup } from "../api";
import { setStoredSession } from "../session";

const roleOptions = ["Student", "Developer", "Startup Founder", "Company", "Designer"];

export function SignupForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
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
        <div className="auth-input-wrap auth-input-wrap--icon">
          <span className="auth-input-icon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M20 21a8 8 0 0 0-16 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="1.8" />
            </svg>
          </span>
          <input
            className="auth-form-input"
            id="signup-username"
            name="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            placeholder="new explorer"
            required
          />
        </div>
      </div>

      <div className="auth-field">
        <label className="auth-form-label" htmlFor="signup-email">
          Email Address
        </label>
        <div className="auth-input-wrap auth-input-wrap--icon">
          <span className="auth-input-icon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
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
            id="signup-email"
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="hero@example.com"
            required
          />
        </div>
      </div>

      <div className="auth-field">
        <label className="auth-form-label" htmlFor="signup-role">
          Role
        </label>
        <div className="auth-input-wrap auth-input-wrap--icon auth-select-wrap">
          <span className="auth-input-icon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M4 7h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M4 12h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M4 17h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </span>

          <select
            className="auth-form-input auth-form-select"
            id="signup-role"
            name="role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            required
          >
            <option value="" disabled>
              Select your role
            </option>
            {roleOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="auth-field">
        <label className="auth-form-label" htmlFor="signup-password">
          Password
        </label>
        <div className="auth-input-wrap auth-input-wrap--icon">
          <span className="auth-input-icon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <rect x="5" y="10" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.8" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </span>

          <input
            className="auth-form-input"
            id="signup-password"
            name="password"
            type={showPw ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
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
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
            Creating…
          </>
        ) : (
          "Create Account"
        )}
      </button>
    </form>
  );
}