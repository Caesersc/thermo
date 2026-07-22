# Tip Thermometer

Live-updating support ledger: Ko-fi tips flow in via webhook, a SQLite store
tracks the running total, and a Void Gold HUD dashboard (matching the
Project Glass visual language) shows it ticking up in real time.

**Important correction from the original plan:** X (Twitter) has no public
API for pinning a tweet to a profile — that's a manual, UI-only action, and
Edit Tweet (paid tier) only rewrites text within a short window, not media.
So the pinned tweet is set **once, manually**, linking to this dashboard.
The dashboard is what actually updates live — that's also the only place
real interactivity (animated ticker, live bar fill) can exist at all; a
tweet is always static.

## What's here

```
server.js              Express app: webhook, stats API, image endpoint, static host
lib/store.js           SQLite-backed tip totals + supporter history
lib/generateImage.js   Canvas renderer for the thermometer PNG (og:image + hero graphic)
public/index.html      Dashboard page — polls /api/stats every 5s
scripts/test-image.js  Quick local render check → preview.png
```

## Setup

```bash
npm install
cp .env.example .env
# edit .env: set TIP_GOAL and KOFI_VERIFY_TOKEN
npm start
```

Visit `http://localhost:3000` for the dashboard, `http://localhost:3000/thermometer.png`
for the raw image.

## Wiring up Ko-fi

1. Ko-fi dashboard → **Settings → API**.
2. Copy your **Verification Token** into `.env` as `KOFI_VERIFY_TOKEN`.
3. Set the **Webhook URL** to `https://<your-deployed-domain>/webhooks/kofi`.
4. Send a test donation (Ko-fi has a "send test webhook" button) and confirm
   `/api/stats` reflects it.

Webhook deliveries are deduplicated by `kofi_transaction_id`, so Ko-fi's
automatic retries on failure won't double-count a tip.

## Deploying

Any Node host works (Railway, Render, Fly.io all have free tiers that can
run this). Steps are the same everywhere:

1. Push this repo.
2. Set `TIP_GOAL` and `KOFI_VERIFY_TOKEN` as environment variables on the host.
3. Point Ko-fi's webhook URL at the deployed `/webhooks/kofi` endpoint.
4. Pin one tweet, once, linking to your deployed root URL.

**Note on SQLite persistence:** `data.sqlite` lives on local disk. Railway
and Render's free tiers use ephemeral filesystems on redeploy — fine for
getting started, but if you want tip history to survive redeploys long-term,
swap `lib/store.js` for your Supabase Postgres instance (you're already
running Supabase for the dream journal app, so this is a small lift: same
`addTip`/`getTotal`/etc. function signatures, just backed by a `tips` table
instead of local SQLite).

## Extending later (Phases 2 & 3 from the original plan)

- **Milestone tweets:** since the bot *can* post regular tweets (just not
  pin them), you could fire a one-off tweet at threshold crossings ($250,
  $500...) using `twitter-api-v2` — this needs the paid X API Basic tier
  ($200/mo) for write access, so only worth it if milestone hype matters
  more than the cost.
- **Tip-triggered unlocks:** extend `generateThermometerImage` to accept a
  `supporters` list and render a small credits strip once someone crosses a
  tier — the rendering pipeline already supports arbitrary extra data.
