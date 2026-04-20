# Realistic Supabase Seed

This seed pack prepares a production-like demo dataset for BuildShop (Render + Vercel + Supabase).

## What it generates

- users: staff + customers
- categories, brands, suppliers
- products with attributes and inventory
- product images (URL links)
- promo codes
- carts, cart items, wishlists
- reviews and notifications

Output file:

- `server/seed_supabase_realistic.sql`

## Generate SQL

```powershell
python C:\Users\1111\WebstormProjects\buildshop\scripts\generate_realistic_supabase_seed.py
```

## Apply in Supabase

1. Open Supabase SQL Editor.
2. Run SQL from `server/seed_supabase_realistic.sql`.

## Notes

- Script is idempotent for key entities via `ON CONFLICT`.
- Product images use public demo URLs from `picsum.photos`.
- Default test password for generated customers is `user123`.

