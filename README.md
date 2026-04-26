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

Default admin password is `admin` unless `ADMIN_PASSWORD` is set.

## Supabase setup

This app can run locally from `data/site.json`, but production should use Supabase for persistent content and images.

1. Create a Supabase project.
2. Open the Supabase SQL editor.
3. Run `supabase/schema.sql`.
4. In Vercel, add these environment variables:

```txt
ADMIN_PASSWORD=your-admin-password
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_STORAGE_BUCKET=portfolio-images
```

5. Redeploy on Vercel.

Images uploaded through admin will be stored in the public Supabase Storage bucket. Site content, menu items, pages, and works will be stored in Supabase Postgres.

## Notes

The service role key is used only server-side in API routes. Do not expose it in client-side code or prefix it with `NEXT_PUBLIC_`.
