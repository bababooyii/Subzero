import { LoginForm } from "@/components/auth/LoginForm";
import { customerEmails, portalCustomer } from "@/lib/mock/selectors-portal";
import { listUsers } from "@/lib/mock/selectors";

export const metadata = { title: "Sign in · Brightloop" };

export default function LoginPage() {
  const staff = listUsers().find((u) => u.role === "staff") ?? listUsers()[0];
  return <LoginForm customerEmails={customerEmails()} staffDemo={staff.email} customerDemo={portalCustomer().email} />;
}
