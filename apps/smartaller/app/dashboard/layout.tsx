import { Sidebar } from "@/components/dashboard/sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen md:pl-64">
      <Sidebar />
      <main className="min-h-screen bg-zinc-950">{children}</main>
    </div>
  );
}
