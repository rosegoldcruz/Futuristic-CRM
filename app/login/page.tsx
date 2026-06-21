import { LoginForm } from "./login-form";

export default function LoginPage({
  searchParams,
}: {
  searchParams?: { callbackUrl?: string };
}) {
  return <LoginForm callbackUrl={searchParams?.callbackUrl} />;
}
