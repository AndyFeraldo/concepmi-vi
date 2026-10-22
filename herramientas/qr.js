// Genera el QR del grupo de WhatsApp: node qr.js <enlace>
const QR = require('qrcode');
const url = process.argv[2];
QR.toFile(__dirname + '/../concepmi-vi/public/images/qr-grupo-whatsapp.png', url,
  { width: 480, margin: 1, color: { dark: '#170D56', light: '#FFFFFF' }, errorCorrectionLevel: 'M' })
  .then(() => console.log('QR listo para', url));
