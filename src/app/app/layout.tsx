import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-frame";
import { AccountStoreProvider } from "@/lib/store";
import { readSession } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await readSession();
  if (!session) redirect("/entrar");
  return (
    <AccountStoreProvider>
      <AppShell>{children}</AppShell>
    </AccountStoreProvider>
  );
}
