import "../../src/modules/auth/login.css";
import "../../src/components/AiDeveloperAnimations.css";
import { AuthPage } from "../../src/modules/auth/components/AuthPage";

export const metadata = {
  title: "Sign in or create account",
  description: "Unified authentication page for AI Developer workspace",
};

export default function UnifiedAuthPage() {
  return <AuthPage initialMode="login" />;
}
