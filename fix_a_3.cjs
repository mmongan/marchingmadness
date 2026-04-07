const fs = require('fs');

try {
    let mainSrc = fs.readFileSync('src/main.ts', 'utf-8');
    
    const matBlockFind = /                      const ctx = sliceTexture\.getContext\(\) as CanvasRenderingContext2D;[\s\S]*?mat\.backFaceCulling = false;/g;
    
    // Give it a solid white background (the standard way of reading sheet music).
    const replacement = `                      const ctx = sliceTexture.getContext() as CanvasRenderingContext2D;

                      // Fill with standard white background (looks like standard paper)
                      ctx.fillStyle = "white";
                      ctx.fillRect(0, 0, slicePixW, totalPixelsH);
                      ctx.drawImage(osmdCanvas, srcX, 0, slicePixW, totalPixelsH, 0, 0, slicePixW, totalPixelsH);
                      
                      // Update the texture
                      sliceTexture.update();
                      
                      mat.diffuseTexture = sliceTexture;
                      mat.emissiveTexture = sliceTexture;
                      mat.emissiveColor = new Color3(1, 1, 1);
                      mat.disableLighting = true;
                      mat.backFaceCulling = false;`;

    mainSrc = mainSrc.replace(matBlockFind, replacement);
    
    // Make the board standard size, say 4 meters wide
    mainSrc = mainSrc.replace(/const totalBoardWidthMeters = 20;/g, 'const totalBoardWidthMeters = 8;');
    
    fs.writeFileSync('src/main.ts', mainSrc);

    let exSrc = fs.readFileSync('src/notationExamples.ts', 'utf-8');
    
    const exMatBlockFind = /              const ctx2d = canvas\.getContext\(\'2d\'\) as CanvasRenderingContext2D;[\s\S]*?plane\.material = mat;/g;
    
    const exReplacement = `              const ctx2d = canvas.getContext('2d') as CanvasRenderingContext2D;
              // Ensure solid white background for standard readability
              ctx2d.globalCompositeOperation = 'destination-over';
              ctx2d.fillStyle = 'white';
              ctx2d.fillRect(0, 0, canvas.width, canvas.height);
              ctx2d.globalCompositeOperation = 'source-over';

              // Create dynamic texture
              const texture = new DynamicTexture(\`tex_\${name}\`, canvas, this.scene, false);
              texture.update();

              const mat = new StandardMaterial(\`mat_\${name}\`, this.scene);
              mat.diffuseTexture = texture;
              mat.emissiveTexture = texture;
              mat.emissiveColor = new Color3(1, 1, 1);
              mat.disableLighting = true;
              mat.backFaceCulling = false;

              plane.material = mat;`;

    exSrc = exSrc.replace(exMatBlockFind, exReplacement);
    fs.writeFileSync('src/notationExamples.ts', exSrc);
    console.log("Successfully standard-ified it!");
} catch (e) {
    console.error(e);
}
