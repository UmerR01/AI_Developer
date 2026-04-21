import { LoginForm } from "../../src/modules/auth/components/LoginForm";
import "../../src/modules/auth/login.css";

export default function LoginPage() {
  return (
    <main className="auth-page-wrap">
      <section className="auth-panel">
        <h1 className="auth-title">AI-Developer Login</h1>
        <p className="auth-subtitle">Sign in to access your workspace demo.</p>
        <LoginForm />
      </section>
    </main>
  );
}
