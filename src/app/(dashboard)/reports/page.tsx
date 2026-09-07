import { Header } from "@/components/layout/header";
import { ReportsDashboard } from "@/components/reports/reports-dashboard";

export default function ReportsPage() {
  return (
    <div>
      <Header
        title="Reports"
        description="Cash sales ratio, monthly/quarterly/yearly sales, agent performance"
      />
      <ReportsDashboard />
    </div>
  );
}
