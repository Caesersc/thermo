require('dotenv').config();
const express = require('express');
const store = require('./lib/store');
const { generateThermometerImage } = require('./lib/generateImage');

const app = express();
const PORT = process.env.PORT || 3000;

// Ko-fi sends application/x-www-form-urlencoded with a `data` field
// containing a JSON string.
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ---------- Ko-fi webhook ----------
app.post('/webhooks/kofi', (req, res) => {
  try {
    const raw = req.body.data;
    if (!raw) return res.status(400).send('missing data');

    const payload = JSON.parse(raw);

    // Verify the shared verification token Ko-fi sends with every webhook.
    if (process.env.KOFI_VERIFY_TOKEN && payload.verification_token !== process.env.KOFI_VERIFY_TOKEN) {
      return res.status(401).send('bad token');
    }

    const isNew = store.addTip({
      supporterName: payload.from_name,
      amount: parseFloat(payload.amount),
      currency: payload.currency || 'USD',
      message: payload.message || '',
      source: 'kofi',
      externalId: payload.kofi_transaction_id || payload.message_id,
    });

    console.log(isNew ? `New tip recorded: ${payload.from_name} $${payload.amount}` : 'Duplicate webhook delivery, ignored');
    res.status(200).send('ok');
  } catch (err) {
    console.error('Ko-fi webhook error:', err);
    res.status(500).send('error');
  }
});

// ---------- Live presence ----------
// Ephemeral by design — an in-memory map is fine since "who's online right
// now" doesn't need to survive a restart. Each browser tab pings /api/heartbeat
// every 10s; anything not seen in the last 20s is dropped.
const activeClients = new Map(); // clientId -> last-seen (ms)
const PRESENCE_TIMEOUT_MS = 20000;

function getOnlineCount() {
  const cutoff = Date.now() - PRESENCE_TIMEOUT_MS;
  for (const [id, lastSeen] of activeClients) {
    if (lastSeen < cutoff) activeClients.delete(id);
  }
  return activeClients.size;
}

app.post('/api/heartbeat', (req, res) => {
  const clientId = req.body && req.body.clientId;
  if (clientId) activeClients.set(String(clientId).slice(0, 100), Date.now());
  res.json({ online: getOnlineCount() });
});

// ---------- Click tracking ----------
app.post('/api/track-click', (req, res) => {
  const linkId = req.body && req.body.linkId;
  if (linkId) store.recordClick(linkId);
  res.status(204).end();
});

// ---------- Private admin stats (add STATS_KEY to your .env, then visit
// stats.html and enter it) ----------
app.get('/api/admin-stats', (req, res) => {
  if (!process.env.STATS_KEY || req.query.key !== process.env.STATS_KEY) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  res.json({
    online: getOnlineCount(),
    totalClicks: store.getTotalClicks(),
    clicksByLink: store.getClickCounts(),
    totalTips: store.getSupporterCount(),
    totalRaised: store.getTotal(),
  });
});

// ---------- Stats API (polled by the dashboard page) ----------
app.get('/api/stats', (req, res) => {
  const total = store.getTotal();
  const goal = store.getGoal();
  const last = store.getLastSupporter();
  res.json({
    total,
    goal,
    pct: Math.min(1, total / goal),
    lastSupporter: last ? last.supporter_name : null,
    supporterCount: store.getSupporterCount(),
    online: getOnlineCount(),
    recent: store.getRecentSupporters(8).map(t => ({
      name: t.supporter_name,
      amount: t.amount,
      message: t.message,
      at: t.created_at,
    })),
  });
});

// ---------- Live-rendered thermometer image ----------
// Used both as the dashboard's hero graphic AND as the og:image, so a link
// preview (e.g. in a Discord/Slack/iMessage share) shows current progress.
app.get('/thermometer.png', (req, res) => {
  const total = store.getTotal();
  const goal = store.getGoal();
  const last = store.getLastSupporter();
  const buf = generateThermometerImage({
    total,
    goal,
    lastSupporter: last ? last.supporter_name : null,
    supporterCount: store.getSupporterCount(),
  });
  res.set('Content-Type', 'image/png');
  res.set('Cache-Control', 'no-cache, max-age=0');
  res.send(buf);
});

// ---------- Dashboard page ----------
app.use(express.static('public'));

app.listen(PORT, () => {
  console.log(`Tip thermometer server running on port ${PORT}`);
});