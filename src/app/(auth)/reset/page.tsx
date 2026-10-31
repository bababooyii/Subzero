import { Suspense } from "react";
import { ResetFlow } from "@/components/auth/ResetFlow";

export const metadata = { title: "Reset password · Brightloop" };

export default function ResetPage() {
  return (
    <Suspense fallback={null}>
      <ResetFlow />
    </Suspense>
  );
}
