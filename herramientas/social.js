// Genera la imagen para compartir (og-image.jpg 1200x630) y el favicon a partir del logo y Wolfito.
const sharp = require('sharp');
const I = __dirname + '/../concepmi-vi/public/images/';
(async () => {
  const bg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2A0F8F"/><stop offset=".5" stop-color="#4A17C0"/><stop offset="1" stop-color="#3212A0"/></linearGradient>
    <radialGradient id="r" cx=".8" cy=".45" r=".45"><stop offset="0" stop-color="#1FCBEA" stop-opacity=".35"/><stop offset="1" stop-color="#1FCBEA" stop-opacity="0"/></radialGradient></defs>
    <rect width="1200" height="630" fill="url(#g)"/><rect width="1200" height="630" fill="url(#r)"/>
    <polygon points="430,0 445,0 245,630 230,630" fill="#fff" opacity=".06"/>
    <text x="70" y="305" font-family="Segoe UI, Arial" font-weight="700" font-size="30" fill="#fff">Congreso Nacional de Conexiones</text><text x="70" y="343" font-family="Segoe UI, Arial" font-weight="700" font-size="30" fill="#fff">Estudiantiles del PMI</text>
    <text x="70" y="440" font-family="Segoe UI, Arial" font-weight="900" font-size="84" fill="#fff">24 y 26 NOV</text>
    <rect x="70" y="470" width="6" height="64" fill="#1FCBEA"/>
    <text x="92" y="497" font-family="Segoe UI, Arial" font-weight="700" font-size="28" fill="#fff">Lima 2026 · UNMSM</text>
    <text x="92" y="530" font-family="Segoe UI, Arial" font-size="24" fill="#E3DFED">VI edición · Entradas a la venta</text>
  </svg>`);
  const logo = await sharp(I + 'concepmi-vi-logo.png').resize({ width: 640 }).toBuffer();
  const wolf = await sharp(I + 'wolfito-concepmi.png').resize({ height: 560 }).toBuffer();
  await sharp(bg).composite([{ input: logo, left: 70, top: 150 }, { input: wolf, left: 760, top: 50 }])
    .jpeg({ quality: 84, mozjpeg: true }).toFile(I + 'og-image.jpg');
  await sharp(__dirname + '/../WOLFITO FONDO TRANSPARENTE.png').extract({ left: 290, top: 40, width: 520, height: 520 })
    .resize(128, 128).png({ palette: true }).toFile(I + 'favicon.png');
})();
