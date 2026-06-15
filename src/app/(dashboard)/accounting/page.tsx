import { Header } from "@/components/layout/header";
import { AccountingDashboard } from "@/components/accounting/accounting-dashboard";

export default function AccountingPage() {
  return (
    <div>
      <Header
        title="Accounting"
        description="B2B ITC and B2C ticket-wise GST bills — export to Tally"
      />
      <AccountingDashboard />
    </div>
  );
}
