const fs = require('fs');

let mainCode = fs.readFileSync('src/main.ts', 'utf-8');
const linesText = mainCode.split('\n');
const start = linesText.findIndex(l => l.includes('ctx.clearRect(0, 0, slicePixW, totalPixelsH);'));
const end = linesText.findIndex((l, i) => i > start && l.includes('sliceTexture.update();'));

const newBlock = `                      ctx.clearRect(0, 0, slicePixW, totalPixelsH);
                      ctx.drawImage(osmdCanvas, srcX, 0, slicePixW, totalPixelsH, 0, 0, slicePixW, totalPixelsH);
                        const imgData = ctx.getImageData(0, 0, slicePixW, totalPixelsH);
                        const data = imgData.data;
                        for (let k = 0; k < data.length; k += 4) {
                            const brightness = (data[k] + data[k+1] + data[k+2]) / 3;
                            const inverted = 255 - brightness;
                            data[k] = inverted;
                            data[k+1] = inverted;
                            data[k+2] = inverted;
                            data[k+3] = 255;
                        }
                        ctx.putImageData(imgData, 0, 0);
                      // Update the texture
                      sliceTexture.update();
                      sliceTexture.getAlphaFromRGB = true;
                      
                      mat.diffuseTexture = null;
                      mat.emissiveTexture = null;
                      mat.opacityTexture = sliceTexture;
                      mat.transparencyMode = 2; // ALPHABLEND
                      mat.emissiveColor = new Color3(0, 0, 0); // Solid black color masked by opacity map`;

linesText.splice(start, end - start + 1, newBlock);
fs.writeFileSync('src/main.ts', linesText.join('\n'));
console.log('Fixed main loop!');
