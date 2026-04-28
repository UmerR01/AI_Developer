import "../../src/modules/auth/login.css";
import { AuthPage } from "../../src/modules/auth/components/AuthPage";

export const metadata = {
  title: "Create admin account",
  description: "Signup for AI Developer workspace",
};

export default function SignupPage() {
  return <AuthPage initialMode="signup" />;
}