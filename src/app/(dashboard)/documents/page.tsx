import { prisma } from "@/lib/db";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import Link from "next/link";
import { FileText, Plane, Building2, Bus } from "lucide-react";

export default async function DocumentsPage() {
  const [documents, agency] = await Promise.all([
    prisma.document.findMany({
      include: { booking: { select: { publicRef: true, productType: true } } },
      orderBy: { generatedAt: "desc" },
      take: 50,
    }),
    prisma.agencySettings.findUnique({ where: { id: "default" } }),
  ]);

  const templates = [
    { name: "Flight E-Ticket", icon: Plane, description: "IndiGo/Akasa-style multi-passenger ticket with PNR, segments, and baggage" },
    { name: "Hotel Voucher", icon: Building2, description: "Confirmation number, property details, check-in/out, guest list" },
    { name: "Bus Ticket", icon: Bus, description: "Operator, route, boarding/dropping, seat assignments" },
    { name: "Tax Invoice", icon: FileText, description: "GST invoice with agency branding and payment details" },
  ];

  return (
    <div>
      <Header title="Documents" description="Generated tickets, vouchers, and invoices" />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {templates.map((t) => (
          <Card key={t.name}>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <t.icon className="h-5 w-5 text-primary" />
                <CardTitle className="text-sm">{t.name}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-xs">{t.description}</CardDescription>
              <p className="mt-2 text-xs text-muted-foreground">
                Branded as: {agency?.companyName}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Documents</CardTitle>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <p className="text-muted-foreground">No documents generated yet</p>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{doc.fileName}</p>
                      <Badge variant="outline">{doc.type}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      <Link href={`/bookings/${doc.bookingId}`} className="text-primary hover:underline">
                        {doc.booking.publicRef}
                      </Link>
                      {" • "}{formatDateTime(doc.generatedAt)}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <a href={`/api/documents/${doc.id}`} target="_blank" rel="noopener noreferrer">View</a>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
