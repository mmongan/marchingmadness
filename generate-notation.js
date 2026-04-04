#!/usr/bin/env node

/**
 * Generate pre-computed notation graphics for the music VR application.
 * This script uses Puppeteer to automate the browser and render OSMD notation.
 */

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateNotation() {
  console.log('🎵 Generating pre-computed notation graphics...\n');

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    
    // Set viewport for consistent rendering
    await page.setViewport({ width: 1920, height: 1080 });

    // Navigate to the dev server
    console.log('📍 Connecting to localhost:5173...');
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle2', timeout: 30000 });

    console.log('⏳ Waiting for OSMD to load...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('🎼 Rendering notation...');
    
    // Call the global function
    const downloadUrls = await page.evaluate(async () => {
      return new Promise(async (resolve) => {
        const urls = [];

        const osmdContainer = document.createElement("div");
        osmdContainer.style.position = "absolute";
        osmdContainer.style.top = "-9999px";
        osmdContainer.style.width = "8192px";
        document.body.appendChild(osmdContainer);

        const osmd = new OpenSheetMusicDisplay(osmdContainer, {
          backend: "canvas",
          drawTitle: false,
          drawPartNames: false,
          autoResize: false,
          engravingRules: {
            StaffLineWidth: 5.0,
            StemWidth: 5.5,
            BeamWidth: 3.5,
            LedgerLineWidth: 5.0
          }
        });

        osmd.zoom = 5.0;

        // Generate random music
        const steps = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
        const octaves = [4, 5];
        let measuresXml = "";
        for (let m = 1; m <= 32; m++) {
          let measureContent = `<measure number="${m}">\n`;
          if (m === 1) {
            measureContent += `<attributes><divisions>1</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>\n`;
          }
          for (let n = 0; n < 4; n++) {
            const randomStep = steps[Math.floor(Math.random() * steps.length)];
            const randomOctave = octaves[Math.floor(Math.random() * octaves.length)];
            measureContent += `<note><pitch><step>${randomStep}</step><octave>${randomOctave}</octave></pitch><duration>1</duration><type>quarter</type></note>\n`;
          }
          measureContent += `</measure>\n`;
          measuresXml += measureContent;
        }

        const musicXml = `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd"><score-partwise version="3.1"><part-list><score-part id="P1"><part-name>Notation</part-name></score-part></part-list><part id="P1">${measuresXml}</part></score-partwise>`;

        await osmd.load(musicXml);
        osmd.render();

        const osmdCanvas = osmdContainer.querySelector("canvas");
        if (osmdCanvas) {
          const totalPixelsW = osmdCanvas.width;
          const totalPixelsH = osmdCanvas.height;
          const maxTexSize = 4096;
          const slices = Math.ceil(totalPixelsW / maxTexSize);

          for (let i = 0; i < slices; i++) {
            const srcX = i * maxTexSize;
            const slicePixW = Math.min(maxTexSize, totalPixelsW - srcX);

            const sliceCanvas = document.createElement("canvas");
            sliceCanvas.width = slicePixW;
            sliceCanvas.height = totalPixelsH;

            const ctx = sliceCanvas.getContext("2d");
            ctx.fillStyle = "white";
            ctx.fillRect(0, 0, slicePixW, totalPixelsH);
            ctx.drawImage(osmdCanvas, srcX, 0, slicePixW, totalPixelsH, 0, 0, slicePixW, totalPixelsH);

            const dataUrl = sliceCanvas.toDataURL('image/png');
            urls.push({ index: i, dataUrl });
          }
        }

        document.body.removeChild(osmdContainer);
        resolve(urls);
      });
    });

    // Save PNG files
    console.log('\n💾 Saving PNG files...');
    const assetsDir = path.join(__dirname, 'public', 'assets');
    
    for (const { index, dataUrl } of downloadUrls) {
      const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
      const filePath = path.join(assetsDir, `notation_slice_${index}.png`);
      
      fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
      console.log(`   ✓ notation_slice_${index}.png (${(Buffer.from(base64Data, 'base64').length / 1024).toFixed(1)} KB)`);
    }

    console.log(`\n✅ Successfully generated ${downloadUrls.length} notation slices!`);
    console.log(`📁 Files saved to: public/assets/\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Check if server is running
function checkServer() {
  return new Promise((resolve) => {
    const req = http.get('http://localhost:5173', (res) => {
      resolve(res.statusCode === 200);
      res.on('data', () => {});
    });
    req.on('error', () => resolve(false));
  });
}

(async () => {
  const serverRunning = await checkServer();
  if (!serverRunning) {
    console.error('❌ Server is not running at http://localhost:5173');
    console.error('   Please run: npm start dev\n');
    process.exit(1);
  }

  await generateNotation();
})();
