import OpenAI from "openai";
import { z } from "zod";
import { getAirportDisplay } from "@/lib/airport-names";
import { toFormDateTime, type ParsedProductType, type ParsedTicketResult } from "@/lib/services/ticket-parse.service";

/** Only auto-fill when the model is this sure or higher (0–1). */
export const TICKET_AI_CONFIDENCE_THRESHOLD = Number(
  process.env.OPENAI_TICKET_MIN_CONFIDENCE || "0.92"
);

const CONFIDENT_TITLES = ["Mr", "Mrs", "Ms", "Miss", "Mstr", "Dr"] as const;

const confidentValueSchema = z.object({
  value: z.unknown(),
  confidence: z.number().min(0).max(1),
});

const aiTicketSchema = z.object({
  productType: z.enum(["FLIGHT", "HOTEL", "BUS"]),
  overallConfidence: z.number().min(0).max(1).optional(),
  fields: z.record(confidentValueSchema).default({}),
  notes: z.array(z.string()).optional(),
});

const flightSegmentSchema = z.object({
  flightNumber: z.string().min(2).max(12),
  airline: z.string().min(2).max(80).optional(),
  fromAirport: z.string().regex(/^[A-Za-z]{3}$/),
  fromCity: z.string().min(2).max(80).optional(),
  toAirport: z.string().regex(/^[A-Za-z]{3}$/),
  toCity: z.string().min(2).max(80).optional(),
  departureAt: z.string().min(8).max(40),
  arrivalAt: z.string().min(8).max(40),
  pnr: z.string().min(5).max(12).optional(),
  terminal: z.string().max(20).optional(),
  departureTerminal: z.string().max(20).optional(),
});

const flightPassengerSchema = z.object({
  title: z.string().optional(),
  firstName: z.string().min(1).max(80),
  lastName: z.string().max(80).optional().default(""),
  gender: z.enum(["Male", "Female", "Other"]).optional(),
  paxType: z.enum(["adult", "child", "infant"]).optional(),
  ticketNumber: z.string().max(30).optional(),
  seat: z.string().max(10).optional(),
});

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

