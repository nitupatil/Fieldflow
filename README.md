# FieldFlow Water — Orders · POS · Leads · Map · Accounts

FieldFlow is a responsive web application for a daily water-jar delivery business. The GitHub repository hosts **static frontend files** and Supabase hosts all authenticated business records.

## App URL

Once GitHub Pages is configured to publish branch `main` / `/(root)`:

https://nitupatil.github.io/Fieldflow/

Alternatively, the independently deployed application is at https://fieldflow-crm.hatchable.site (hosting visibility currently personal/private).

## Five main modules

1. **Orders** — dated daily water-jar POs, standing order schedules, one-time orders, delivery status, repeat yesterday, payment recording and printable receipts.
2. **POS** — configurable product catalogue, default per-product prices and tax rates, editable line-item quantities and prices, server-validated totals, receipts with Indian rupees written in words, payment entry, delivery status and jar issuance.
3. **Leads / Customers** — spreadsheet-style contacts, tap-to-call, call remarks, follow-ups, change Type from Lead to Customer and searchable customer selection for orders.
4. **Map** — place/locality search, tap-to-pin location selection when adding contacts, nearby radius filtering, customers' pending jar counts and directions links. Pins work only when a location is saved. Uses OpenStreetMap + Photon place search (subject to external provider availability and fair-use limits).
5. **Accounts** — outstanding water POs and POS bills, receipts, customer-wise unreturned jar balances and empty-jar returns. Admin/manager may add an opening jar balance.

## Operational rules

- A standing water PO generates a **dated order once per customer per day**; updating the daily PO does not change the standing schedule.
- Supabase Cron triggers generation at **00:10 IST**; the Orders page can prepare a date manually.
- **Deliver** captures empty jars returned and updates the jar ledger in the same database operation. Repeating the same delivery confirmation won't duplicate jar movements.
- POS products can opt into **returnable jar tracking**. Per-bill jar quantities are snapshotted when a bill is saved.
- Customer PO and POS invoices have **separate billing records** to avoid double charging. Their outstanding totals are combined in Accounts.
- Bill amounts are recalculated on the server; direct changes to POS totals and collections are restricted by the database.
- Generated POS receipts include subtotal, tax, total, amount in words, paid amount and balance.
- Previously created CRM tables are preserved, even when their advanced screens are not shown.
- All organization data and financial records use Supabase authentication, row security and scoped database functions.

## Architecture and deployment

- Frontend: `index.html`, `styles.css`, `app.js`, `manifest.webmanifest`, `icon.svg`
- Backend: Supabase project `fieldflowpro` (`pldwrbjolcytodqedrqc`)
- Database: `businesses`, `lead_activities`, `products`, `water_plans`, `water_orders`, `water_collections`, `pos_sales`, `pos_sale_items`, `pos_payments`, `jar_movements`
- No Node server or static asset build step required.
- To enable Pages: GitHub repository **Settings → Pages → Deploy from a branch → main → /(root)**.
- Allow the final site URL in **Supabase Authentication → URL Configuration** as needed for authentication redirects.

### Security

The frontend includes only a Supabase **publishable key**, never the service role secret. The supplied ImgBB credential is stored privately in Supabase Vault. Do not publish credentials, customer exports or payment information in Git.

### Before production use

Run an authenticated end-to-end test: create product → add customer using map → save POS bill → print → record partial payment → mark delivered and enter empties → check customer jar and monetary balances. Verify the same sequence on mobile and desktop. Configure printed tax fields/registration details in accordance with applicable rules before treating receipts as statutory tax invoices.

## Version 8 — Photo POS and customer ledgers

- **Photo catalogue:** Upload JPG/PNG/WebP/GIF product images (up to 6 MB) from the Product editor. Admin/manager uploads are sent to authenticated Supabase Edge Function `upload-product-image`, which uses ImgBB with a server-held credential. The product record retains `image_url` and `image_host_id`; no key is present in the frontend.
- **App-style POS:** Searchable picture tiles with tap-on-image and +/− quantity controls. A compact live cart stays visible at the bottom of mobile screens and alongside products on desktop. Individual bill rates are editable without changing product defaults.
- **Bills:** Saved POS sales and daily water POs can be opened and printed. The Download action creates a standalone **HTML** receipt that can be opened in a browser and printed or saved as PDF using the system print dialog. The receipt includes items, customer, payment, balance and amount in words.
- **Customer ledgers:** Accounts and customer details provide a ledger combining dated water POs, POS bills, their recorded payments, jar issues and empty-jar returns, with running outstanding amounts and jar counts. Ledgers can be printed or downloaded as CSV.
- **Mobile usability:** Short photo tiles, larger tap targets, a fixed cart summary, and independent product-list scrolling. Some scrolling is still necessary for long product lists or histories.

**Important:** Product photos live at ImgBB, and customer/business data lives in Supabase; the local HTML site is a frontend. End-to-end upload, POS payment, and receipt download should be checked using an actual signed-in manager account and your Android WebViewer. No real product photos have been uploaded during this code update.
