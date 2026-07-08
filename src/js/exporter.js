import { state } from './state.js';
import { presets } from './presets.js';
import { renderLineModulation } from './engine.js';

export function generateSVGString(sourceCanvas, renderCanvas) {
  const W = 800;
  const H = 800;
  const preset = presets[state.colorPreset];
  
  const N = state.lineCount;
  const spacing = W / N;
  const maxW = state.maxWidth;
  const minW = state.minWidth;
  const smoothing = state.smoothing;
  
  // Step sample resolution for vector coordinates
  const dy = 2;
  const numSamples = Math.ceil(H / dy);
  
  // Read data from active source offscreen canvas
  const srcCtx = sourceCanvas.getContext('2d');
  const srcW = sourceCanvas.width;
  const srcH = sourceCanvas.height;
  const srcData = srcCtx.getImageData(0, 0, srcW, srcH).data;
  
  let svgPaths = '';
  
  for (let i = 0; i < N; i++) {
    const X_c = (i + 0.5) * spacing;
    const rawWidths = new Float32Array(numSamples);
    const smoothWidths = new Float32Array(numSamples);
    
    // Sample
    for (let s = 0; s < numSamples; s++) {
      const y = s * dy;
      const srcX = Math.min(srcW - 1, Math.max(0, Math.floor(X_c * (srcW / W))));
      const srcY = Math.min(srcH - 1, Math.max(0, Math.floor(y * (srcH / H))));
      
      const idx = (srcY * srcW + srcX) * 4;
      const r = srcData[idx];
      const g = srcData[idx+1];
      const b = srcData[idx+2];
      
      let L = 0.299 * r + 0.587 * g + 0.114 * b;
      L += state.brightness;
      L = 128 + (L - 128) * state.contrast;
      L = Math.max(0, Math.min(255, L));
      
      const darkness = 1.0 - (L / 255.0);
      rawWidths[s] = minW + darkness * (maxW - minW);
    }
    
    // Smooth
    for (let s = 0; s < numSamples; s++) {
      if (smoothing === 0) {
        smoothWidths[s] = rawWidths[s];
        continue;
      }
      let sum = 0;
      let count = 0;
      for (let wIndex = s - smoothing; wIndex <= s + smoothing; wIndex++) {
        if (wIndex >= 0 && wIndex < numSamples) {
          sum += rawWidths[wIndex];
          count++;
        }
      }
      smoothWidths[s] = sum / count;
    }
    
    // Construct SVG path string
    let pathD = `M ${(X_c + smoothWidths[0]/2).toFixed(2)} 0`;
    
    // Right side
    for (let s = 1; s < numSamples; s++) {
      pathD += ` L ${(X_c + smoothWidths[s]/2).toFixed(2)} ${(s * dy).toFixed(1)}`;
    }
    
    // Bottom overlap & Left side going back up
    pathD += ` L ${(X_c - smoothWidths[numSamples - 1]/2).toFixed(2)} ${((numSamples - 1) * dy).toFixed(1)}`;
    for (let s = numSamples - 2; s >= 0; s--) {
      pathD += ` L ${(X_c - smoothWidths[s]/2).toFixed(2)} ${(s * dy).toFixed(1)}`;
    }
    pathD += ' Z';
    
    svgPaths += `  <path d="${pathD}" />\n`;
  }
  
  // Compile SVG Components
  let defs = '';
  let bgElement = '';
  let groupElement = '';
  
  // Background Rect
  if (!state.transparentBg) {
    if (preset.bgGradient) {
      defs += `    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${preset.bgGradient[0]}" />
      <stop offset="100%" stop-color="${preset.bgGradient[1]}" />
    </linearGradient>\n`;
      bgElement = `  <rect width="${W}" height="${H}" fill="url(#bgGrad)" />\n`;
    } else {
      bgElement = `  <rect width="${W}" height="${H}" fill="${preset.bgColor}" />\n`;
    }
  }
  
  // Line Gradient Fill styling
  if (preset.lineGradient) {
    defs += `    <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${preset.lineGradient[0]}" />
      <stop offset="100%" stop-color="${preset.lineGradient[1]}" />
    </linearGradient>\n`;
    groupElement = `  <g fill="url(#lineGrad)">\n`;
  } else {
    groupElement = `  <g fill="${preset.lineColor}">\n`;
  }
  
  const wrappedDefs = defs ? `<defs>\n${defs}  </defs>\n` : '';
  
  return `<?xml version="1.0" encoding="utf-8"?>
<svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" height="100%">
${wrappedDefs}${bgElement}${groupElement}${svgPaths}  </g>
</svg>`;
}

export function downloadPNG(renderCanvas) {
  let exportW = 800;
  let exportH = 800;
  
  // If High-Res mode active and we have an image, fetch original size
  if (state.highResExport && state.image) {
    const imgW = state.image.width || 800;
    const imgH = state.image.height || 800;
    
    // Handle aspect changes for presets vs images
    if (state.aspectRatio === 'original') {
      if (state.rotation === 90 || state.rotation === 270) {
        exportW = imgH;
        exportH = imgW;
      } else {
        exportW = imgW;
        exportH = imgH;
      }
    } else {
      // Adjust aspect bounds based on setting
      let aspect = 1.0;
      if (state.aspectRatio === '4:3') aspect = 4/3;
      else if (state.aspectRatio === '16:9') aspect = 16/9;
      else if (state.aspectRatio === '3:4') aspect = 3/4;
      
      if (state.rotation === 90 || state.rotation === 270) {
        exportW = imgH;
        exportH = Math.round(imgH / aspect);
      } else {
        exportW = imgW;
        exportH = Math.round(imgW / aspect);
      }
    }
  } else {
    exportW = renderCanvas.width;
    exportH = renderCanvas.height;
  }
  
  const expSrc = document.createElement('canvas');
  expSrc.width = exportW;
  expSrc.height = exportH;
  
  const expDst = document.createElement('canvas');
  expDst.width = exportW;
  expDst.height = exportH;
  
  // Relative scale factor between output canvas and preview canvas
  const scaleFactor = exportW / renderCanvas.width;
  
  // Render source image inside rotated bounds
  const ctxSrc = expSrc.getContext('2d');
  ctxSrc.save();
  ctxSrc.translate(exportW / 2 + state.panX * scaleFactor, exportH / 2 + state.panY * scaleFactor);
  ctxSrc.rotate((state.rotation * Math.PI) / 180);
  ctxSrc.scale(state.zoom, state.zoom);
  
  if (state.image) {
    const imgW = state.image.width;
    const imgH = state.image.height;
    
    // Aspect cover size mapping relative to preview width/height, scaled up by scaleFactor
    const scale = Math.max(renderCanvas.width / imgW, renderCanvas.height / imgH);
    const drawW = imgW * scale * scaleFactor;
    const drawH = imgH * scale * scaleFactor;
    
    ctxSrc.drawImage(state.image, -drawW / 2, -drawH / 2, drawW, drawH);
  }
  ctxSrc.restore();
  
  // Draw modulated output paths
  renderLineModulation(expSrc, expDst, true);
  
  // Trigger download
  const filename = state.imageName.split('.')[0] + '_optical_art.png';
  const link = document.createElement('a');
  link.href = expDst.toDataURL('image/png');
  link.download = filename;
  link.click();
}

export function downloadSVG(sourceCanvas, renderCanvas) {
  const svgString = generateSVGString(sourceCanvas, renderCanvas);
  const filename = state.imageName.split('.')[0] + '_optical_art.svg';
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  
  URL.revokeObjectURL(url);
}
