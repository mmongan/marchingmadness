const fs = require('fs');

let mainCode = fs.readFileSync('src/main.ts', 'utf-8');
const mainRegex = /                        const imgData = ctx\.getImageData\(0, 0, slicePixW, totalPixelsH\);[\s\S]*?                        ctx\.putImageData\(imgData, 0, 0\);/g;

const mainReplacement = `                        const imgData = ctx.getImageData(0, 0, slicePixW, totalPixelsH);
                        const data = imgData.data;
                        for (let k = 0; k < data.length; k += 4) {
                            const alpha = data[k+3] / 255;
                            const r = data[k] * alpha + 255 * (1 - alpha);
                            const g = data[k+1] * alpha + 255 * (1 - alpha);
                            const b = data[k+2] * alpha + 255 * (1 - alpha);
                            const brightness = (r + g + b) / 3;
                            const inverted = 255 - brightness;
                            data[k] = inverted;
                            data[k+1] = inverted;
                            data[k+2] = inverted;
                            data[k+3] = 255;
                        }
                        ctx.putImageData(imgData, 0, 0);`;

mainCode = mainCode.replace(mainRegex, mainReplacement);
fs.writeFileSync('src/main.ts', mainCode);

let exCode = fs.readFileSync('src/notationExamples.ts', 'utf-8');
const exRegex = /            const imgData = ctx2d\.getImageData\(0, 0, canvas\.width, canvas\.height\);[\s\S]*?            ctx2d\.putImageData\(imgData, 0, 0\);/g;

const exReplacement = `            const imgData = ctx2d.getImageData(0, 0, canvas.width, canvas.height);
            const data = imgData.data;
            for (let i = 0; i < data.length; i += 4) {
                const alpha = data[i+3] / 255;
                const r = data[i] * alpha + 255 * (1 - alpha);
                const g = data[i+1] * alpha + 255 * (1 - alpha);
                const b = data[i+2] * alpha + 255 * (1 - alpha);
                const brightness = (r + g + b) / 3;
                const inverted = 255 - brightness;
                data[i] = inverted;
                data[i+1] = inverted;
                data[i+2] = inverted;
                data[i+3] = 255;
            }
            ctx2d.putImageData(imgData, 0, 0);`;

exCode = exCode.replace(exRegex, exReplacement);
fs.writeFileSync('src/notationExamples.ts', exCode);
console.log('Fixed math with alpha blending!');