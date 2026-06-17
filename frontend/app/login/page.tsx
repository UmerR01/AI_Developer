import "../../src/modules/auth/login.css";
import "../../src/components/AiDeveloperAnimations.css";
import { AuthPage } from "../../src/modules/auth/components/AuthPage";

export const metadata = {
  title: "Sign in to your workspace",
  description: "Login to AI Developer workspace",
};

export default function LoginPage() {
  return <AuthPage initialMode="login" />;
}
