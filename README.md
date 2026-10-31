# Rueben's MPS

Rueben's Meal Prep Service: a home-screen app for picking, shopping for, cooking and rating four dinners a week.

- **This week**: browse the menu with photos and tap the saffron **Pick** sticker. The kitchen admin locks in the final four, which builds the grocery list.
- **Groceries**: one shared list, sorted by store section. Ticking an item off shows up on the other phone right away.
- **Cook mode**: big steps you can tick off, ingredient checklist, and the screen stays on.
- **Ratings and favorites**: rate each dinner after cooking; the Cookbook keeps both people's ratings so the winners come back.
- **Kitchen** (admin): load a new week's menu, copy picks and ratings for Claude, swap in your own photos, manage the household.

## How it's built

| Piece | What |
|---|---|
| App | React + Vite, installable as a PWA (`vite-plugin-pwa`) |
| Data and sign-in | Supabase: Postgres with row-level security, email code sign-in, realtime updates, photo storage |
| Hosting | Vercel (static site) |

The database schema, security rules and weekly-workflow functions are in [`supabase/schema.sql`](supabase/schema.sql). The weekly menu format is in [`docs/menu-format.md`](docs/menu-format.md), and past menus live in [`menus/`](menus).

Only emails listed in the `members` table can sign in or see anything. The Supabase publishable key in `src/main.tsx` is meant to be public; security is enforced by the database rules.

## Run it locally

```bash
npm install
npm run dev                 # live data (needs you to sign in with a member email)
VITE_DEMO=1 npm run dev     # sample data in the browser, no account needed
npm run build
```

## One-time Supabase setting

Sign-in is email + password, so Supabase never has to send email (the free plan can't customize its emails).

- Authentication → Sign In / Providers → Email → turn **Confirm email** off.

The first time someone on the guest list signs in, the app asks them to create a password. Only emails in the `members` table get past the email step, and the database rules hide everything from anyone else. To reset a forgotten password, run in the SQL editor:

```sql
update auth.users set encrypted_password = crypt('new-password-here', gen_salt('bf')) where email = 'name@example.com';
```

## Weekly loop

1. Claude writes next week's menu as `menus/YYYY-MM-DD.json`.
2. Rueben loads it in **Kitchen → Load a new week**.
3. Both pick; Rueben locks in four. The grocery list builds itself.
4. Shop, cook, rate.
5. **Kitchen → Copy for Claude** sends picks, requests and ratings back to Claude for the next menu.
