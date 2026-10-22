// Procesa una imagen para la landing.
//   node procesar.js foto  <entrada> <salida.jpg> [x,y,lado]   recorte cuadrado 600x600 (sin caja: recorte automático por zona de interés)
//   node procesar.js logo  <entrada> <salida.png>              recorta bordes vacíos, máx. 600x300 px
const sharp = require('sharp');
const [tipo, entrada, salida, caja] = process.argv.slice(2);
(async () => {
  let img = sharp(entrada).rotate();
  if (tipo === 'foto') {
    if (caja) { const [left, top, side] = caja.split(',').map(Number); img = sharp(await img.extract({ left, top, width: side, height: side }).toBuffer()); }
    await img.resize(600, 600, { fit: 'cover', position: sharp.strategy.attention })
      .jpeg({ quality: 80, mozjpeg: true }).toFile(salida);
  } else if (tipo === 'logo') {
    await img.trim().resize({ width: 600, height: 300, fit: 'inside', withoutEnlargement: true })
      .png({ compressionLevel: 9, palette: true, quality: 90 }).toFile(salida);
  } else throw new Error('tipo debe ser foto o logo');
  const m = await sharp(salida).metadata();
  console.log(`${salida}  ${m.width}x${m.height}`);
})().catch(e => { console.error(e.message); process.exit(1); });
