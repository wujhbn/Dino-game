import fs from 'fs';
import sharp from 'sharp';

const grid = [
  "                        ",
  "             ########   ",
  "             #########  ",
  "             ## ### ##  ",
  "             #########  ",
  "             #########  ",
  "             ####       ",
  "             ######     ",
  "    #       #####       ",
  "   ##      #######      ",
  "  ###     #########     ",
  " ####    ##########     ",
  " ####    #####   ##     ",
  " ##################     ",
  "  ################      ",
  "   ##############       ",
  "    ###########         ",
  "     #########          ",
  "      ####              ",
  "      #  #              ",
  "      #  #              ",
  "     ##  ##             ",
  "                        "
];

let dinoRects = "";
for(let y=0; y<grid.length; y++) {
  for(let x=0; x<grid[y].length; x++) {
    if(grid[y][x] === '#') {
       dinoRects += `<rect x="${x}" y="${y}" width="1.03" height="1.03" />\n`;
    }
  }
}

// Generate the SVG String
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <!-- Vibrant App Background -->
    <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFDEE9" />
      <stop offset="100%" stop-color="#B5FFFC" />
    </linearGradient>
    
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="6" flood-color="#000" flood-opacity="0.15"/>
    </filter>
  </defs>
  
  <rect width="512" height="512" fill="url(#bg)" />

  <!-- Sun Graphic -->
  <circle cx="380" cy="160" r="80" fill="#FFF" opacity="0.6" />

  <!-- Pixel Clouds -->
  <g fill="#FFF" opacity="0.8">
    <rect x="60" y="120" width="40" height="20" rx="10" />
    <rect x="80" y="100" width="40" height="40" rx="10" />
    <rect x="110" y="110" width="30" height="30" rx="10" />
  </g>

  <!-- Ground Landscape -->
  <path d="M 0 380 Q 256 340 512 380 V 512 H 0 Z" fill="#74ebd5" opacity="0.3" />
  <path d="M 0 400 L 512 400 L 512 512 L 0 512 Z" fill="#9FACE6" opacity="0.9" />
  <path d="M 0 420 L 512 420 L 512 512 L 0 512 Z" fill="#74ebd5" />

  <!-- Minimal Pixel Cactus -->
  <g fill="#2D3436" transform="translate(360, 240) scale(16)">
     <rect x="3" y="0" width="3" height="11" />
     <rect x="0" y="4" width="3" height="2" />
     <rect x="0" y="1" width="2" height="4" />
     <rect x="6" y="3" width="3" height="2" />
     <rect x="7" y="0" width="2" height="4" />
  </g>

  <!-- Classic Pixel Dino but Cute -->
  <g transform="translate(80, 50) scale(16)" fill="#2D3436" filter="url(#shadow)">
    ${dinoRects}
  </g>

  <!-- Cute Eyes Overwrite -->
  <rect x="295" y="86" width="30" height="30" fill="#FFF" />
  <rect x="300" y="90" width="15" height="15" fill="#000" />
  <rect x="305" y="95" width="5" height="5" fill="#FFF" />
  
  <rect x="156" y="274" width="16" height="11" fill="#FFB6C1" opacity="0.8" />
</svg>`;

// We will save out the base SVG just in case
fs.writeFileSync('public/icon-base.svg', svgContent);

// Use Sharp to generate correctly formatted PNGs for caching bypass
const svgBuffer = Buffer.from(svgContent);

async function generateIcons() {
  try {
    // Favicon (small)
    await sharp(svgBuffer).resize(64, 64).png().toFile('public/dino-favicon-64.png');
    // Apple Touch Icon
    await sharp(svgBuffer).resize(180, 180).png().toFile('public/dino-apple-180.png');
    // PWA Manifest Icons
    await sharp(svgBuffer).resize(192, 192).png().toFile('public/dino-pwa-192.png');
    await sharp(svgBuffer).resize(512, 512).png().toFile('public/dino-pwa-512.png');
    
    // Maskable icon with padding
    const paddedSvgContent = svgContent.replace('viewBox="0 0 512 512"', 'viewBox="-64 -64 640 640"');
    const paddedSvgBuffer = Buffer.from(paddedSvgContent);
    await sharp(paddedSvgBuffer).resize(512, 512).png().toFile('public/dino-pwa-maskable-512.png');

    console.log('Successfully generated all icon sizes with sharp!');
  } catch (error) {
    console.error('Error generating icons:', error);
  }
}

generateIcons();
