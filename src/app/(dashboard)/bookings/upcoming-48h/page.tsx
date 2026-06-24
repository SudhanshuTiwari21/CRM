import { Header } from "@/components/layout/header";
import { Upcoming48hTable } from "@/components/booking/upcoming-48h-table";

export default function Upcoming48hPage() {
  return (
    <div>
      <Header
        title="Travelling within 48 hrs"
        description="All flight bookings departing in the next 48 hours. Check-in assistance bookings trigger admin alerts."
      />
      <Upcoming48hTable />
    </div>
  );
}
