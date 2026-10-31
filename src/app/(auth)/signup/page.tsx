import { SignupForm } from "@/components/auth/SignupForm";
import { registeredEmails } from "@/lib/mock/selectors-portal";

export const metadata = { title: "Create account · Brightloop" };

export default function SignupPage() {
  return <SignupForm registeredEmails={registeredEmails()} />;
}
