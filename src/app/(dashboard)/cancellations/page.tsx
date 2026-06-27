import { Header } from "@/components/layout/header";
import { CancellationsTable } from "@/components/booking/cancellations-table";

export default function CancellationsPage() {
  return (
    <div>
      <Header
        title="Cancellations"
        description="Flight and hotel cancellations with B2B and B2C refund breakup"
      />
      <CancellationsTable />
    </div>
  );
}
