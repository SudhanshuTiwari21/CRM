import { Header } from "@/components/layout/header";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { listAirlineCatalog } from "@/lib/services/airline.service";
import { getAirlineLogoUrl } from "@/lib/airline-logo";
import { AddAirlineProfileDialog } from "@/components/airlines/add-airline-profile-dialog";
import { EditAirlineProfileDialog } from "@/components/airlines/edit-airline-profile-dialog";

export default async function AirlinesPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const { search } = await searchParams;
  const airlines = await listAirlineCatalog(search);

  return (
    <div>
      <Header
        title="Airlines"
        description="Saved airline profiles — auto-fill when booking"
        actions={<AddAirlineProfileDialog />}
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Airlines ({airlines.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {airlines.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No airline profiles yet. Use Add airline, or create a flight booking to save one automatically.
            </p>
          ) : (
            airlines.map((airline) => {
              const logo = airline.logoUrl || getAirlineLogoUrl(airline.name);
              return (
                <div
                  key={airline.id}
                  className="flex flex-col gap-2 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-3">
                    {logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={logo}
                        alt=""
                        className="h-10 w-10 rounded border bg-white object-contain p-1"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded border bg-muted text-[10px] text-muted-foreground">
                        {airline.iataCode || "—"}
                      </div>
                    )}
                    <div>
                      <p className="font-semibold">{airline.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {[airline.iataCode ? `IATA ${airline.iataCode}` : null]
                          .filter(Boolean)
                          .join(" • ") || "No IATA code"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      {airline.bookingCount} booking(s)
                    </span>
                    <EditAirlineProfileDialog
                      airline={{
                        id: airline.id,
                        name: airline.name,
                        iataCode: airline.iataCode,
                        logoUrl: airline.logoUrl,
                      }}
                    />
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/airlines/${airline.id}`}>View</Link>
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
