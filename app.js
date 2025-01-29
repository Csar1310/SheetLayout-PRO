// app.js completo y verificado
function calculateLayout() {
    try {
        // Limpiar contenedores
        ['wallContainer', 'sheetContainer', 'results'].forEach(id => {
            document.getElementById(id).innerHTML = '';
        });

        // Obtener y validar valores
        const parseInput = (id) => {
            const value = document.getElementById(id).value.replace(',', '.');
            const num = parseFloat(value);
            if (isNaN(num) || num <= 0) throw new Error(`Valor inválido en ${id}`);
            return num;
        };

        const wallWidth = parseInput('wallWidth');
        const wallHeight = parseInput('wallHeight');
        const sheetWidth = parseInput('sheetWidth');
        const sheetHeight = parseInput('sheetHeight');
        const mode = document.getElementById('cuttingMode').value;

        // Validar dimensiones
        if (sheetWidth > wallWidth || sheetHeight > wallHeight) {
            throw new Error('Las láminas deben ser más pequeñas que la pared');
        }

        // Calcular piezas y optimizar
        const requiredPieces = calculateRequiredPieces(wallWidth, wallHeight, sheetWidth, sheetHeight);
        const optimizedSheets = optimizeSheets(requiredPieces, sheetWidth, sheetHeight, mode);

        // Mostrar resultados
        displayWallLayout(requiredPieces, wallWidth, wallHeight, sheetWidth, sheetHeight);
        displaySheetLayout(optimizedSheets, sheetWidth, sheetHeight);
        displayResults(optimizedSheets, requiredPieces);

    } catch (error) {
        alert(`🚨 Error: ${error.message}`);
        console.error(error);
    }
}

function calculateRequiredPieces(wallW, wallH, sheetW, sheetH) {
    const pieces = [];
    const cols = Math.ceil(wallW / sheetW);
    const rows = Math.ceil(wallH / sheetH);
    
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const pieceWidth = Math.min(sheetW, wallW - col * sheetW);
            const pieceHeight = Math.min(sheetH, wallH - row * sheetH);
            
            pieces.push({
                width: pieceWidth,
                height: pieceHeight,
                x: col * sheetW,
                y: row * sheetH
            });
        }
    }
    return pieces;
}

function optimizeSheets(pieces, sheetW, sheetH, mode) {
    const sheets = [];
    let remainingPieces = [...pieces];
    const allowRotation = mode === 'panel';
    
    // Ordenar piezas por dimensión más larga primero
    remainingPieces.sort((a, b) => 
        Math.max(b.width, b.height) - Math.max(a.width, a.height)
    );

    while (remainingPieces.length > 0) {
        let sheet = {
            layout: [],
            spaces: [{x: 0, y: 0, w: sheetW, h: sheetH}],
            usedArea: 0
        };

        // Mejorar selección de espacios
        for (let i = 0; i < remainingPieces.length; i++) {
            const piece = remainingPieces[i];
            let bestFit = null;
            let bestScore = Infinity;

            // Buscar en todos los espacios
            for (let s = 0; s < sheet.spaces.length; s++) {
                const space = sheet.spaces[s];
                
                // Tolerancia para errores de redondeo
                const epsilon = 0.001;
                
                // Probar orientación normal
                if (piece.width <= space.w + epsilon && 
                    piece.height <= space.h + epsilon) {
                    
                    // Calcular puntaje de ajuste (área residual + relación de aspecto)
                    const residualArea = (space.w * space.h) - (piece.width * piece.height);
                    const aspectFit = Math.abs(space.w/piece.width - space.h/piece.height);
                    const score = residualArea + (aspectFit * 100);
                    
                    if (score < bestScore) {
                        bestFit = {spaceIndex: s, rotation: false};
                        bestScore = score;
                    }
                }
                
                // Probar orientación rotada
                if (allowRotation && 
                    piece.height <= space.w + epsilon && 
                    piece.width <= space.h + epsilon) {
                    
                    const residualArea = (space.w * space.h) - (piece.width * piece.height);
                    const aspectFit = Math.abs(space.w/piece.height - space.h/piece.width);
                    const score = residualArea + (aspectFit * 100);
                    
                    if (score < bestScore) {
                        bestFit = {spaceIndex: s, rotation: true};
                        bestScore = score;
                    }
                }
            }

            if (bestFit) {
                const width = bestFit.rotation ? piece.height : piece.width;
                const height = bestFit.rotation ? piece.width : piece.height;
                
                // Agregar pieza
                sheet.layout.push({
                    x: sheet.spaces[bestFit.spaceIndex].x,
                    y: sheet.spaces[bestFit.spaceIndex].y,
                    width: width,
                    height: height,
                    rotated: bestFit.rotation
                });

                // Actualizar espacios
                const space = sheet.spaces[bestFit.spaceIndex];
                sheet.spaces.splice(bestFit.spaceIndex, 1);

                // Mejorar división de espacios residuales
                const remainingWidth = space.w - width;
                const remainingHeight = space.h - height;
                
                // Priorizar espacios más útiles
                if (remainingWidth >= remainingHeight) {
                    // Dividir horizontal primero
                    if (remainingWidth > 0) {
                        sheet.spaces.push({
                            x: space.x + width,
                            y: space.y,
                            w: remainingWidth,
                            h: height
                        });
                    }
                    if (remainingHeight > 0) {
                        sheet.spaces.push({
                            x: space.x,
                            y: space.y + height,
                            w: space.w,
                            h: remainingHeight
                        });
                    }
                } else {
                    // Dividir vertical primero
                    if (remainingHeight > 0) {
                        sheet.spaces.push({
                            x: space.x,
                            y: space.y + height,
                            w: space.w,
                            h: remainingHeight
                        });
                    }
                    if (remainingWidth > 0) {
                        sheet.spaces.push({
                            x: space.x + width,
                            y: space.y,
                            w: remainingWidth,
                            h: height
                        });
                    }
                }

                // Fusionar espacios adyacentes
                mergeAdjacentSpaces(sheet.spaces);

                sheet.usedArea += width * height;
                remainingPieces.splice(i, 1);
                i--;

                // Reordenar espacios
                sheet.spaces.sort((a, b) => (a.w * a.h) - (b.w * b.h));
                sheet.spaces = sheet.spaces.filter(s => s.w >= 0.01 && s.h >= 0.01);
            }
        }

        if (sheet.layout.length > 0) {
            sheet.waste = (sheetW * sheetH) - sheet.usedArea;
            sheets.push({
                layout: sheet.layout,
                width: sheetW,
                height: sheetH,
                waste: sheet.waste
            });
        }
    }

    return sheets;
}

