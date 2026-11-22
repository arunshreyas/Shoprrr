import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import EntryQuickSetupClient from "./EntryQuickSetupClient";

export default async function EntryQuickSetupPage() {
  const session = await getSession();

  if (session?.shopId) {
    redirect("/dashboard");
  }

  return <EntryQuickSetupClient />;
}
