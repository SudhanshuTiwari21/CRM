INSERT INTO "EmailTemplate" ("id", "key", "subject", "body", "updatedAt")
VALUES (
  'itinerary_voucher_tpl',
  'itinerary_voucher',
  'Your Flight Itinerary - {{publicRef}}',
  'Dear {{customerName}},

Thank you for booking with {{companyName}}.

Your flight itinerary and booking voucher are attached. Your PNR will be shared in a separate confirmation once the airline confirms your booking.

Booking ID: {{publicRef}}
Product: {{productType}}
Amount: {{amount}}

Please find your booking voucher and invoice attached to this email.

Regards,
{{companyName}}
{{companyPhone}}',
  CURRENT_TIMESTAMP
)
ON CONFLICT ("key") DO NOTHING;
