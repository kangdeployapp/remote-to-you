const fs = require('fs');
const path = require('path');

const iconsDir = path.join(__dirname, '..', 'src-tauri', 'icons');
fs.mkdirSync(iconsDir, { recursive: true });

// Minimal 1x1 transparent PNG data
const pngData = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

// Minimal ICO format with 1 image
// ICO Header: 2 bytes reserved (0), 2 bytes type (1 for ico), 2 bytes image count (1)
// Directory Entry: 16 bytes
const icoHeader = Buffer.from([
  0x00, 0x00, // Reserved
  0x01, 0x00, // ICO type
  0x01, 0x00, // 1 image
  // Directory entry (16 bytes)
  0x01,       // Width: 1
  0x01,       // Height: 1
  0x00,       // Colors
  0x00,       // Reserved
  0x01, 0x00, // Color planes
  0x20, 0x00, // Bits per pixel (32)
  pngData.length & 0xFF, (pngData.length >> 8) & 0xFF, (pngData.length >> 16) & 0xFF, (pngData.length >> 24) & 0xFF, // Image size
  0x16, 0x00, 0x00, 0x00 // Offset of image data (22 = 6 + 16)
]);

const icoData = Buffer.concat([icoHeader, pngData]);

fs.writeFileSync(path.join(iconsDir, '32x32.png'), pngData);
fs.writeFileSync(path.join(iconsDir, '128x128.png'), pngData);
fs.writeFileSync(path.join(iconsDir, '128x128@2x.png'), pngData);
fs.writeFileSync(path.join(iconsDir, 'icon.icns'), pngData);
fs.writeFileSync(path.join(iconsDir, 'icon.ico'), icoData);

console.log('Icons successfully generated at:', iconsDir);
