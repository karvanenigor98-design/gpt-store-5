import { redirect } from "next/navigation";

export default function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: { site?: string };
}) {
  const siteParam = searchParams.site;
  const target = siteParam ? `/reset-password?site=${siteParam}` : "/reset-password";
  redirect(target);
}
