# Artist Portfolio Prototype

Minimal artist portfolio with horizontal scrolling works, fog-like image reveals, and a password-protected admin panel.

## Local development

```bash
npm install
npm run dev
```

Admin panel:

```txt
/admin
```

Set `ADMIN_PASSWORD` before using admin routes.

## Supabase setup (required for the live site)

This app can run locally from `data/site.json`, but production runs fully on Supabase
for persistent content and images. **The database tables must exist before the admin
panel can save** — if you only created the Storage bucket, image uploads will work but
saving content will fail with a 500.

1. Create a Supabase project.
2. Open the Supabase SQL editor.
3. Run `supabase/schema.sql`. This creates the `site_settings`, `menu_items`, `pages`,
   and `works` tables plus the `portfolio-images` storage bucket.
4. In Vercel, add these environment variables:

```txt
ADMIN_PASSWORD=your-admin-password
ADMIN_SESSION_SECRET=use-a-separate-long-random-secret
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_STORAGE_BUCKET=portfolio-images
```

5. Redeploy on Vercel.

If your Supabase schema already exists from an earlier version, also run:

```txt
supabase/migrations/20260616_add_hidden_and_revision.sql
```

### First-run content migration

The first time the app can reach the Supabase tables, it automatically imports the
content from `data/site.json` (menu, pages, and works) and sets a `seeded` flag in
`site_settings` so it never re-imports. From then on Supabase is the single source of
truth and the admin panel reads and writes online only. Images uploaded through admin
are stored in the public Supabase Storage bucket.

If something goes wrong saving in the admin, the panel now shows the underlying
database error (for example `relation "works" does not exist`), which usually means
`supabase/schema.sql` has not been run yet.

## Notes

The service role key is used only server-side in API routes. Do not expose it in client-side code or prefix it with `NEXT_PUBLIC_`.