export function isOpenAITicketParseEnabled() {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

function buildSystemPrompt(productHint?: ParsedProductType) {
  return `You extract booking details from airline/hotel/bus tickets for a travel CRM form.

CRITICAL RULES (zero false positives):
- Never invent, guess, or infer missing values.
- If a value is unclear, blurred, cut off, or ambiguous, either omit the field or set confidence below 0.85.
- Only use confidence >= 0.92 when the value is explicitly printed and unambiguous.
- Dates/times must come from the ticket; format as ISO-like local wall time: YYYY-MM-DDTHH:mm
- Airport codes must be IATA (3 letters) only when clearly shown.
- Passenger names: use exact spelling from the ticket; split into firstName/lastName carefully.
- Amounts: numbers only (INR), no currency symbols; omit if not clearly total/fare.
- productType must match the document${productHint ? ` (user expects ${productHint} — use it only if the document agrees)` : ""}.

Return ONLY valid JSON matching:
{
  "productType": "FLIGHT" | "HOTEL" | "BUS",
  "overallConfidence": 0-1,
  "fields": {
    "<fieldName>": { "value": <any>, "confidence": 0-1 }
  },
  "notes": ["optional human notes about uncertainty"]
}

FLIGHT field names (use only when sure):
airline, tripType ("ONE_WAY"|"ROUND_TRIP"|"MULTI_CITY"), cabinClass ("ECONOMY"|"PREMIUM_ECONOMY"|"BUSINESS"),
segments (array of {flightNumber, airline?, fromAirport, fromCity?, toAirport, toCity?, departureAt, arrivalAt, pnr?, terminal?, departureTerminal?}),
passengers (array of {title?, firstName, lastName?, gender?, paxType?, ticketNumber?, seat?}),
baseFare, totalAmount,
customer ({title?, name?, phone?, email?})

HOTEL field names:
propertyName, propertyAddress, city, roomType, checkIn (YYYY-MM-DD), checkOut (YYYY-MM-DD),
roomsCount, adultsCount, childrenCount, guests ([{name, type:"adult"|"child"}]),
baseFare, totalAmount, customer

BUS field names:
operator, route, boardingPoint, droppingPoint, departureAt, arrivalAt,
busPassengers ([{name, seat?, gender?}]), seats ([{seatNumber}]),
baseFare, totalAmount, customer`;
}

function takeIfConfident<T>(
  entry: z.infer<typeof confidentValueSchema> | undefined,
  parse: (value: unknown) => T | null,
  skipped: string[],
  fieldName: string
): T | undefined {
  if (!entry) return undefined;
  if (entry.confidence < TICKET_AI_CONFIDENCE_THRESHOLD) {
    skipped.push(`${fieldName} (confidence ${entry.confidence.toFixed(2)})`);
    return undefined;
  }
  const parsed = parse(entry.value);
  if (parsed === null || parsed === undefined || parsed === "") {
    skipped.push(`${fieldName} (failed validation)`);
    return undefined;
  }
  return parsed;
}

function normalizeAirport(code: unknown): string | null {
  if (typeof code !== "string") return null;
  const c = code.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(c) ? c : null;
}

function normalizeDateTime(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = toFormDateTime(raw);
  return v || null;
}

function normalizeDateOnly(raw: unknown): string | null {
  const dt = normalizeDateTime(raw);
  if (!dt) return null;
  return dt.slice(0, 10);
}

function filterFlightSegments(value: unknown, skipped: string[]): unknown[] | undefined {
  if (!Array.isArray(value) || value.length === 0) {
    skipped.push("segments (empty)");
    return undefined;
  }
  const out: unknown[] = [];
  value.forEach((row, idx) => {
    const parsed = flightSegmentSchema.safeParse(row);
    if (!parsed.success) {
      skipped.push(`segments[${idx}] (invalid)`);
      return;
    }
    const fromAirport = normalizeAirport(parsed.data.fromAirport);
    const toAirport = normalizeAirport(parsed.data.toAirport);
    const departureAt = normalizeDateTime(parsed.data.departureAt);
    const arrivalAt = normalizeDateTime(parsed.data.arrivalAt);
    if (!fromAirport || !toAirport || !departureAt || !arrivalAt) {
      skipped.push(`segments[${idx}] (bad airport/date)`);
      return;
    }
    const fromCity = parsed.data.fromCity?.trim() || getAirportDisplay(fromAirport).city || fromAirport;
    const toCity = parsed.data.toCity?.trim() || getAirportDisplay(toAirport).city || toAirport;
    out.push({
      flightNumber: parsed.data.flightNumber.trim().toUpperCase().replace(/\s+/g, ""),
      airline: parsed.data.airline?.trim() || "",
      fromAirport,
      fromCity,
      toAirport,
      toCity,
      departureAt,
      arrivalAt,
      pnr: parsed.data.pnr?.trim().toUpperCase(),
      terminal: parsed.data.terminal?.trim(),
      departureTerminal: parsed.data.departureTerminal?.trim(),
    });
  });
  return out.length ? out : undefined;
}

function filterPassengers(value: unknown, skipped: string[]): unknown[] | undefined {
  if (!Array.isArray(value) || value.length === 0) {
    skipped.push("passengers (empty)");
    return undefined;
  }
  const out: unknown[] = [];
  value.forEach((row, idx) => {
    const parsed = flightPassengerSchema.safeParse(row);
    if (!parsed.success) {
      skipped.push(`passengers[${idx}] (invalid)`);
      return;
    }
    const title = CONFIDENT_TITLES.includes(parsed.data.title as (typeof CONFIDENT_TITLES)[number])
      ? parsed.data.title
      : "Mr";
    out.push({
      title,
      firstName: parsed.data.firstName.trim(),
      lastName: (parsed.data.lastName || "").trim(),
      gender: parsed.data.gender || "Male",
      paxType: parsed.data.paxType || "adult",
      ticketNumber: parsed.data.ticketNumber?.trim(),
      seat: parsed.data.seat?.trim(),
      handBaggage: "7 KG",
      cabinBaggagePreset: "7 KG",
      dateOfBirth: "",
      passportNumber: "",
      passportIssuingCountry: "",
      passportIssueDate: "",
      passportExpiryDate: "",
    });
  });
  return out.length ? out : undefined;
}

function buildFieldsFromAi(
  productType: ParsedProductType,
  rawFields: Record<string, z.infer<typeof confidentValueSchema>>
): { fields: Record<string, unknown>; skipped: string[]; filledCount: number } {
  const skipped: string[] = [];
  const fields: Record<string, unknown> = { productType };
  let filledCount = 0;

  const str = (name: string) =>
    takeIfConfident(rawFields[name], (v) => (typeof v === "string" && v.trim() ? v.trim() : null), skipped, name);
  const num = (name: string) =>
    takeIfConfident(
      rawFields[name],
      (v) => {
        const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(/,/g, "")) : NaN;
        return Number.isFinite(n) && n > 0 ? n : null;
      },
      skipped,
      name
    );

  if (productType === "FLIGHT") {
    const airline = str("airline");
    if (airline) {
      fields.airline = airline;
      filledCount++;
    }
    const tripType = takeIfConfident(
      rawFields.tripType,
      (v) =>
        v === "ONE_WAY" || v === "ROUND_TRIP" || v === "MULTI_CITY" ? v : null,
      skipped,
      "tripType"
    );
    if (tripType) {
      fields.tripType = tripType;
      filledCount++;
    }
    const cabinClass = takeIfConfident(
      rawFields.cabinClass,
      (v) =>
        v === "ECONOMY" || v === "PREMIUM_ECONOMY" || v === "BUSINESS" ? v : null,
      skipped,
      "cabinClass"
    );
    if (cabinClass) {
      fields.cabinClass = cabinClass;
      filledCount++;
    }

    const segmentsEntry = rawFields.segments;
    if (segmentsEntry && segmentsEntry.confidence >= TICKET_AI_CONFIDENCE_THRESHOLD) {
      const segments = filterFlightSegments(segmentsEntry.value, skipped);
      if (segments) {
        fields.segments = segments.map((s) => {
          const seg = s as { airline?: string };
          return { ...seg, airline: seg.airline || airline || "" };
        });
        fields.stopCount = Math.max(0, segments.length - 1);
        filledCount++;
      }
    } else if (segmentsEntry) {
      skipped.push(`segments (confidence ${segmentsEntry.confidence.toFixed(2)})`);
    }

    const paxEntry = rawFields.passengers;
    if (paxEntry && paxEntry.confidence >= TICKET_AI_CONFIDENCE_THRESHOLD) {
      const passengers = filterPassengers(paxEntry.value, skipped);
      if (passengers) {
        fields.passengers = passengers;
        filledCount++;
      }
    } else if (paxEntry) {
      skipped.push(`passengers (confidence ${paxEntry.confidence.toFixed(2)})`);
    }
  }

  if (productType === "HOTEL") {
    for (const key of ["propertyName", "propertyAddress", "city", "roomType", "inclusions"] as const) {
      const v = str(key);
      if (v) {
        fields[key] = v;
        filledCount++;
      }
    }
    const checkIn = takeIfConfident(rawFields.checkIn, normalizeDateOnly, skipped, "checkIn");
    if (checkIn) {
      fields.checkIn = checkIn;
      filledCount++;
    }
    const checkOut = takeIfConfident(rawFields.checkOut, normalizeDateOnly, skipped, "checkOut");
    if (checkOut) {
      fields.checkOut = checkOut;
      filledCount++;
    }
    for (const key of ["roomsCount", "adultsCount", "childrenCount"] as const) {
      const v = num(key);
      if (v != null) {
        fields[key] = Math.round(v);
        filledCount++;
      }
    }
    const guestsEntry = rawFields.guests;
    if (guestsEntry && guestsEntry.confidence >= TICKET_AI_CONFIDENCE_THRESHOLD && Array.isArray(guestsEntry.value)) {
      const guests = guestsEntry.value
        .map((g) => {
          if (!g || typeof g !== "object") return null;
          const name = String((g as { name?: string }).name || "").trim();
          if (!name) return null;
          const type = (g as { type?: string }).type === "child" ? "child" : "adult";
          return { name, type };
        })
        .filter(Boolean);
      if (guests.length) {
        fields.guests = guests;
        filledCount++;
      }
    } else if (guestsEntry) {
      skipped.push(`guests (confidence ${guestsEntry.confidence.toFixed(2)})`);
    }
  }

  if (productType === "BUS") {
    for (const key of ["operator", "route", "boardingPoint", "droppingPoint"] as const) {
      const v = str(key);
      if (v) {
        fields[key] = v;
        filledCount++;
      }
    }
    for (const key of ["departureAt", "arrivalAt"] as const) {
      const v = takeIfConfident(rawFields[key], normalizeDateTime, skipped, key);
      if (v) {
        fields[key] = v;
        filledCount++;
      }
    }
  }

  const baseFare = num("baseFare");
  if (baseFare != null) {
    fields.baseFare = baseFare;
    filledCount++;
  }
  const totalAmount = num("totalAmount");
  if (totalAmount != null) {
    fields.totalAmount = totalAmount;
    filledCount++;
  }

  const customerEntry = rawFields.customer;
  if (customerEntry && customerEntry.confidence >= TICKET_AI_CONFIDENCE_THRESHOLD && customerEntry.value && typeof customerEntry.value === "object") {
    const c = customerEntry.value as Record<string, unknown>;
    const customer: Record<string, string> = {};
    if (typeof c.name === "string" && c.name.trim()) customer.name = c.name.trim();
    if (typeof c.phone === "string" && c.phone.trim().length >= 10) customer.phone = c.phone.trim();
    if (typeof c.email === "string" && c.email.includes("@")) customer.email = c.email.trim();
    if (typeof c.title === "string" && CONFIDENT_TITLES.includes(c.title as (typeof CONFIDENT_TITLES)[number])) {
      customer.title = c.title;
    }
    if (Object.keys(customer).length) {
      fields.customer = customer;
      filledCount++;
    }
  } else if (customerEntry) {
    skipped.push(`customer (confidence ${customerEntry.confidence.toFixed(2)})`);
  }

  return { fields, skipped, filledCount };
}

