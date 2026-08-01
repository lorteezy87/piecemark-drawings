# PieceMark — Steel Drawings Control

Drawings management for steel fabrication and erection subcontractors.

## Live cloud deploy (team URL)

### Option A — Import on Vercel (recommended, ~2 minutes)

1. Open [vercel.com/new](https://vercel.com/new)
2. Import this GitHub repo: `lorteezy87/piecemark-drawings`
3. Deploy with defaults (build: `npm run build`)
4. Share the production URL with your team

You get a permanent URL like `https://piecemark-drawings.vercel.app` that anyone can open.

### Option B — Custom domain

In the Vercel project → **Settings → Domains**, add e.g. `drawings.yourcompany.com` and follow DNS instructions.

### Important: multi-user data

Today the demo stores drawing status / markups **in each browser**. For a real shared job register (everyone sees the same holds and RFIs), the next step is cloud database + sign-in — ask for that in chat.

## Local / preview

```bash
npm install
npm run dev
```
