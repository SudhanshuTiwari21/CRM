import type { HotelGuest, HotelRoom } from "@/types/booking";

const MAX_ROOMS = 6;
const MAX_ADULTS_PER_ROOM = 6;
const MAX_CHILDREN_PER_ROOM = 4;

export { MAX_ROOMS, MAX_ADULTS_PER_ROOM, MAX_CHILDREN_PER_ROOM };

function emptyGuestSlots(adults: number, children: number, roomNumber: number): HotelGuest[] {
  const guests: HotelGuest[] = [];
  for (let i = 0; i < adults; i++) {
    guests.push({ name: "", type: "adult", roomNumber });
  }
  for (let i = 0; i < children; i++) {
    guests.push({ name: "", type: "child", roomNumber });
  }
  return guests;
}

function mergeGuestSlots(
  previous: HotelGuest[] | undefined,
  adults: number,
  children: number,
  roomNumber: number
): HotelGuest[] {
  const prevAdults = (previous || []).filter((g) => g.type === "adult");
  const prevChildren = (previous || []).filter((g) => g.type === "child");
  const next: HotelGuest[] = [];

  for (let i = 0; i < adults; i++) {
    next.push({
      name: prevAdults[i]?.name || "",
      type: "adult",
      roomNumber,
    });
  }
  for (let i = 0; i < children; i++) {
    next.push({
      name: prevChildren[i]?.name || "",
      type: "child",
      roomNumber,
    });
  }
  return next;
}

export function createHotelRoom(
  roomNumber: number,
  adultsCount = 2,
  childrenCount = 0,
  previousGuests?: HotelGuest[]
): HotelRoom {
  return {
    roomNumber,
    adultsCount,
    childrenCount,
    guests: mergeGuestSlots(previousGuests, adultsCount, childrenCount, roomNumber),
  };
}

export function createDefaultHotelRooms(count = 1): HotelRoom[] {
  const n = Math.min(MAX_ROOMS, Math.max(1, count));
  return Array.from({ length: n }, (_, i) => createHotelRoom(i + 1));
}

export function resizeHotelRooms(rooms: HotelRoom[], count: number): HotelRoom[] {
  const n = Math.min(MAX_ROOMS, Math.max(1, count));
  const next: HotelRoom[] = [];
  for (let i = 0; i < n; i++) {
    const existing = rooms[i];
    if (existing) {
      next.push({
        ...existing,
        roomNumber: i + 1,
        guests: mergeGuestSlots(
          existing.guests,
          existing.adultsCount,
          existing.childrenCount,
          i + 1
        ),
      });
    } else {
      next.push(createHotelRoom(i + 1));
    }
  }
  return next;
}

export function updateRoomOccupancy(
  room: HotelRoom,
  adultsCount: number,
  childrenCount: number
): HotelRoom {
  const adults = Math.min(MAX_ADULTS_PER_ROOM, Math.max(1, adultsCount));
  const children = Math.min(MAX_CHILDREN_PER_ROOM, Math.max(0, childrenCount));
  return {
    ...room,
    adultsCount: adults,
    childrenCount: children,
    guests: mergeGuestSlots(room.guests, adults, children, room.roomNumber),
  };
}

export function flattenHotelRoomGuests(rooms: HotelRoom[]): HotelGuest[] {
  return rooms.flatMap((room) =>
    room.guests.map((g) => ({
      name: g.name || "",
      type: g.type,
      roomNumber: room.roomNumber,
    }))
  );
}

export function totalsFromHotelRooms(rooms: HotelRoom[]) {
  return {
    roomsCount: rooms.length || 1,
    adultsCount: rooms.reduce((sum, r) => sum + (r.adultsCount || 0), 0) || 1,
    childrenCount: rooms.reduce((sum, r) => sum + (r.childrenCount || 0), 0),
    guests: flattenHotelRoomGuests(rooms),
  };
}

