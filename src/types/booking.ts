export type TripDirection = "outbound" | "return";

export interface FlightSegment {
  flightNumber: string;
  airline: string;
  fromAirport: string;
  fromCity: string;
  toAirport: string;
  toCity: string;
  departureAt: string;
  arrivalAt: string;
  terminal?: string;
  aircraft?: string;
  duration?: string;
  status?: string;
  direction?: TripDirection;
  pnr?: string;
  /** Layover after this segment (before the next flight) */
  layoverDuration?: string;
  layoverAirport?: string;
  layoverCity?: string;
  layoverTerminal?: string;
  layoverType?: "connection" | "plane_change" | "technical";
  layoverNote?: string;
  departureTerminal?: string;
}

export type PaxType = "adult" | "child" | "infant";
export type MealPreference = "veg" | "nonveg" | "none";

export interface FlightPassenger {
  title: string;
  firstName: string;
  lastName?: string;
  gender: string;
  paxType?: PaxType;
  ticketNumber?: string;
  seat?: string;
  meal?: MealPreference;
  handBaggage?: string;
  checkInBaggage?: string;
  /** Per-passenger airline base fare for invoice breakup (INR). Adults and children. */
  baseFare?: number;
  frequentFlyerAirline?: string;
  frequentFlyerNumber?: string;
  wheelchairAssistance?: boolean;
  dateOfBirth?: string;
  passportNumber?: string;
  passportIssuingCountry?: string;
  passportIssueDate?: string;
  passportExpiryDate?: string;
}

export interface HotelGuest {
  name: string;
  type: "adult" | "child";
}

export interface BusPassenger {
  name: string;
  seat: string;
  gender?: string;
}

export interface BusSeat {
  seatNumber: string;
  type?: string;
}
