import { Sidebar } from "@/components/dashboard/sidebar";
import { getUser } from "@/lib/supabase/server";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  let userEmail: string | null = null;
  try {
    const user = await getUser();
    userEmail = user?.email ?? null;
  } catch {
    // Sin config de Supabase Auth
  }

  return (
    <div className="min-h-screen md:pl-64">
      <Sidebar userEmail={userEmail} />
      <main className="min-h-screen bg-zinc-950">{children}</main>
    </div>
  );
}
