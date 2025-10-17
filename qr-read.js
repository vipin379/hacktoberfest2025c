const Jimp = require("jimp");
const QrCode = require("qrcode-reader");

async function decodeQrFromImage(imagePath) {
  const image = await Jimp.read(imagePath);
  return new Promise((resolve, reject) => {
    const qr = new QrCode();
    qr.callback = (error, value) => {
      if (error) return reject(error);
      resolve(value ? value.result : null);
    };
    qr.decode(image.bitmap);
  });
}

async function main() {
  const imagePath = process.argv[2];
  if (!imagePath) {
    console.error("Usage: node qr-read.js <imagePath>");
    process.exit(1);
  }
  try {
    const result = await decodeQrFromImage(imagePath);
    if (!result) {
      console.error("No QR code found in image.");
      process.exit(2);
    }
    console.log(result);
  } catch (err) {
    console.error("Failed to decode QR:", err && err.message ? err.message : err);
    process.exit(1);
  }
}

main();


