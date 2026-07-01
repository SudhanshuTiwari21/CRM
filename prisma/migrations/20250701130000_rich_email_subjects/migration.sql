UPDATE "EmailTemplate"
SET "subject" = 'Your Flight Booking - {{publicRef}}', "updatedAt" = NOW()
WHERE "key" = 'itinerary_voucher';

UPDATE "EmailTemplate"
SET "subject" = 'Booking Confirmed - {{publicRef}} | PNR: {{pnr}}', "updatedAt" = NOW()
WHERE "key" = 'booking_confirmed';