/** Build room breakup from stored rooms JSON, or legacy flat guests/counts. */
export function normalizeHotelRooms(input: {
  rooms?: unknown;
  roomsCount?: number | null;
  adultsCount?: number | null;
  childrenCount?: number | null;
  guests?: unknown;
}): HotelRoom[] {
  const rawRooms = Array.isArray(input.rooms) ? (input.rooms as HotelRoom[]) : null;
  if (rawRooms && rawRooms.length > 0) {
    return rawRooms.map((room, index) => {
      const roomNumber = room.roomNumber || index + 1;
      const adults = Math.min(MAX_ADULTS_PER_ROOM, Math.max(1, Number(room.adultsCount) || 1));
      const children = Math.min(
        MAX_CHILDREN_PER_ROOM,
        Math.max(0, Number(room.childrenCount) || 0)
      );
      const guests = Array.isArray(room.guests) ? room.guests : [];
      return {
        roomNumber,
        adultsCount: adults,
        childrenCount: children,
        guests: mergeGuestSlots(
          guests.map((g) => ({
            name: g?.name || "",
            type: g?.type === "child" ? "child" : "adult",
            roomNumber,
          })),
          adults,
          children,
          roomNumber
        ),
      };
    });
  }

  const guests = Array.isArray(input.guests) ? (input.guests as HotelGuest[]) : [];
  const roomsCount = Math.min(MAX_ROOMS, Math.max(1, Number(input.roomsCount) || 1));

  // Prefer guests already tagged with roomNumber
  const tagged = guests.some((g) => g.roomNumber != null && g.roomNumber > 0);
  if (tagged) {
    const rooms: HotelRoom[] = [];
    for (let i = 1; i <= roomsCount; i++) {
      const roomGuests = guests.filter((g) => g.roomNumber === i);
      const adults =
        roomGuests.filter((g) => g.type === "adult").length ||
        (i === 1 ? Math.max(1, Number(input.adultsCount) || 1) : 2);
      const children = roomGuests.filter((g) => g.type === "child").length;
      rooms.push(createHotelRoom(i, adults || 1, children, roomGuests));
    }
    return rooms;
  }

  // Legacy: split totals evenly across rooms
  const totalAdults = Math.max(1, Number(input.adultsCount) || guests.filter((g) => g.type === "adult").length || 1);
  const totalChildren = Math.max(
    0,
    Number(input.childrenCount) || guests.filter((g) => g.type === "child").length || 0
  );

  const adultNames = guests.filter((g) => g.type === "adult").map((g) => g.name || "");
  const childNames = guests.filter((g) => g.type === "child").map((g) => g.name || "");

  const rooms: HotelRoom[] = [];
  let adultCursor = 0;
  let childCursor = 0;

  for (let i = 0; i < roomsCount; i++) {
    const roomsLeft = roomsCount - i;
    const adultsLeft = totalAdults - adultCursor;
    const childrenLeft = totalChildren - childCursor;
    const adults = Math.max(1, Math.ceil(adultsLeft / roomsLeft));
    const children = Math.max(0, Math.ceil(childrenLeft / roomsLeft));

    const roomGuests: HotelGuest[] = [];
    for (let a = 0; a < adults; a++) {
      roomGuests.push({
        name: adultNames[adultCursor + a] || "",
        type: "adult",
        roomNumber: i + 1,
      });
    }
    for (let c = 0; c < children; c++) {
      roomGuests.push({
        name: childNames[childCursor + c] || "",
        type: "child",
        roomNumber: i + 1,
      });
    }

    rooms.push({
      roomNumber: i + 1,
      adultsCount: adults,
      childrenCount: children,
      guests: roomGuests.length ? roomGuests : emptyGuestSlots(adults, children, i + 1),
    });

    adultCursor += adults;
    childCursor += children;
  }

  return rooms;
}

export function formatRoomGuestNames(room: HotelRoom): string | null {
  const named = room.guests.filter((g) => g.name?.trim());
  if (!named.length) return null;
  return named
    .map((g, i) => {
      const label = g.type === "child" ? "Child" : "Adult";
      return i === 0 && g.type === "adult"
        ? `${g.name.trim()} (Primary)`
        : `${g.name.trim()} (${label})`;
    })
    .join(", ");
}
