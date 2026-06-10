import { redirect } from "next/navigation";
import { isAuthDisabled } from "@/lib/auth-bypass";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  if (isAuthDisabled()) {
    redirect("/dashboard");
  }

  return <LoginForm />;
}
