import { notFound } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { getAirlineProfile } from "@/lib/services/airline.service";
import { getAirlineLogoUrl } from "@/lib/airline-logo";
import { EditAirlineProfileDialog } from "@/components/airlines/edit-airline-profile-dialog";

export default async function AirlineDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const airline = await getAirlineProfile(id);
  if (!airline) notFound();

  const logo = airline.logoUrl || getAirlineLogoUrl(airline.name);

  return (
    <div>
      <Button variant="ghost" size="sm" asChild className="mb-4">
        <Link href="/airlines">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Airlines
        </Link>
      </Button>
      <Header
        title={airline.name}
        description="Airline profile"
        actions={
          <EditAirlineProfileDialog
            airline={{
              id: airline.id,
              name: airline.name,
              iataCode: airline.iataCode,
              logoUrl: airline.logoUrl,
            }}
          />
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Airline details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center gap-3">
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logo}
                  alt=""
                  className="h-14 w-14 rounded border bg-white object-contain p-1"
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded border bg-muted text-xs text-muted-foreground">
                  No logo
                </div>
              )}
              <div>
                <p className="font-semibold">{airline.name}</p>
                <p className="text-muted-foreground">
                  {airline.iataCode ? `IATA ${airline.iataCode}` : "No IATA code"}
                </p>
              </div>
            </div>
            {airline.logoUrl ? (
              <p className="break-all text-xs text-muted-foreground">Logo URL: {airline.logoUrl}</p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Bookings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {airline.recentBookings.length === 0 ? (
              <p className="text-sm text-muted-foreground">No bookings yet.</p>
            ) : (
              airline.recentBookings.map((fb) => (
                <Link
                  key={fb.id}
                  href={`/bookings/${fb.booking.id}`}
                  className="block rounded border p-3 text-sm hover:bg-muted/50"
                >
                  <p className="font-medium">{fb.booking.publicRef}</p>
                  <p className="text-muted-foreground">
                    {fb.booking.customer.name} • {formatDateTime(fb.booking.createdAt)}
                  </p>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
