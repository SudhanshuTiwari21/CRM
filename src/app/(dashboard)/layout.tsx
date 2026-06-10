import { Sidebar } from "@/components/layout/sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/[0.03] via-background to-background">
      <Sidebar />
      <main className="lg:pl-[260px]">
        <div className="mx-auto max-w-[1600px] px-4 py-6 pt-20 lg:px-8 lg:py-8 lg:pt-8">{children}</div>
      </main>
    </div>
  );
}
