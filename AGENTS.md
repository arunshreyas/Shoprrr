# Shoppr — Project Context

## Product
- **Shoppr** is an Alexa-style voice ledger ("Shoppr, Naresh bhai ka 340 udhaar likh do") for Indian kirana stores (BolBharat PS2).
- Core loop: WebSocket streaming STT (Gnani Prisma v3.0) -> Trigger/Intent Parser -> PostgreSQL Ledger -> Sub-2s spoken confirmation (Gnani Timbre v3.0).

## Stack & Strict Conventions
- **Framework:** Next.js (App Router, TypeScript, Tailwind CSS) + Supabase PostgreSQL.
- **ORM:** **Prisma ORM 8** (`@prisma/orm-postgres`), NOT Prisma 7.
  - Contract file: `src/prisma/contract.prisma` (must start with `// use prisma-8`).
  - Never use `schema.prisma`, `@prisma/client`, `prisma generate`, or `prisma migrate dev`.
  - Use `npx prisma contract emit` and `npx prisma db update` (or `migration plan` + `db migrate --advance-ref db`).
  - Query syntax: `db.orm.public.<Model>.where(...).all()` / `.first()`.

## Mandatory PS2 Functional & Compliance Rules
1. Handle credit (`UDHAAR`), payment (`JAMA`), relative dates (`kal`, `parso`), compound entries (`"Ramesh ka 340 udhaar, kal 200 diya tha"`), and instant voice corrections (`"nahi, 430"`).
2. Disambiguate duplicate customer names via `tag` before committing.
3. Track `reminderOptIn` on `Customer` (polite, opt-in reminders only; zero pressure language).
4. Never commit `.env` or API keys.