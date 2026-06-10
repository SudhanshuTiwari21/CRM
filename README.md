# Flight Booking CRM

Modern travel agency CRM for managing **Flights**, **Hotels**, and **Buses** across three booking channels:

1. **Live API** — Real-time booking via provider API (stub included)
2. **Held** — Customer pays on website; agent books manually and enters PNR
3. **Offline / WhatsApp** — Agent creates booking in CRM

## Tech Stack

- Next.js 15 (App Router) — Frontend + API
- PostgreSQL + Prisma
- NextAuth.js — Admin/Agent auth
- Nodemailer — Gmail SMTP emails
- @react-pdf/renderer — Ticket/voucher/invoice PDFs
- shadcn/ui + Tailwind CSS

## Quick Start

### 1. Start PostgreSQL

```bash
docker compose up -d
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your `AUTH_SECRET`, `DATABASE_URL`, and SMTP credentials.

### 3. Install & migrate

```bash
npm install
npx prisma migrate dev --name init
npm run db:seed
```

### 4. Run dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Webhook API (for future booking website)

| Endpoint | Description |
|----------|-------------|
| `POST /api/webhooks/bookings/live` | Paid live booking → auto-confirmed |
| `POST /api/webhooks/bookings/held` | Paid held booking → processing queue |
| `GET /api/webhooks/bookings/:publicRef` | Booking status check |

Header: `X-API-Key: <WEBHOOK_API_KEY from .env>`

## Key Workflows

### Held Booking Flow
1. Website sends webhook → CRM creates `PROCESSING` booking
2. Customer receives "processing within 24-48hrs" email
3. Agent books manually, enters PNR in CRM
4. System generates PDFs + sends confirmation email

### Offline WhatsApp Flow
1. Agent creates booking via **New Booking** wizard
2. Booking saved as `PROCESSING`
3. Agent enters PNR → tickets generated + emailed
