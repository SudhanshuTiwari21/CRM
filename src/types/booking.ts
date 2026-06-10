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
}

export interface FlightPassenger {
  title: string;
  firstName: string;
  lastName: string;
  gender: string;
  ticketNumber?: string;
  seat?: string;
  handBaggage?: string;
  checkInBaggage?: string;
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
