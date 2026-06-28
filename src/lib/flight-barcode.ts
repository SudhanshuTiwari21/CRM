import bwipjs from "bwip-js/node";
import { format } from "date-fns";
import type { FlightPassenger, FlightSegment } from "@/types/booking";

/** Build IATA-style BCBP-inspired string for PDF417 boarding barcode. */
export function buildBarcodePayload(params: {
  pnr: string;
  bookingRef: string;
  passenger: FlightPassenger;
  segment: FlightSegment;
  airlineCode?: string | null;
}) {
  const { pnr, bookingRef, passenger, segment, airlineCode } = params;
  const last = (passenger.lastName || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 20);
  const first = passenger.firstName.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 20);
  const from = (segment.fromAirport || "").toUpperCase().slice(0, 3);
  const to = (segment.toAirport || "").toUpperCase().slice(0, 3);
  const flight = (segment.flightNumber || "").replace(/\s+/g, "").toUpperCase();
  const dep = segment.departureAt
    ? format(new Date(segment.departureAt), "yyMMdd")
    : "000000";

  return [
    "M1",
    `${last}/${first}`,
    pnr,
    from,
    to,
    airlineCode || "XX",
    flight,
    dep,
    bookingRef,
  ].join("|");
}

export async function generateFlightBarcodeDataUri(text: string): Promise<string> {
  const png = await bwipjs.toBuffer({
    bcid: "pdf417",
    text,
    scale: 2,
    height: 12,
    includetext: false,
    paddingwidth: 4,
    paddingheight: 4,
  });
  return `data:image/png;base64,${png.toString("base64")}`;
}

export async function generateSegmentBarcodes(params: {
  pnr: string;
  bookingRef: string;
  passengers: FlightPassenger[];
  segments: FlightSegment[];
  airlineCode?: string | null;
}) {
  const barcodes: string[][] = [];

  for (let p = 0; p < params.passengers.length; p++) {
    const row: string[] = [];
    for (let s = 0; s < params.segments.length; s++) {
      const payload = buildBarcodePayload({
        pnr: params.pnr,
        bookingRef: params.bookingRef,
        passenger: params.passengers[p],
        segment: params.segments[s],
        airlineCode: params.airlineCode,
      });
      row.push(await generateFlightBarcodeDataUri(payload));
    }
    barcodes.push(row);
  }

  return barcodes;
}
