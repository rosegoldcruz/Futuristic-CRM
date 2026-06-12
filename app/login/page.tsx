import { isZitadelConfigured } from "@/lib/auth/zitadel-env";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return <LoginForm authConfigured={isZitadelConfigured()} />;
}