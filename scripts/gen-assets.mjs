// Generates the placeholder artwork and globe dots. Run once: node scripts/gen-assets.mjs
// Swap public/images/*.jpg for your own photos whenever you're ready — same filenames, no code changes.
import { readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
import { feature } from 'topojson-client';
import { geoContains } from 'd3-geo';

const W = 1920, H = 1080;
const seeded = (s) => () => ((s = Math.imul(s ^ (s >>> 15), 2654435761 | 1) >>> 0), (s % 100000) / 100000);

const scenes = [
  { name: 'hero', seed: 11, skin: '#c9a184', cloth: ['#3a3128', '#55483a', '#2a2a30', '#6b5a48', '#d8cdb8'], bg: '#17140f', count: 46, tint: '#1a1420', mono: false },
  { name: 'chapter-1', seed: 23, skin: '#c6a07c', cloth: ['#3d3a30', '#6a6248', '#2d3030', '#8c8468', '#50442f'], bg: '#2a2517', count: 30, tint: '#2b2410', board: '#e0a020' },
  { name: 'chapter-2', seed: 37, skin: '#d6b090', cloth: ['#1f3346', '#2c4a62', '#152230', '#44606f', '#b6b8b2'], bg: '#101d29', count: 30, tint: '#0d2030', board: '#3a8ccf' },
  { name: 'chapter-3', seed: 41, skin: '#d4ae8e', cloth: ['#e8e8dc', '#d8dac8', '#3a3f35', '#c4c8b0', '#2c3330'], bg: '#6e7458', count: 12, tint: '#30351f' },
  { name: 'chapter-4', seed: 53, skin: '#cfcfcf', cloth: ['#1b1b1b', '#3b3b3b', '#efefef', '#6c6c6c', '#101010'], bg: '#2a2a2a', count: 16, tint: '#111111', mono: true },
  { name: 'chapter-5', seed: 67, skin: '#b08e78', cloth: ['#1b2b33', '#25404a', '#101a20', '#39525a', '#6d8088'], bg: '#0b1519', count: 6, tint: '#07181e', board: '#4fb3c8' },
  { name: 'chapter-6', seed: 71, skin: '#000', cloth: [], bg: '#0d1216', count: 0, tint: '#0d1418', chart: true },
  { name: 'tape', seed: 83, skin: '#000', cloth: [], bg: '#8c8a82', count: 0, tint: '#55544e', streak: true },
];

function scene(s) {
  const r = seeded(s.seed);
  const pick = (a) => a[Math.floor(r() * a.length)];
  let shapes = '';
  if (s.board) {
    for (let y = 40; y < 460; y += 46) for (let x = 30; x < W; x += 92) {
      if (r() > 0.45) shapes += `<rect x="${x}" y="${y}" width="${40 + r() * 34}" height="20" fill="${s.board}" opacity="${0.25 + r() * 0.6}"/>`;
    }
  }
  if (s.chart) {
    let price = 120;
    for (let x = 0; x < W; x += 26) {
      price += (r() - 0.34) * 34;
      const up = r() > 0.55, h = 20 + r() * 110;
      shapes += `<rect x="${x}" y="${price}" width="12" height="${h}" fill="${up ? '#e6406f' : '#3f9e8b'}"/>`;
      const v = 60 + r() * 330;
      shapes += `<rect x="${x}" y="${H - v}" width="16" height="${v}" fill="${up ? '#e6406f' : '#3f9e8b'}" opacity=".62"/>`;
    }
  }
  if (s.streak) {
    for (let i = 0; i < 26; i++) {
      const y = r() * H;
      shapes += `<rect x="-20" y="${y}" width="${W + 40}" height="${10 + r() * 90}" fill="${pick(['#a8a69e', '#74736c', '#c4c2ba', '#5f5e58'])}" opacity=".6"/>`;
    }
    shapes += `<rect x="1660" y="0" width="300" height="${H}" fill="#c79a1f" opacity=".82"/>`;
    shapes += `<rect x="0" y="0" width="150" height="${H}" fill="#55554f" opacity=".7"/>`;
  }
  // A loose, out-of-focus crowd: rows of shoulders and heads, larger toward the camera.
  for (let i = 0; i < s.count; i++) {
    const depth = i / Math.max(1, s.count - 1);
    const size = 70 + depth * 210;
    const x = r() * W;
    const y = 200 + depth * 720 + (r() - 0.5) * 80;
    const cloth = pick(s.cloth);
    shapes += `<rect x="${x - size * 0.95}" y="${y + size * 0.62}" width="${size * 1.9}" height="${size * 3}" rx="${size * 0.55}" fill="${cloth}"/>`;
    shapes += `<ellipse cx="${x}" cy="${y}" rx="${size * 0.3}" ry="${size * 0.38}" fill="${s.skin}" opacity="${0.35 + r() * 0.4}"/>`;
    shapes += `<ellipse cx="${x}" cy="${y - size * 0.2}" rx="${size * 0.33}" ry="${size * 0.26}" fill="${pick(['#17120e', '#2c2118', '#4a3a2c', '#77706a'])}"/>`;
    if (r() > 0.55) shapes += `<rect x="${x + size * 0.4}" y="${y + size * 0.5}" width="${size * 0.8}" height="${size * 1.05}" fill="#e6e0d0" opacity=".85" transform="rotate(${r() * 50 - 25} ${x} ${y})"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs>
      <filter id="soft"><feGaussianBlur stdDeviation="${s.streak ? '0 14' : s.chart ? 3 : 24}"/></filter>
      <radialGradient id="vig" cx="50%" cy="46%" r="72%"><stop offset="35%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity=".82"/></radialGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="${s.bg}"/>
    <g filter="url(#soft)">${shapes}</g>
    <rect width="${W}" height="${H}" fill="${s.tint}" opacity=".28"/>
    <rect width="${W}" height="${H}" fill="url(#vig)"/>
  </svg>`;
}

async function grainFor(seed) {
  const r = seeded(seed), px = Buffer.alloc(W * H);
  for (let i = 0; i < px.length; i++) px[i] = 128 + (r() - 0.5) * 34;
  return sharp(px, { raw: { width: W, height: H, channels: 1 } }).png().toBuffer();
}

for (const s of scenes) {
  let img = sharp(Buffer.from(scene(s)));
  if (s.mono) img = img.grayscale();
  const base = await img.png().toBuffer();
  await sharp(base)
    .composite([{ input: await grainFor(s.seed + 1), blend: 'soft-light' }])
    .jpeg({ quality: 72, mozjpeg: true })
    .toFile(`public/images/${s.name}.jpg`);
  console.log('image', s.name);
}

const topo = JSON.parse(readFileSync('node_modules/world-atlas/land-110m.json', 'utf8'));
const land = feature(topo, topo.objects.land);
const dots = [];
for (let lat = -58; lat <= 82; lat += 1.15) {
  const step = 1.15 / Math.max(0.25, Math.cos((lat * Math.PI) / 180));
  for (let lon = -180; lon < 180; lon += step) {
    if (geoContains(land, [lon, lat])) dots.push(Math.round(lat * 10) / 10, Math.round(lon * 10) / 10);
  }
}
writeFileSync('public/data/land-dots.json', JSON.stringify(dots));
console.log('globe dots', dots.length / 2);
