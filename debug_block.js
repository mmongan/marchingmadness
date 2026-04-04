if (canvas) {
            // Apply the actual 2D graphic to a THICK solid block mesh via extrusion
            // Block dimensions match real-world aspect ratio
            const blockWidth = 3;
            const blockHeight = blockWidth * (canvas.height / canvas.width);
            const blockDepth = 0.2; // Extrusion depth - solid slab!

            // Create solid thick box
            const block = MeshBuilder.CreateBox(name, {
                width: blockWidth, 
                height: blockHeight, 
                depth: blockDepth 
            }, this.scene);

            block.position = position;

            // Apply texture
            const texture = new DynamicTexture(`tex_${name}`, canvas, this.scene, false);
            const mat = new StandardMaterial(`mat_${name}`, this.scene);
            mat.diffuseTexture = texture;
            mat.specularColor = new Color3(0, 0, 0);
            mat.emissiveColor = new Color3(0.9, 0.9, 0.9); // Make it bright
            
            // Optional: transparent edges to only render ink on a thick clear block
            // mat.diffuseTexture.hasAlpha = true;
            // mat.useAlphaFromDiffuseTexture = true;
            // mat.useObjectSpaceLighting = true;

            block.material = mat;
        }

        document.body.removeChild(osmdContainer);
    }