async function callOpenAI(params: {
  text?: string;
  imageBase64?: string;
  imageMime?: string;
  pdfBase64?: string;
  fileName: string;
  productHint?: ParsedProductType;
}): Promise<z.infer<typeof aiTicketSchema>> {
  const client = getOpenAIClient();
  if (!client) throw new Error("OPENAI_API_KEY is not configured");

  const model = process.env.OPENAI_TICKET_MODEL?.trim() || "gpt-4o";
  const content: OpenAI.Chat.ChatCompletionContentPart[] = [
    {
      type: "text",
      text: `Extract ticket fields from this upload (${params.fileName}). Remember: high confidence only when explicit; never invent.`,
    },
  ];

  if (params.text?.trim()) {
    content.push({
      type: "text",
      text: `Ticket text:\n\n${params.text.slice(0, 24000)}`,
    });
  }

  if (params.imageBase64 && params.imageMime) {
    content.push({
      type: "image_url",
      image_url: {
        url: `data:${params.imageMime};base64,${params.imageBase64}`,
        detail: "high",
      },
    });
  }

  // Scanned PDFs: ask model via Responses API file input when chat vision can't take PDF
  if (params.pdfBase64 && !params.text?.trim() && !params.imageBase64) {
    const response = await client.responses.create({
      model,
      temperature: 0,
      input: [
        {
          role: "system",
          content: buildSystemPrompt(params.productHint),
        },
        {
          role: "user",
          content: [
            {
              type: "input_file",
              filename: params.fileName || "ticket.pdf",
              file_data: `data:application/pdf;base64,${params.pdfBase64}`,
            },
            {
              type: "input_text",
              text: "Extract ticket fields as JSON. High confidence only when explicit; never invent.",
            },
          ],
        },
      ],
      text: { format: { type: "json_object" } },
    });

    const raw = response.output_text;
    if (!raw?.trim()) throw new Error("OpenAI returned an empty response for this PDF");
    const parsed = aiTicketSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      throw new Error("OpenAI returned JSON that did not match the ticket schema");
    }
    return parsed.data;
  }

  const completion = await client.chat.completions.create({
    model,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: buildSystemPrompt(params.productHint) },
      { role: "user", content },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw?.trim()) throw new Error("OpenAI returned an empty response");
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error("OpenAI returned invalid JSON");
  }
  const parsed = aiTicketSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error("OpenAI returned JSON that did not match the ticket schema");
  }
  return parsed.data;
}

