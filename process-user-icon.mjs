import fs from 'fs';
import sharp from 'sharp';

async function processUserIcon() {
  const inputPath = 'public/user-icon.png';
  const inputJpg = 'public/user-icon.jpg';
  
  let sourceFile = fs.existsSync(inputPath) ? inputPath : 
                   fs.existsSync(inputJpg) ? inputJpg : null;

  if (!sourceFile) {
    console.log('尚未找到 user-icon.png 或 user-icon.jpg，請使用者上傳。');
    return;
  }

  try {
    console.log(`找到圖檔 ${sourceFile}，開始進行裁切與圖示生成...`);

    // 1. 先用 trim 裁掉外部多餘的純白/純色空白範圍 (預設 threshold 可處理純色)
    const trimmedBuffer = await sharp(sourceFile)
      .trim({ threshold: 50 })
      .toBuffer();

    // 取得裁切後的圖片大小
    const metadata = await sharp(trimmedBuffer).metadata();
    const size = Math.min(metadata.width, metadata.height);

    // 2. 裁切成正方形，並套用圓角遮罩來將方形外圍真正變透明
    // 建立一個 SVG 圓角遮罩 (可根據圖片圓角隨意調整 rx 參數)
    const rx = Math.round(size * 0.225); // Apple 典型的圓角比例約為 22.5%
    const maskSvg = `<svg><rect x="0" y="0" width="${size}" height="${size}" rx="${rx}" ry="${rx}" /></svg>`;

    const squareCornerBuffer = await sharp(trimmedBuffer)
      .resize(size, size, { fit: 'cover' })
      .composite([{
        input: Buffer.from(maskSvg),
        blend: 'dest-in'
      }])
      .png()
      .toBuffer();

    // 3. 輸出各種所需的 PWA 圖示尺寸
    await sharp(squareCornerBuffer).resize(64, 64).toFile('public/dino-favicon-64.png');
    
    // iOS Apple Touch Icon (iOS 建議要有不透明背景，可以用淺色填補，但為了符合使用者去掉空白的需求，先保留去背版)
    await sharp(squareCornerBuffer).resize(180, 180).toFile('public/dino-apple-180.png');
    
    // PWA Manifest 一定要的正方形圖案
    await sharp(squareCornerBuffer).resize(192, 192).toFile('public/dino-pwa-192.png');
    await sharp(squareCornerBuffer).resize(512, 512).toFile('public/dino-pwa-512.png');

    // 生成一個含適度留白距離的 Maskable Icon 供 Android 系統裁切
    const maskableBg = `<svg><rect x="0" y="0" width="512" height="512" fill="#d2f2fa" /></svg>`; // 挑選一個類似的淺藍色背景
    await sharp(Buffer.from(maskableBg))
      .composite([{
        input: await sharp(trimmedBuffer).resize(400, 400, {fit: 'contain'}).toBuffer(),
        gravity: 'center'
      }])
      .toFile('public/dino-pwa-maskable-512.png');

    console.log('圖示生成成功！所有新圖示已經寫入 public 目錄中。');
    
  } catch (error) {
    console.error('圖示處理發生錯誤：', error);
  }
}

processUserIcon();
