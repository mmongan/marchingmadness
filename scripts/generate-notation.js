#!/usr/bin/env node

/**
 * Generate Notation PNG Files using OpenSheetMusicDisplay
 * 
 * This script generates real music notation PNG files by:
 * 1. Creating proper MusicXML with valid note sequences
 * 2. Rendering with OpenSheetMusicDisplay in a browser
 * 3. Capturing and saving as PNG textures
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ASSETS_DIR = path.join(__dirname, '..', 'public', 'assets');
const TEMP_HTML = path.join(__dirname, '..', 'public', 'temp-osmd-render.html');

console.log('🎵 OpenSheetMusicDisplay Notation PNG Generator');
console.log('==============================================\n');

// Generate valid MusicXML
function generateMusicXML(numMeasures = 40) {
    const steps = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
    const octaves = [4, 5];
    
    let measuresXml = "";
    
    for (let m = 1; m <= numMeasures; m++) {
        let measureContent = `<measure number="${m}">\n`;
        
        if (m === 1) {
            measureContent += `
                <attributes>
                    <divisions>4</divisions>
                    <key><fifths>0</fifths></key>
                    <time><beats>4</beats><beat-type>4</beat-type></time>
                    <clef><sign>G</sign><line>2</line></clef>
                </attributes>\n`;
        }
        
        // Fill with 4 quarter notes per measure
        for (let n = 0; n < 4; n++) {
            const step = steps[Math.floor(Math.random() * steps.length)];
            const octave = octaves[Math.floor(Math.random() * octaves.length)];
            
            measureContent += `
                <note>
                    <pitch>
                        <step>${step}</step>
                        <octave>${octave}</octave>
                    </pitch>
                    <duration>1</duration>
                    <type>quarter</type>
                </note>\n`;
        }
        
        measureContent += `</measure>\n`;
        measuresXml += measureContent;
    }
    
    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="3.1">
    <part-list>
        <score-part id="P1">
            <part-name>Music</part-name>
        </score-part>
    </part-list>
    <part id="P1">
        ${measuresXml}
    </part>
</score-partwise>`;
}

// Create temporary HTML for OSMD rendering
function createTempHTML(musicXml) {
    const escapedXml = musicXml
        .replace(/\\/g, '\\\\')
        .replace(/`/g, '\\`')
        .replace(/\$/g, '\\$');
    
    const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <script src="https://cdn.jsdelivr.net/npm/opensheetmusicdisplay@latest/build/opensheetmusicdisplay.min.js"></script>
    <style>
        * { margin: 0; padding: 0; }
        body { background: white; font-family: Arial; }
        #container { width: 8192px; padding: 20px; background: white; }
        #osmd { width: 100%; }
    </style>
</head>
<body>
    <div id="container">
        <div id="osmd"></div>
    </div>
    <script>
        async function render() {
            try {
                console.log('Waiting for OSMD...');
                let attempts = 0;
                while (!window.OpenSheetMusicDisplay && attempts < 100) {
                    await new Promise(r => setTimeout(r, 100));
                    attempts++;
                }
                
                if (!window.OpenSheetMusicDisplay) {
                    throw new Error('OSMD library failed to load');
                }
                
                console.log('OSMD loaded, creating instance...');
                
                const osmd = new window.OpenSheetMusicDisplay(
                    document.getElementById('osmd'),
                    { 
                        backend: 'canvas',
                        drawTitle: false,
                        drawPartNames: false,
                        autoResize: false
                    }
                );
                
                osmd.EngravingRules.StaffLineWidth = 2;
                osmd.EngravingRules.StemWidth = 1;
                osmd.zoom = 1.5;
                
                const musicXml = \`${escapedXml}\`;
                
                console.log('Loading MusicXML...');
                await osmd.load(musicXml);
                
                console.log('Rendering...');
                osmd.render();
                
                console.log('Render complete');
                window.renderReady = true;
            } catch (err) {
                console.error('Error:', err);
                window.renderError = err.message;
            }
        }
        
        render();
    </script>
</body>
</html>`;
    
    fs.writeFileSync(TEMP_HTML, html);
}

async function generateNotations() {
    let browser;
    try {
        // Ensure assets directory exists
        if (!fs.existsSync(ASSETS_DIR)) {
            fs.mkdirSync(ASSETS_DIR, { recursive: true });
        }
        console.log(`📁 Assets directory: ${ASSETS_DIR}\n`);
        
        // Generate MusicXML
        console.log('📝 Generating MusicXML with 40 measures...');
        const musicXml = generateMusicXML(40);
        console.log('✓ MusicXML created\n');
        
        // Create temporary HTML
        console.log('🌐 Creating temporary render page...');
        createTempHTML(musicXml);
        console.log('✓ HTML created\n');
        
        // Launch Puppeteer
        console.log('🤖 Launching browser...');
        browser = await puppeteer.launch({
            headless: 'new'
        });
        
        const page = await browser.newPage();
        
        // Set viewport
        await page.setViewport({
            width: 8192,
            height: 2400
        });
        
        // Suppress console messages
        page.on('console', msg => {
            if (!msg.text().includes('Render complete') && !msg.text().includes('OSMD loaded')) {
                // Silent
            }
        });
        
        // Load page
        console.log('📄 Loading render page...');
        const fileUrl = `file://${TEMP_HTML.replace(/\\/g, '/')}`;
        await page.goto(fileUrl, { waitUntil: 'networkidle0', timeout: 120000 });
        
        // Wait for render
        console.log('⏳ Rendering notation with OSMD...');
        try {
            await page.waitForFunction(
                () => window.renderReady === true,
                { timeout: 60000 }
            );
        } catch (timeoutErr) {
            console.warn('⚠️  Render timeout - capturing anyway...');
        }
        
        // Add delay for rendering to complete
        await new Promise(r => setTimeout(r, 2000));
        
        // Get actual rendered area
        const clip = await page.evaluate(() => {
            const osmdDiv = document.getElementById('osmd');
            if (osmdDiv) {
                const canvas = osmdDiv.querySelector('canvas');
                if (canvas) {
                    return {
                        x: 0,
                        y: 0,
                        width: canvas.width,
                        height: canvas.height
                    };
                }
            }
            return { x: 0, y: 0, width: 8192, height: 2000 };
        });
        
        console.log(`✓ Rendered size: ${clip.width}x${clip.height}px\n`);
        console.log('📸 Capturing notation...\n');
        
        // Capture full screenshot
        const fullScreenshot = await page.screenshot({
            fullPage: false,
            clip: { x: 0, y: 0, width: 8192, height: 2400 }
        });
        
        // Save as single file
        const filename = 'notation_slice_0.png';
        const filepath = path.join(ASSETS_DIR, filename);
        fs.writeFileSync(filepath, fullScreenshot);
        
        const sizeKB = (fullScreenshot.length / 1024).toFixed(1);
        console.log(`   ✓ ${filename} (${sizeKB} KB)`);
        
        console.log(`\n✅ Generated notation PNG using OpenSheetMusicDisplay\n`);
        
        await browser.close();
        
        // Cleanup
        fs.unlinkSync(TEMP_HTML);
        
        // List files
        const files = fs.readdirSync(ASSETS_DIR).filter(f => f.endsWith('.png'));
        console.log('📦 Files in assets folder:');
        files.forEach(f => {
            const filepath = path.join(ASSETS_DIR, f);
            const stats = fs.statSync(filepath);
            const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
            console.log(`   - ${f} (${sizeMB} MB)`);
        });
        
        console.log(`\n✨ Done! Reload http://localhost:5174 to see the OSMD notation.\n`);
        
    } catch (err) {
        console.error('❌ Error:', err.message);
        if (browser) {
            await browser.close();
        }
        // Cleanup temp file
        if (fs.existsSync(TEMP_HTML)) {
            fs.unlinkSync(TEMP_HTML);
        }
        process.exit(1);
    }
}

generateNotations();
