import { LoginForm } from "@/components/auth/LoginForm";

export const metadata = { title: "Sign in · Brightloop" };

export default function LoginPage() {
  return <LoginForm adminDemo="admin@brightloop.test" staffDemo="staff@brightloop.test" customerDemo="customer1@brightloop.test" />;
}
