const fs = require('fs');

try {
    let exCode = fs.readFileSync('src/notationExamples.ts', 'utf-8');
    
    // First, let's fix the pixel manipulation array to literally put black ink with its alpha, and clear background
    const rgbMathRegex = /const inverted = 255 - brightness;[\s\S]*?data\[i\+3\] = inverted;/g;
    exCode = exCode.replace(rgbMathRegex, `const inverted = 255 - brightness;
                data[i] = 0; // Black RGB
                data[i+1] = 0; // Black RGB
                data[i+2] = 0; // Black RGB
                data[i+3] = inverted; // Alpha directly tied to darkness`);

    const matRegex = /\/\/ Create dynamic texture[\s\S]*?plane\.material = mat;/g;
    exCode = exCode.replace(matRegex, `// Create dynamic texture
              const texture = new DynamicTexture(\`tex_\${name}\`, canvas, this.scene, false);
              texture.update();
              texture.hasAlpha = true;

              const mat = new StandardMaterial(\`mat_\${name}\`, this.scene);
              mat.diffuseTexture = texture;
              mat.emissiveTexture = texture;
              mat.useAlphaFromDiffuseTexture = true;
              mat.transparencyMode = 2; // ALPHABLEND
              mat.emissiveColor = new Color3(1, 1, 1);
              mat.disableLighting = true;
              mat.backFaceCulling = false;

              plane.material = mat;`);

    fs.writeFileSync('src/notationExamples.ts', exCode);

    let mainCode = fs.readFileSync('src/main.ts', 'utf-8');
    
    const mainRgbMathRegex = /const inverted = 255 - brightness;[\s\S]*?data\[k\+3\] = inverted;/g;
    mainCode = mainCode.replace(mainRgbMathRegex, `const inverted = 255 - brightness;
                            data[k] = 0; // Black RGB
                            data[k+1] = 0; // Black RGB
                            data[k+2] = 0; // Black RGB
                            data[k+3] = inverted; // Alpha directly tied to darkness`);

    const mainMatRegex = /\/\/ Update the texture[\s\S]*?mat\.emissiveColor = new Color3\(0, 0, 0\); \/\/ Solid black color masked by opacity map/g;
    mainCode = mainCode.replace(mainMatRegex, `// Update the texture
                      sliceTexture.update();
                      sliceTexture.hasAlpha = true;
                      
                      mat.diffuseTexture = sliceTexture;
                      mat.emissiveTexture = sliceTexture;
                      mat.useAlphaFromDiffuseTexture = true;
                      mat.transparencyMode = 2; // ALPHABLEND
                      mat.emissiveColor = new Color3(1, 1, 1); // Pass through perfectly
                      mat.disableLighting = true;
                      mat.backFaceCulling = false;`);

    fs.writeFileSync('src/main.ts', mainCode);
    console.log('Fixed materials and pixel data completely!');
} catch (err) {
    console.error(err);
}
