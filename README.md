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

## Version 9 — Mobile POS, photo uploads, billing and repeat deliveries

- Product editor supports image-gallery upload with preview; authenticated server-side ImgBB upload checks membership and admin/manager role, then saves the image URL and image ID on the same product row. Includes direct HTTPS image-link fallback when a Kodular WebViewer cannot launch a file picker.
- Refreshed five-section UI uses inline SVG illustrations, responsive colorful cards and gentle reduced-motion-aware animations.
- POS now opens a **review selected items** screen with quantities, rates, tax and total before the sale is committed.
- Saved water POs and POS bills have receipt previews with Back/Close, Print, Download PDF and Share PDF. PDF export uses jsPDF v2.5.2; printing requests the browser/Android print flow. **Android Kodular WebViewer printing and file download depend on the WebViewer/native configuration**; use the Share PDF or open-in-browser fallback if the native print dialog does not appear.
- Standing daily plans now allow start/end dates, weekday presets and optional Sundays. Each day's PO is editable independently. An existing water PO can also be repeated across a bounded date range without duplicating a customer's existing dated order.
- No ImgBB API key or server credential is stored in the public frontend.

### End-to-end testing before real billing

Sign in as an admin/manager and test: add a product photo, verify its display in POS, add a product to the cart, review bill and save, open a receipt, download/share/print PDF, record payment, issue an order for multiple days, then verify the customer's ledger. Repeat on your actual Kodular APK because Android WebViewer behavior can differ from Chrome. The printed bill remains a generic receipt and requires business/GST particulars to be a statutory tax invoice.

## Version 10 — App-like POS, T-shaped accounts and Android PDF viewer

- **POS** now shows only product image tiles, +/- quantities, a customer dropdown and a fixed **Review bill** action. Saved bill history was moved to **Accounts → Saved bills**.
- **Accounts** includes three tabs: **Customer ledger**, **Saved bills**, and **Empty jars**. Customer financial ledgers show debit charges and credit payments in separate columns (T-account) with a closing balance. Jar movements show a separate pending-empty-jar balance.
- **Android image selection:** Product editor has a visible file input and Choose image button. If Kodular WebViewer does not implement Android file chooser, use **Open product editor in Chrome** or paste a direct HTTPS image URL. HTML alone cannot add a missing native WebChromeClient chooser.
- **PDF backup:** Bill PDFs upload to the **private Supabase Storage bucket** `fieldflow-bills` under `organization-uuid/{pos|water}/bill-uuid.pdf`. Storage RLS restricts access to active members of the matching organization. Generated signed links expire after 30 minutes.
- **Print / download:** Chrome can print directly; Kodular can open the signed HTTPS PDF URL in the Android browser/PDF viewer using the WebViewStringChange → ActivityStarter bridge. This requires an updated Kodular project/APK; an older installed APK cannot gain native print support solely through HTML.
- **Mobile:** POS uses an independently scrolling image grid and a fixed checkout panel within the viewport; Accounts lists and ledgers use controlled scrolling.
- The exact available Supabase bucket capacity depends on the account plan; **1 GB is not guaranteed**.

### Kodular Android blocks (Version 10)

Add an **ActivityStarter** component: `Action = android.intent.action.VIEW`. In `WebViewer1.WebViewStringChange`, set `ActivityStarter1.DataUri = WebViewer1.WebViewString` and call `ActivityStarter1.StartActivity`. This opens the signed PDF or image-upload fallback URL externally. The website sends it via `window.Kodular.setWebViewString(url)`. For Android Back, call `WebViewer1.EvaluateJS("window.FieldFlowBack && window.FieldFlowBack();")`.

A packaged AIA was generated in this ChatGPT session; it is not part of the GitHub frontend code. Import the updated AIA and build an APK in Kodular before testing print and uploads.

## Version 11 — App-like POS and reliable receipt fallback

- POS remains a dedicated product-photo selection screen, with the customer selector and Review button. Saved bill history is located under **Accounts → Saved bills**, not inside POS.
- Product management is available through **Accounts → Manage products** and the small gear button on POS. Add/Edit product includes a full-surface native file input. Selecting an image uploads via the authenticated Supabase Edge Function to ImgBB and stores its URL/ID on the product row. An HTTPS image-link and **Open in Chrome** alternative are available.
- Review bill displays **every selected item** with editable rate, + / − quantity buttons and × Remove. The subtotal, tax, grand total and amount in words update before confirmation. Saving is disabled when no items remain.
- Customer accounts include a separate **Debit / Credit T-account** (bills vs receipts), and an **Empty jar ledger** showing issued, returned and outstanding jars.
- Mobile POS is constrained to viewport height with an independently scrollable product grid and fixed customer/review controls; cards are not stretched to fill variable product content.
- On a normal browser, Print requests the native print dialog directly; in Kodular Android WebViewer, the fallback saves the generated PDF to the private Supabase bucket `fieldflow-bills` and provides a temporary signed link plus Copy link / Close buttons. PDF storage is limited to approved PDF files and organization members.
- **Kodular limitation:** an Android WebViewer needs native file chooser and PDF/print handlers for fully automatic Android UI. If a particular Kodular APK does not implement these callbacks, HTML/JavaScript cannot force native dialogs; use **Open in Chrome**, **Share PDF**, or the signed PDF link until the AIA is updated accordingly.

The `fieldflow-bills` bucket is **private** (10 MB individual PDF cap in bucket settings); overall storage quota depends on the Supabase account plan, not the bucket's configuration.

### Suggested validation
Test in Chrome and inside the actual Kodular APK: add product photo, verify front-end tile, add item, increase/decrease/remove during review, save bill, visit Accounts → Saved bills, print/download PDF, open customer T-account, verify outstanding and jar returns.
