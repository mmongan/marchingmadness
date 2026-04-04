#!/usr/bin/env node

/**
 * Generate Proper Music Notation PNG Files using Puppeteer
 * 
 * This script generates real, valid music notation PNG textures
 * using OpenSheetMusicDisplay for accurate rendering.
 * 
 * Usage: node scripts/generate-proper-notation.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const ASSETS_DIR = path.join(__dirname, '..', 'public', 'assets');
const TEMP_HTML = path.join(__dirname, '..', 'public', 'temp-notation-generator.html');

console.log('🎵 Proper Music Notation PNG Generator');
console.log('=====================================\n');

// Generate random Music XML with proper notation
function generateProperMusicXML(numMeasures = 40) {
    const steps = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
    const octaves = [4, 5];
    const durations = [
        { duration: 4, type: 'whole', dots: false },
        { duration: 2, type: 'half', dots: false },
        { duration: 2, type: 'half', dots: true },  // dotted half
        { duration: 1, type: 'quarter', dots: false },
        { duration: 1, type: 'quarter', dots: true }, // dotted quarter
        { duration: 0.5, type: 'eighth', dots: false },
        { duration: 0.5, type: 'eighth', dots: true },  // dotted eighth
        { duration: 0.25, type: 'sixteenth', dots: false }
    ];
    
    let measuresXml = "";
    
    for (let m = 1; m <= numMeasures; m++) {
        let measureContent = `<measure number="${m}">\n`;
        
        // Only first measure needs attributes
        if (m === 1) {
            measureContent += `
                <attributes>
                    <divisions>4</divisions>
                    <key><fifths>0</fifths></key>
                    <time><beats>4</beats><beat-type>4</beat-type></time>
                    <clef><sign>G</sign><line>2</line></clef>
                </attributes>\n`;
        }
        
        // Fill measure with notes that add up to 4 beats
        let beatsUsed = 0;
        while (beatsUsed < 4) {
            // Pick a random duration that fits
            const available = durations.filter(d => beatsUsed + d.duration <= 4);
            if (available.length === 0) break;
            
            const duration = available[Math.floor(Math.random() * available.length)];
            const step = steps[Math.floor(Math.random() * steps.length)];
            const octave = octaves[Math.floor(Math.random() * octaves.length)];
            
            // Convert to MusicXML divisions (1 quarter = 4 divisions)
            const xmlDuration = Math.round(duration * 4);
            
            measureContent += `
                <note>
                    <pitch>
                        <step>${step}</step>
                        <octave>${octave}</octave>
                    </pitch>
                    <duration>${xmlDuration}</duration>
                    <type>${duration === 4 ? 'whole' : duration === 2 ? 'half' : duration === 1 ? 'quarter' : duration === 0.5 ? 'eighth' : 'sixteenth'}</type>`;
            
            if (duration === 2 || duration === 1 || duration === 0.5) {
                // 50% chance for dotted notes
                if (Math.random() > 0.5) {
                    measureContent += `\n                    <dot/>`;
                }
            }
            
            measureContent += `\n                </note>\n`;
            beatsUsed += duration;
        }
        
        // Fill remaining beats with rests if needed
        if (beatsUsed < 4) {
            const restDuration = Math.round((4 - beatsUsed) * 4);
            measureContent += `
                <note>
                    <rest/>
                    <duration>${restDuration}</duration>
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

// Create temporary HTML file for Puppeteer
function createTempHTML(musicXml) {
    const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <script src="file://${path.resolve(__dirname, '../node_modules/opensheetmusicdisplay/build/opensheetmusicdisplay.min.js')}"></script>
    <style>
        body { margin: 0; padding: 0; background: white; }
        #container { width: 8192px; }
    </style>
</head>
<body>
    <div id="container"></div>
    <script>
        async function render() {
            try {
                // Wait for OSMD to load
                let attempts = 0;
                while (!window.OpenSheetMusicDisplay && attempts < 50) {
                    await new Promise(r => setTimeout(r, 100));
                    attempts++;
                }
                
                if (!window.OpenSheetMusicDisplay) {
                    throw new Error('OSMD failed to load');
                }
                
                const osmd = new window.OpenSheetMusicDisplay(
                    document.getElementById('container'),
                    {
                        backend: 'canvas',
                        drawTitle: false,
                        drawPartNames: false,
                        autoResize: false
                    }
                );
                
                // Set engraving rules
                osmd.EngravingRules.StaffLineWidth = 2;
                osmd.EngravingRules.StemWidth = 1;
                osmd.EngravingRules.BeamWidth = 1;
                osmd.EngravingRules.LedgerLineWidth = 2;
                osmd.zoom = 3;
                
                const musicXml = \`${musicXml.replace(/`/g, '\\`')}\`;
                
                await osmd.load(musicXml);
                osmd.render();
                
                // Signal ready
                window.renderReady = true;
                console.log('Render complete');
            } catch (err) {
                console.error('Render error:', err);
                window.renderError = err.message;
            }
        }
        
        render();
    </script>
</body>
</html>`;
    
    fs.writeFileSync(TEMP_HTML, html);
}

// Main function
async function generateNotations() {
    try {
        // Ensure assets directory exists
        if (!fs.existsSync(ASSETS_DIR)) {
            fs.mkdirSync(ASSETS_DIR, { recursive: true });
        }
        console.log(`📁 Assets directory: ${ASSETS_DIR}\n`);
        
        // Generate MusicXML
        console.log('📝 Generating MusicXML with proper notation...');
        const musicXml = generateProperMusicXML(40);
        console.log('✓ MusicXML generated\n');
        
        // Create temporary HTML
        console.log('🌐 Creating temporary HTML file...');
        createTempHTML(musicXml);
        console.log('✓ HTML created\n');
        
        // Launch Puppeteer
        console.log('🤖 Launching browser...');
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        
        // Set large viewport for 8192px width
        await page.setViewport({
            width: 8192,
            height: 4096 // Enough for multiple staves
        });
        
        // Load the temporary HTML file
        console.log('📄 Loading notation page...');
        await page.goto(`file://${TEMP_HTML.replace(/\\/g, '/')}`, {
            waitUntil: 'networkidle2',
            timeout: 60000
        });
        
        // Wait for rendering to complete
        console.log('⏳ Waiting for OSMD to render...');
        const renderTimeout = setTimeout(() => {
            console.warn('⚠️  Render timeout - proceeding anyway');
        }, 30000);
        
        try {
            await page.waitForFunction(
                () => window.renderReady === true,
                { timeout: 30000 }
            );
        } catch {
            console.warn('⚠️  Render wait timeout');
        }
        clearTimeout(renderTimeout);
        
        // Get canvas dimensions
        const canvasInfo = await page.evaluate(() => {
            const canvas = document.querySelector('canvas');
            if (!canvas) return null;
            return {
                width: canvas.width,
                height: canvas.height,
                dataURL: canvas.toDataURL('image/png')
            };
        });
        
        if (!canvasInfo) {
            throw new Error('No canvas found after rendering');
        }
        
        console.log(`✓ Canvas rendered: ${canvasInfo.width}x${canvasInfo.height}px\n`);
        
        // Take screenshots and slice into pieces
        console.log('📸 Capturing and slicing notation...\n');
        
        const totalWidth = canvasInfo.width;
        const maxSliceWidth = 4096;
        const slices = Math.ceil(totalWidth / maxSliceWidth);
        
        for (let i = 0; i < slices; i++) {
            const left = i * maxSliceWidth;
            const sliceWidth = Math.min(maxSliceWidth, totalWidth - left);
            
            console.log(`   Slice ${i}: x=${left}, width=${sliceWidth}px`);
            
            // Capture slice
            const sliceBuffer = await page.screenshot({
                clip: {
                    x: left,
                    y: 0,
                    width: sliceWidth,
                    height: canvasInfo.height
                }
            });
            
            // Save to file
            const filename = `notation_slice_${i}.png`;
            const filepath = path.join(ASSETS_DIR, filename);
            fs.writeFileSync(filepath, sliceBuffer);
            
            const sizeKB = (sliceBuffer.length / 1024).toFixed(1);
            console.log(`   ✓ ${filename} (${sizeKB} KB)`);
        }
        
        console.log(`\n✅ Generated ${slices} proper notation PNG files\n`);
        
        await browser.close();
        
        // Cleanup
        fs.unlinkSync(TEMP_HTML);
        
        // List files
        const files = fs.readdirSync(ASSETS_DIR).filter(f => f.endsWith('.png'));
        console.log('📦 Files in assets folder:');
        files.forEach(f => {
            const filepath = path.join(ASSETS_DIR, f);
            const stats = fs.statSync(filepath);
            const sizeMB = (stats.size / (1024 * 1024)).toFixed(3);
            console.log(`   - ${f} (${sizeMB} MB)`);
        });
        
        console.log(`\n✨ Done! Reload http://localhost:5174 to use the textures.\n`);
        
    } catch (err) {
        console.error('❌ Error:', err.message);
        console.error(err);
        process.exit(1);
    }
}

generateNotations();
