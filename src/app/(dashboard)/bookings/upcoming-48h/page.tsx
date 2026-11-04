import { Header } from "@/components/layout/header";
import { Upcoming48hTable } from "@/components/booking/upcoming-48h-table";

export default function Upcoming48hPage() {
  return (
    <div>
      <Header
        title="Travelling within 48 hrs"
        description="Flights departing and hotel check-ins in the next 48 hours. Flight check-in assistance bookings trigger admin alerts."
      />
      <Upcoming48hTable />
    </div>
  );
}
