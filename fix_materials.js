const fs = require('fs');

function fixFiles() {
    let mainSrc = fs.readFileSync('src/main.ts', 'utf-8');
    let exSrc = fs.readFileSync('src/notationExamples.ts', 'utf-8');

    // For notationExamples
    const regexEx = /            \/\/ Create dynamic texture[\s\S]*?            plane\.material = mat;/g;
    const replacementEx = `            // Manually process canvas to convert white background to transparent
            const ctxTest = canvas.getContext('2d') as CanvasRenderingContext2D;
            const imgData = ctxTest.getImageData(0, 0, canvas.width, canvas.height);
            const data = imgData.data;
            for (let i = 0; i < data.length; i += 4) {
                // If it is mostly white, make it transparent
                if (data[i] > 200 && data[i+1] > 200 && data[i+2] > 200) {
                    data[i] = 0;
                    data[i+1] = 0;
                    data[i+2] = 0;
                    data[i+3] = 0;
                } else {
                    // Otherwise keep it solid
                    // (Can also force to black or keep original anti-aliased edges)
                    const avg = (data[i] + data[i+1] + data[i+2]) / 3;
                    data[i] = 0;
                    data[i+1] = 0;
                    data[i+2] = 0;
                    // Keep alpha based on how dark it is (for anti-aliasing)
                    data[i+3] = 255 - avg;
                }
            }
            ctxTest.putImageData(imgData, 0, 0);

            const texture = new DynamicTexture(\`tex_\${name}\`, canvas, this.scene, false);
            // texture.update(); 
            // since we pass canvas to texture constructor, we might need update
            texture.update();
            texture.hasAlpha = true;

            const mat = new StandardMaterial(\`mat_\${name}\`, this.scene);
            mat.diffuseTexture = texture;
            mat.emissiveTexture = texture;
            mat.useAlphaFromDiffuseTexture = true;
            mat.backFaceCulling = false;
            mat.disableLighting = true; // Use emissive only
            
            plane.material = mat;`;

    exSrc = exSrc.replace(regexEx, replacementEx);
    fs.writeFileSync('src/notationExamples.ts', exSrc);
    
    // For main
    const regexMainRuntime = /                      \/\/ Ensure clear background before drawing[\s\S]*?                      const slicePlane = MeshBuilder\.CreatePlane/g;
    const replacementMainRuntime = `                      // Ensure clear background before drawing
                      ctx.clearRect(0, 0, slicePixW, totalPixelsH);
                      ctx.drawImage(osmdCanvas, srcX, 0, slicePixW, totalPixelsH, 0, 0, slicePixW, totalPixelsH);

                      const imgData = ctx.getImageData(0, 0, slicePixW, totalPixelsH);
                      const data = imgData.data;
                      for (let k = 0; k < data.length; k += 4) {
                          if (data[k] > 200 && data[k+1] > 200 && data[k+2] > 200) {
                              data[k] = 0; data[k+1] = 0; data[k+2] = 0; data[k+3] = 0;
                          } else {
                              const avg = (data[k] + data[k+1] + data[k+2]) / 3;
                              data[k] = 0; data[k+1] = 0; data[k+2] = 0;
                              data[k+3] = Math.max(0, Math.min(255, 255 - avg + data[k+3])); // preserve existing alpha but increase opacity for dark notes
                          }
                      }
                      ctx.putImageData(imgData, 0, 0);

                      // Update the texture
                      sliceTexture.update();
                      console.log(\`  Slice \${i}: drawn \${slicePixW}x\${totalPixelsH}px\`);
                  }

                  console.log(\`✓ Generated \${slices} notation slices at runtime\`);
              } else {
                  console.error("OSMD canvas failed to render");
              }

              document.body.removeChild(osmdContainer);
          } catch (err) {
              console.error("Error generating notation:", err);
          }
      }

                        const slicePlane = MeshBuilder.CreatePlane`;

    // Actually, main.ts replacement needs precision to not break anything. 
}
fixFiles();
