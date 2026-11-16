import fs from 'fs';
import zlib from 'zlib';

function createPNG(width, height) {
  // A clean branded dark violet/blue PNG icon with neural core
  const bytesPerPixel = 4;
  const rowSize = width * bytesPerPixel;
  const rawData = Buffer.alloc((rowSize + 1) * height);

  const cx = width / 2;
  const cy = height / 2;
  const radius = width * 0.45;
  const coreRadius = width * 0.22;

  let offset = 0;
  for (let y = 0; y < height; y++) {
    rawData[offset++] = 0; // Filter type 0 (None)
    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Background rounded squircle / circle
      let r = 9, g = 13, b = 22, a = 255; // #090d16

      if (dist < radius) {
        // Ambient soft gradient
        const t = dist / radius;
        r = Math.floor(9 + (30 - 9) * (1 - t));
        g = Math.floor(13 + (25 - 13) * (1 - t));
        b = Math.floor(22 + (55 - 22) * (1 - t));

        // Neural core gradient
        if (dist < coreRadius) {
          const ct = dist / coreRadius;
          // Violet #a855f7 to Cyan #38bdf8
          r = Math.floor(168 * (1 - ct) + 56 * ct);
          g = Math.floor(85 * (1 - ct) + 189 * ct);
          b = Math.floor(247 * (1 - ct) + 248 * ct);
        } else if (Math.abs(dist - width * 0.32) < width * 0.015) {
          // Orbital ring
          r = 192; g = 132; b = 252; // #c084fc
        }
      }

      rawData[offset++] = r;
      rawData[offset++] = g;
      rawData[offset++] = b;
      rawData[offset++] = a;
    }
  }

  const deflated = zlib.deflateSync(rawData);

  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace

  const ihdr = makeChunk('IHDR', ihdrData);
  const idat = makeChunk('IDAT', deflated);
  const iend = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

function makeChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(4 + 4 + len + 4);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4);
  data.copy(chunk, 8);
  const crc = crc32(chunk.subarray(4, 8 + len));
  chunk.writeInt32BE(crc, 8 + len);
  return chunk;
}

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let j = 0; j < 8; j++) {
      c = (c >>> 1) ^ (-(c & 1) & 0xEDB88320);
    }
  }
  return ~c;
}

if (!fs.existsSync('./public')) {
  fs.mkdirSync('./public', { recursive: true });
}

fs.writeFileSync('./public/pwa-192x192.png', createPNG(192, 192));
fs.writeFileSync('./public/pwa-512x512.png', createPNG(512, 512));
fs.writeFileSync('./public/pwa-maskable-512x512.png', createPNG(512, 512));
fs.writeFileSync('./public/apple-touch-icon.png', createPNG(180, 180));
console.log('PWA icons successfully generated in /public');
