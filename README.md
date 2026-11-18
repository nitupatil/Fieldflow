# FieldFlow — Daily Water Jar CRM

A simple, app-style CRM for calling shops and hotels, managing repeat water-jar purchase orders, tracking deliveries and collecting payments. Designed for desktop and mobile browsers.

## Open the application

Once GitHub Pages is enabled, the website will appear at **https://nitupatil.github.io/Fieldflow/**.

In the repository, open **Settings → Pages → Build and deployment**, choose **Deploy from a branch**, **main**, and **/(root)**. Save and let GitHub finish deployment. In Supabase Authentication → URL Configuration, allow this website URL for authentication redirects as needed.

The application is a **static frontend** (index.html, styles.css, app.js); Supabase hosts authentication and the live business data. No build step is required.

## Everyday workflow

1. **Call List** — add a shop, hotel or other lead, call them, record their response and optional call-back date.
2. **Customers** — convert interested leads to customers and set a standing PO of jars, price and delivery weekdays.
3. **Today's POs** — recurring orders automatically appear each scheduled day. Edit the day's quantity or price without changing future standing POs; create one-time POs manually.
4. **Deliveries** — mark an order Pending → Out for delivery → Delivered, or cancel an unpaid order.
5. **Collections** — record full or partial payments for individual POs and view balances.
6. **Map** — locate shops with saved GPS coordinates. **History** shows previous water orders, call notes and earlier sales orders.

### Daily repeat rules

- Default standing schedule: Monday through Saturday; choose weekdays for each customer.
- Auto-generation: Supabase Cron runs at **00:10 Asia/Kolkata** (18:40 UTC) each day.
- The dashboard can also prepare a date's standing orders manually.
- A customer cannot have duplicate dated water POs; manual repeats skip dates that already have one.
- Editing a dated PO does not modify the standing order; editing a standing plan affects future generation.
- Supabase RLS restricts records to organization members.

## Security & architecture

Backend: Supabase project `fieldflowpro` (project ref `pldwrbjolcytodqedrqc`). Existing CRM tables are preserved and remain separate from `water_plans`, `water_orders` and `water_collections`.

The frontend contains only a **publishable Supabase key**. Never commit service role secrets, private credentials, ImgBB keys or customer exports. Supabase Vault holds the ImgBB credential.

## Notes

- GitHub Pages serves static files only; GitHub does **not** host the Supabase database or scheduler.
- Map markers require latitude and longitude; use browser location only with permission.
- This version is optimized for daily water-jar operations; other legacy CRM data and tables are retained but advanced screens are intentionally hidden.
- Test with a real signed-in account before relying on the app for delivery or financial reporting.