export async function parseTicketWithOpenAI(params: {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
  productHint?: ParsedProductType;
  extractedText?: string;
}): Promise<ParsedTicketResult> {
  const lower = params.fileName.toLowerCase();
  const isPdf = params.mimeType === "application/pdf" || lower.endsWith(".pdf");
  const isImage =
    params.mimeType.startsWith("image/") ||
    /\.(png|jpe?g|webp|gif)$/i.test(lower);

  const text = params.extractedText?.trim() || "";
  const imageBase64 = isImage ? params.buffer.toString("base64") : undefined;
  const imageMime = isImage
    ? params.mimeType.startsWith("image/")
      ? params.mimeType
      : lower.endsWith(".png")
        ? "image/png"
        : lower.endsWith(".webp")
          ? "image/webp"
          : "image/jpeg"
    : undefined;
  const pdfBase64 = isPdf && text.length < 40 ? params.buffer.toString("base64") : undefined;

  if (!text && !imageBase64 && !pdfBase64) {
    throw new Error("No readable content in upload. Try a clearer photo or a text-based e-ticket PDF.");
  }

  const ai = await callOpenAI({
    text: text.length >= 40 ? text : undefined,
    imageBase64,
    imageMime,
    pdfBase64,
    fileName: params.fileName,
    productHint: params.productHint,
  });

  const productType =
    params.productHint && ai.productType !== params.productHint && (ai.overallConfidence || 0) < 0.95
      ? params.productHint
      : ai.productType;

  const { fields, skipped, filledCount } = buildFieldsFromAi(productType, ai.fields);
  const warnings = [
    ...(ai.notes || []),
    ...(skipped.length
      ? [`Skipped low-confidence/invalid fields: ${skipped.slice(0, 12).join(", ")}${skipped.length > 12 ? "…" : ""}`]
      : []),
  ];

  if (filledCount === 0) {
    warnings.unshift(
      "No fields met the high-confidence bar — nothing was auto-filled. Enter details manually or upload a clearer ticket."
    );
  }

  const confidence: ParsedTicketResult["confidence"] =
    filledCount >= 3 && skipped.length <= 2 ? "high" : filledCount >= 1 ? "medium" : "low";

  return {
    productType,
    confidence,
    warnings,
    fields,
    rawTextPreview: text.slice(0, 500) || `[OpenAI extract from ${params.fileName}]`,
  };
}
