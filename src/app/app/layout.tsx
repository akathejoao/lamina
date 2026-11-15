import { redirect } from "next/navigation";
import { AccountStoreProvider } from "@/lib/store";
import { readSession } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await readSession();
  if (!session) redirect("/entrar");
  return <AccountStoreProvider>{children}</AccountStoreProvider>;
}
