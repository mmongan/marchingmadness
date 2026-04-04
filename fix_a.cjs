const fs = require('fs');

try {
    let mainCode = fs.readFileSync('src/main.ts', 'utf-8');
    mainCode = mainCode.replace(/sliceTexture\.getAlphaFromRGB = true;/g, '');
    mainCode = mainCode.replace(/const inverted = 255 - brightness;\s*data\[k\] = inverted;\s*data\[k\+1\] = inverted;\s*data\[k\+2\] = inverted;\s*data\[k\+3\] = 255;/g, 
`const inverted = 255 - brightness;
                            data[k] = 255;
                            data[k+1] = 255;
                            data[k+2] = 255;
                            data[k+3] = inverted;`);
    fs.writeFileSync('src/main.ts', mainCode);

    let exCode = fs.readFileSync('src/notationExamples.ts', 'utf-8');
    exCode = exCode.replace(/texture\.getAlphaFromRGB = true;/g, '');
    exCode = exCode.replace(/const inverted = 255 - brightness;\s*data\[i\] = inverted;\s*data\[i\+1\] = inverted;\s*data\[i\+2\] = inverted;\s*data\[i\+3\] = 255;/g,
`const inverted = 255 - brightness;
                data[i] = 255;
                data[i+1] = 255;
                data[i+2] = 255;
                data[i+3] = inverted;`);
    fs.writeFileSync('src/notationExamples.ts', exCode);

    console.log('Fixed Alpha Channel directly mapped to Alpha!');
} catch (err) {
    console.error(err);
}
