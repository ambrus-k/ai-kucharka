import sharp from 'sharp';

const svgPath = './public/app-icon.svg';
const out512 = './public/icon-512x512.png';
const out192 = './public/icon-192x192.png';

async function main() {
  try {
    console.log('Generating high-res 512x512 PWA icon...');
    await sharp(svgPath)
      .resize(512, 512)
      .png()
      .toFile(out512);
    console.log('Saved:', out512);

    console.log('Generating 192x192 PWA icon...');
    await sharp(svgPath)
      .resize(192, 192)
      .png()
      .toFile(out192);
    console.log('Saved:', out192);

    console.log('Icons generated successfully!');
  } catch (err) {
    console.error('Error generating icons:', err);
    process.exit(1);
  }
}

main();