// Nueva función para fusionar espacios adyacentes
function mergeAdjacentSpaces(spaces) {
    for (let i = spaces.length - 1; i >= 0; i--) {
        for (let j = i - 1; j >= 0; j--) {
            const a = spaces[i];
            const b = spaces[j];
            
            // Fusionar horizontalmente
            if (a.y === b.y && a.h === b.h && a.x === b.x + b.w) {
                b.w += a.w;
                spaces.splice(i, 1);
                break;
            }
            
            // Fusionar verticalmente
            if (a.x === b.x && a.w === b.w && a.y === b.y + b.h) {
                b.h += a.h;
                spaces.splice(i, 1);
                break;
            }
        }
    }
}

function calculateScale(realWidth, realHeight, maxSize) {
    const scaleWidth = maxSize / realWidth;
    const scaleHeight = maxSize / realHeight;
    return Math.min(scaleWidth, scaleHeight);
}

function displayWallLayout(pieces, wallW, wallH, sheetW, sheetH) {
    const container = document.getElementById('wallContainer');
    const legend = container.parentElement.querySelector('.wall-legend');
    const scale = calculateScale(wallW, wallH, 800);
    
    container.innerHTML = '';
    container.style.width = `${wallW * scale}px`;
    container.style.height = `${wallH * scale}px`;
    
    legend.innerHTML = `📏 Pared: ${wallW.toFixed(1)}m × ${wallH.toFixed(1)}m | 🧱 Lámina: ${sheetW.toFixed(1)}m × ${sheetH.toFixed(1)}m`;
    
    pieces.forEach(piece => {
        const element = document.createElement('div');
        element.className = 'sheet' + (piece.width < sheetW || piece.height < sheetH ? ' gap' : '');
        element.style.width = `${piece.width * scale}px`;
        element.style.height = `${piece.height * scale}px`;
        element.style.left = `${piece.x * scale}px`;
        element.style.top = `${piece.y * scale}px`;
        element.dataset.dimensions = `${piece.width.toFixed(2)}m × ${piece.height.toFixed(2)}m`;
        container.appendChild(element);
    });
}

function displaySheetLayout(sheets, sheetW, sheetH) {
    const container = document.getElementById('sheetContainer');
    container.innerHTML = '';
    const scale = calculateScale(sheetW, sheetH, 300);
    
    sheets.forEach((sheet, index) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'sheet-wrapper';
        
        const label = document.createElement('div');
        label.className = 'sheet-label';
        label.innerHTML = `Lámina #${index + 1} <small>${sheet.layout.length} piezas</small>`;
        wrapper.appendChild(label);
        
        const sheetDiv = document.createElement('div');
        sheetDiv.className = 'sheet-cut';
        sheetDiv.style.width = `${sheetW * scale}px`;
        sheetDiv.style.height = `${sheetH * scale}px`;
        sheetDiv.style.position = 'relative';
        
        // Borde
        const border = document.createElement('div');
        border.className = 'sheet-border';
        sheetDiv.appendChild(border);
        
        // Piezas
        sheet.layout.forEach(piece => {
            const element = document.createElement('div');
            element.className = `cut-piece ${piece.rotated ? 'rotated' : ''}`;
            element.style.width = `${piece.width * scale}px`;
            element.style.height = `${piece.height * scale}px`;
            element.style.left = `${piece.x * scale}px`;
            element.style.top = `${piece.y * scale}px`;
            element.dataset.dimensions = `${piece.width.toFixed(2)}m × ${piece.height.toFixed(2)}m`;
            sheetDiv.appendChild(element);
        });
        
        wrapper.appendChild(sheetDiv);
        container.appendChild(wrapper);
    });
}

function displayResults(sheets, pieces) {
    const container = document.getElementById('results');
    container.innerHTML = `
        <div class="result-item">
            <div class="result-value">${sheets.length}</div>
            <div class="result-label">Láminas<br><small>requeridas</small></div>
        </div>
        <div class="result-item">
            <div class="result-value">${pieces.length}</div>
            <div class="result-label">Piezas<br><small>totales</small></div>
        </div>
        <div class="result-item">
            <div class="result-value">${sheets.reduce((sum, s) => sum + s.waste, 0).toFixed(2)}</div>
            <div class="result-label">Desperdicio<br><small>total (m²)</small></div>
        </div>
    `;
}