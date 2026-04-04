const fs = require('fs');

let exCode = fs.readFileSync('src/notationExamples.ts', 'utf-8');
const exRegex = /            \/\/ Process canvas data to convert white background to transparent and retain dark pixels[\s\S]*?            plane\.material = mat;/g;
const exReplacement = `            // Convert canvas rendering to an opacity map (white = note, black = transparent background)
            const ctx2d = canvas.getContext('2d') as CanvasRenderingContext2D;
            const imgData = ctx2d.getImageData(0, 0, canvas.width, canvas.height);
            const data = imgData.data;
            for (let i = 0; i < data.length; i += 4) {
                // Invert the colors: Black notes become White (Opacity 1), White background becomes Black (Opacity 0)
                const brightness = (data[i] + data[i+1] + data[i+2]) / 3;
                const inverted = 255 - brightness;
                data[i] = inverted;
                data[i+1] = inverted;
                data[i+2] = inverted;
                data[i+3] = 255; // Ignore alpha on the canvas itself, we are making an RGB mask
            }
            ctx2d.putImageData(imgData, 0, 0);

            // Create dynamic texture
            const texture = new DynamicTexture(\`tex_\${name}\`, canvas, this.scene, false);
            texture.update();
            texture.getAlphaFromRGB = true; // Use the red channel for transparency

            const mat = new StandardMaterial(\`mat_\${name}\`, this.scene);
            // Simply use the inverted texture as purely opacity (shape of the music notation)
            mat.opacityTexture = texture;
            mat.transparencyMode = 2; // ALPHABLEND
            // And render the geometry in pure black
            mat.emissiveColor = new Color3(0, 0, 0); 
            mat.disableLighting = true;
            mat.backFaceCulling = false;

            plane.material = mat;`;

exCode = exCode.replace(exRegex, exReplacement);
fs.writeFileSync('src/notationExamples.ts', exCode);


let mainCode = fs.readFileSync('src/main.ts', 'utf-8');
const mainRegex = /                      \/\/ Ensure clear background before drawing[\s\S]*?                      console\.log\(`  Slice \${i}: drawn \${slicePixW}x\${totalPixelsH}px`\);/g;
const mainReplacement = `                      // Ensure clear background before drawing
                      ctx.clearRect(0, 0, slicePixW, totalPixelsH);
                      ctx.drawImage(osmdCanvas, srcX, 0, slicePixW, totalPixelsH, 0, 0, slicePixW, totalPixelsH);

                      const imgData = ctx.getImageData(0, 0, slicePixW, totalPixelsH);
                      const data = imgData.data;
                      for (let k = 0; k < data.length; k += 4) {
                          // Invert the colors: Black notes become White (Opacity 1), White background becomes Black (Opacity 0)
                          const brightness = (data[k] + data[k+1] + data[k+2]) / 3;
                          const inverted = 255 - brightness;
                          data[k] = inverted;
                          data[k+1] = inverted;
                          data[k+2] = inverted;
                          data[k+3] = 255; // Ignore alpha on the canvas itself, we are making an RGB mask
                      }
                      ctx.putImageData(imgData, 0, 0);

                      // Update the texture
                      sliceTexture.update();
                      sliceTexture.getAlphaFromRGB = true;

                      // Fix up the material (since we replaced mat logic from main.ts earlier in loop or previously)
                      mat.diffuseTexture = null;
                      mat.emissiveTexture = null;
                      mat.opacityTexture = sliceTexture;
                      mat.transparencyMode = 2;
                      mat.emissiveColor = new Color3(0, 0, 0);

                      console.log(\`  Slice \${i}: drawn \${slicePixW}x\${totalPixelsH}px\`);`;

mainCode = mainCode.replace(mainRegex, mainReplacement);
fs.writeFileSync('src/main.ts', mainCode);
console.log('Fixed notationExamples and main!');
