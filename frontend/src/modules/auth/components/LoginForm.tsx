"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { performLogin } from "../api";

export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("ibrahim");
  const [password, setPassword] = useState("Ibrahim@123");
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

    localStorage.setItem("ai_dev_access_token", result.accessToken);
    localStorage.setItem("ai_dev_user", JSON.stringify(result.user || null));
    router.push("/dashboard");
  };

  return (
    <form onSubmit={handleSubmit}>
      <label className="auth-form-label" htmlFor="username">
        Username
      </label>
      <input
        className="auth-form-input"
        id="username"
        name="username"
        value={username}
        onChange={(event) => setUsername(event.target.value)}
        autoComplete="username"
      />

      <label className="auth-form-label" htmlFor="password">
        Password
      </label>
      <input
        className="auth-form-input"
        id="password"
        name="password"
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        autoComplete="current-password"
      />

      {error ? <p className="auth-error">{error}</p> : null}

      <button type="submit" disabled={loading} className="auth-form-button">
        {loading ? "Signing in..." : "Sign in"}
      </button>

      <p className="auth-info">
        Seed credentials: ibrahim / Ibrahim@123
      </p>
    </form>
  );
}
