import { Header } from "@/components/layout/header";
import { ReportsDashboard } from "@/components/reports/reports-dashboard";

export default function ReportsPage() {
  return (
    <div>
      <Header title="Reports" description="Revenue, agent performance, and processing SLA metrics" />
      <ReportsDashboard />
    </div>
  );
}
