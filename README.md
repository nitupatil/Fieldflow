# FieldFlow CRM

Responsive sales and field-visit CRM for desktop and mobile browsers.

## Live frontend

After enabling GitHub Pages on the `main` branch (root folder), open:

**https://nitupatil.github.io/Fieldflow/**

For this GitHub repository, go to **Settings → Pages → Build and deployment → Deploy from a branch → main → /(root) → Save**.

## Architecture

- **Frontend:** Static HTML, CSS and JavaScript; mobile-first responsive layout with desktop sidebar and mobile bottom navigation
- **CRM backend & login:** Supabase project `fieldflowpro` (project ref `pldwrbjolcytodqedrqc`), with PostgreSQL and Row Level Security
- **Maps:** Leaflet + OpenStreetMap tiles, geolocation and directions links
- **Product images:** Authenticated Supabase Edge Function `upload-product-image` → ImgBB. The image API key is retained server-side in Supabase Vault.
- **No Node.js runtime or static-site build step** is required.

## Pages setup

1. Enable GitHub Pages for `main` / `/(root)` in this repository's Settings → Pages.
2. Verify `https://nitupatil.github.io/Fieldflow/` opens the login screen.
3. In Supabase project **Authentication → URL Configuration**, add `https://nitupatil.github.io/Fieldflow/` to allowed Redirect URLs (and keep any other actively used application URL).
4. Confirm **Authentication → Providers → Email** is configured and email confirmation is working.
5. Create a workspace by signing up. Existing organizations and staff are separated using Supabase row-level security. Team invitations are generated in the Workspace Settings screen.
6. Test the complete lead → quotation → order → invoice → payment flow with a test account before using it for financial records.

### Security

Do not commit ImgBB keys, Supabase `service_role` keys, Postgres passwords, OAuth secrets or private customer exports. The Supabase **publishable** key in `app.js` is public by design; Supabase RLS and server-side privilege checks enforce access. The ImgBB credential is never in the static frontend.

### Development

Edit `index.html`, `styles.css` or `app.js` and push to `main`. GitHub Pages republishes the site after a successful build.

### Status

This repository contains the CRM frontend. The business database and authenticated upload function are hosted on Supabase, **not** GitHub Pages. GitHub Pages cannot itself run PHP, Node.js or a private backend. The application requires internet access and a configured Supabase project.
