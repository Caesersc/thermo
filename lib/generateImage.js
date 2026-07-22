const { createCanvas } = require('@napi-rs/canvas');

const WIDTH = 1200;
const HEIGHT = 675; // 16:9, ideal for X media previews

// "Void Gold" palette — deep near-black background, warm gold accents,
// thin blueprint-style grid lines for the institutional-HUD feel.
const COLORS = {
  bgTop: '#0a0a0d',
  bgBottom: '#131318',
  grid: 'rgba(212, 175, 55, 0.06)',
  gold: '#d4af37',
  goldBright: '#f2d572',
  goldDim: 'rgba(212, 175, 55, 0.35)',
  text: '#eae6da',
  textDim: '#8a8578',
  barBg: 'rgba(255,255,255,0.06)',
  barBorder: 'rgba(212, 175, 55, 0.4)',
};

function drawGrid(ctx) {
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  const step = 40;
  for (let x = 0; x <= WIDTH; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, HEIGHT);
    ctx.stroke();
  }
  for (let y = 0; y <= HEIGHT; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }
}

function formatMoney(n) {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

/**
 * @param {Object} opts
 * @param {number} opts.total - current amount raised
 * @param {number} opts.goal - goal amount
 * @param {string} [opts.lastSupporter] - name of most recent supporter
 * @param {number} [opts.supporterCount] - total number of supporters
 * @param {Date} [opts.updatedAt] - timestamp to stamp on the image
 * @returns {Buffer} PNG buffer
 */
function generateThermometerImage({ total, goal, lastSupporter, supporterCount, updatedAt = new Date() }) {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');

  // Background gradient
  const bg = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  bg.addColorStop(0, COLORS.bgTop);
  bg.addColorStop(1, COLORS.bgBottom);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  drawGrid(ctx);

  // Outer frame (blueprint corner brackets)
  const pad = 32;
  ctx.strokeStyle = COLORS.goldDim;
  ctx.lineWidth = 1.5;
  const bracket = 24;
  [
    [pad, pad, 1, 1],
    [WIDTH - pad, pad, -1, 1],
    [pad, HEIGHT - pad, 1, -1],
    [WIDTH - pad, HEIGHT - pad, -1, -1],
  ].forEach(([x, y, dx, dy]) => {
    ctx.beginPath();
    ctx.moveTo(x, y + bracket * dy);
    ctx.lineTo(x, y);
    ctx.lineTo(x + bracket * dx, y);
    ctx.stroke();
  });

  // Eyebrow label
  ctx.fillStyle = COLORS.textDim;
  ctx.font = '600 20px "Segoe UI", Helvetica, Arial, sans-serif';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('SUPPORT THE PROJECT', pad + 40, pad + 50);

  // Big total
  ctx.fillStyle = COLORS.goldBright;
  ctx.font = '700 96px "Segoe UI", Helvetica, Arial, sans-serif';
  ctx.fillText(formatMoney(total), pad + 40, 190);

  // Goal label
  ctx.fillStyle = COLORS.textDim;
  ctx.font = '400 26px "Segoe UI", Helvetica, Arial, sans-serif';
  ctx.fillText(`raised of ${formatMoney(goal)} goal`, pad + 44, 230);

  // Progress bar
  const barX = pad + 40;
  const barY = 280;
  const barW = WIDTH - pad * 2 - 80;
  const barH = 46;
  const pct = Math.max(0, Math.min(1, total / goal));

  ctx.fillStyle = COLORS.barBg;
  roundRect(ctx, barX, barY, barW, barH, 8);
  ctx.fill();

  if (pct > 0) {
    const fillGrad = ctx.createLinearGradient(barX, 0, barX + barW * pct, 0);
    fillGrad.addColorStop(0, '#9a7b1f');
    fillGrad.addColorStop(1, COLORS.goldBright);
    ctx.fillStyle = fillGrad;
    roundRect(ctx, barX, barY, Math.max(barH, barW * pct), barH, 8);
    ctx.fill();
  }

  ctx.strokeStyle = COLORS.barBorder;
  ctx.lineWidth = 1.5;
  roundRect(ctx, barX, barY, barW, barH, 8);
  ctx.stroke();

  // Percent label centered on bar
  ctx.fillStyle = pct > 0.12 ? '#0a0a0d' : COLORS.text;
  ctx.font = '700 22px "Segoe UI", Helvetica, Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`${Math.round(pct * 100)}%`, barX + 16, barY + 30);
  ctx.textAlign = 'start';

  // Footer: last supporter + count
  ctx.fillStyle = COLORS.text;
  ctx.font = '400 22px "Segoe UI", Helvetica, Arial, sans-serif';
  const supporterLine = lastSupporter
    ? `Latest: ${lastSupporter}${supporterCount ? `  ·  ${supporterCount} supporter${supporterCount === 1 ? '' : 's'}` : ''}`
    : 'Be the first to support';
  ctx.fillText(supporterLine, barX, 370);

  // Timestamp, bottom-right, small
  ctx.fillStyle = COLORS.textDim;
  ctx.font = '400 16px "Segoe UI", Helvetica, Arial, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`updated ${updatedAt.toISOString().slice(0, 16).replace('T', ' ')} UTC`, WIDTH - pad - 40, HEIGHT - pad - 20);
  ctx.textAlign = 'start';

  return canvas.toBuffer('image/png');
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

module.exports = { generateThermometerImage, WIDTH, HEIGHT };
