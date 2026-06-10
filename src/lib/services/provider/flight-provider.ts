import type { FlightSegment, FlightPassenger } from "@/types/booking";

export interface FlightBookRequest {
  airline: string;
  segments: FlightSegment[];
  passengers: FlightPassenger[];
  totalAmount: number;
}

export interface FlightBookResponse {
  success: boolean;
  pnr: string;
  supplierRef: string;
  rawResponse?: unknown;
}

export interface FlightProviderAdapter {
  searchFlights(query: unknown): Promise<unknown>;
  bookFlight(request: FlightBookRequest): Promise<FlightBookResponse>;
  getBookingStatus(pnr: string): Promise<unknown>;
}

export class MockFlightProvider implements FlightProviderAdapter {
  async searchFlights(): Promise<unknown> {
    return { flights: [], provider: "mock" };
  }

  async bookFlight(request: FlightBookRequest): Promise<FlightBookResponse> {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let pnr = "";
    for (let i = 0; i < 6; i++) {
      pnr += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return {
      success: true,
      pnr,
      supplierRef: `MOCK-${Date.now()}`,
      rawResponse: { provider: "mock", request },
    };
  }

  async getBookingStatus(pnr: string): Promise<unknown> {
    return { pnr, status: "CONFIRMED", provider: "mock" };
  }
}

let providerInstance: FlightProviderAdapter | null = null;

export function getFlightProvider(): FlightProviderAdapter {
  if (!providerInstance) {
    providerInstance = new MockFlightProvider();
  }
  return providerInstance;
}
