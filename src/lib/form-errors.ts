import type { FieldErrors } from "react-hook-form";
import type { ZodIssue } from "zod";

const FIELD_LABELS: Record<string, string> = {
  flightNumber: "flight number",
  airline: "airline",
  fromAirport: "departure airport code",
  fromCity: "departure city",
  toAirport: "arrival airport code",
  toCity: "arrival city",
  departureAt: "departure date and time",
  arrivalAt: "arrival date and time",
  firstName: "first name",
  lastName: "last name",
  name: "name",
  phone: "phone number",
  email: "email address",
  customerId: "customer",
  propertyName: "hotel name",
  propertyAddress: "hotel address",
  checkIn: "check-in date",
  checkOut: "check-out date",
  roomType: "room type",
  operator: "bus operator",
  route: "route",
  baseFare: "base fare",
  serviceCharge: "service charge",
  buyerGstin: "buyer GSTIN",
};

function isGenericZodMessage(message: string) {
  return (
    message.includes("String must contain at least") ||
    message.includes("Required") ||
    message.includes("Invalid input") ||
    message.includes("Expected string") ||
    message === "Required"
  );
}

function humanizeFieldLabel(field: string) {
  return FIELD_LABELS[field] || field.replace(/([A-Z])/g, " $1").toLowerCase().trim();
}

export function formatZodPathMessage(path: (string | number)[], message: string) {
  const pathStr = path.map(String).join(".");

  if (pathStr === "customerId") {
    return "Please select a customer for this ledger bill.";
  }

  const segIdx = path.indexOf("segments");
  if (segIdx !== -1 && path[segIdx + 1] !== undefined) {
    const flightNum = Number(path[segIdx + 1]) + 1;
    if (!isGenericZodMessage(message)) {
      return `Flight ${flightNum}: ${message}`;
    }
    const field = String(path[path.length - 1]);
    return `Flight ${flightNum}: ${humanizeFieldLabel(field).charAt(0).toUpperCase()}${humanizeFieldLabel(field).slice(1)} is required.`;
  }

  const paxIdx = path.indexOf("passengers");
  if (paxIdx !== -1 && path[paxIdx + 1] !== undefined) {
    const paxNum = Number(path[paxIdx + 1]) + 1;
    if (!isGenericZodMessage(message)) {
      return `Passenger ${paxNum}: ${message}`;
    }
    const field = String(path[path.length - 1]);
    const label = humanizeFieldLabel(field);
    return `Passenger ${paxNum}: ${label.charAt(0).toUpperCase()}${label.slice(1)} is required.`;
  }

  if (path[0] === "customer" && path.length > 1) {
    const field = String(path[1]);
    if (!isGenericZodMessage(message)) {
      return message;
    }
    return `Customer ${humanizeFieldLabel(field)} is required.`;
  }

  if (!isGenericZodMessage(message)) {
    return message;
  }

  const field = String(path[path.length - 1] || path[0] || "field");
  const label = humanizeFieldLabel(field);
  return `${label.charAt(0).toUpperCase()}${label.slice(1)} is required.`;
}

export function formatZodIssues(issues: ZodIssue[]) {
  if (!issues.length) return "Please check the form and try again.";
  const first = issues[0];
  return formatZodPathMessage(first.path, first.message);
}

export function getFirstFormErrorMessage(errors: FieldErrors): string {
  function walk(node: unknown, path: string[] = []): string | null {
    if (!node || typeof node !== "object") return null;

    if ("message" in node && typeof (node as { message?: unknown }).message === "string") {
      const message = (node as { message: string }).message;
      return formatZodPathMessage(path, message);
    }

    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i++) {
        const found = walk(node[i], [...path, String(i)]);
        if (found) return found;
      }
      return null;
    }

    for (const [key, value] of Object.entries(node)) {
      const found = walk(value, [...path, key]);
      if (found) return found;
    }
    return null;
  }

  return walk(errors) || "Please fill all required fields correctly.";
}
