import { state } from './state.js';
import { presets } from './presets.js';
import { renderLineModulation } from './engine.js';
export function generateSVGString(sourceCanvas, renderCanvas) {
  const W = 800;
  const H = 800;
  const preset = presets[state.colorPreset];
  
  const N = state.lineCount;
  const maxW = state.maxWidth;
  const minW = state.minWidth;
  const smoothing = state.smoothing;
  
  // Step sample resolution for vector coordinates
  const dy = 2;
  
  // Read data from active source offscreen canvas
  const srcCtx = sourceCanvas.getContext('2d');
  const srcW = sourceCanvas.width;
  const srcH = sourceCanvas.height;
  const srcData = srcCtx.getImageData(0, 0, srcW, srcH).data;
  
  // Line angle math
  const alpha = (state.lineAngle * Math.PI) / 180;
  const cosA = Math.cos(alpha);
  const sinA = Math.sin(alpha);
  
  // Calculate bounding u coordinates perpendicular to the lines
  const u0 = 0;
  const u1 = W * cosA;
  const u2 = -H * sinA;
  const u3 = W * cosA - H * sinA;
  const uMin = Math.min(u0, u1, u2, u3);
  const uMax = Math.max(u0, u1, u2, u3);
  
  const uRange = uMax - uMin;
  const spacing = uRange / N;
  
  // Helper to get exact intersection of a line with the canvas bounds
  function getLineIntersection(U_c) {
    let vMin = -Infinity;
    let vMax = Infinity;
    
    if (Math.abs(sinA) > 1e-6) {
      const v1 = (-U_c * cosA) / sinA;
      const v2 = (W - U_c * cosA) / sinA;
      vMin = Math.max(vMin, Math.min(v1, v2));
      vMax = Math.min(vMax, Math.max(v1, v2));
    } else {
      const x = U_c * cosA;
      if (x < 0 || x > W) return null;
    }
    
    if (Math.abs(cosA) > 1e-6) {
      const v1 = (U_c * sinA) / cosA;
      const v2 = (H + U_c * sinA) / cosA;
      vMin = Math.max(vMin, Math.min(v1, v2));
      vMax = Math.min(vMax, Math.max(v1, v2));
    } else {
      const y = -U_c * sinA;
      if (y < 0 || y > H) return null;
    }
    
    if (vMin > vMax) return null;
    return { vStart: vMin, vEnd: vMax };
  }
  
  let svgPaths = '';
  
  for (let i = 0; i < N; i++) {
    const U_c = uMin + (i + 0.5) * spacing;
    
    const intersect = getLineIntersection(U_c);
    if (!intersect) continue;
    
    const { vStart, vEnd } = intersect;
    const L = vEnd - vStart;
    if (L <= 0) continue;
    
    const numSamples = Math.ceil(L / dy);
    if (numSamples < 2) continue;
    
    const rawWidths = new Float32Array(numSamples);
    const smoothWidths = new Float32Array(numSamples);
    
    // Sample
    for (let s = 0; s < numSamples; s++) {
      const v = vStart + s * dy;
      const canvasX = U_c * cosA + v * sinA;
      const canvasY = -U_c * sinA + v * cosA;
      
      const srcX = Math.min(srcW - 1, Math.max(0, Math.floor(canvasX * (srcW / W))));
      const srcY = Math.min(srcH - 1, Math.max(0, Math.floor(canvasY * (srcH / H))));
      
      const idx = (srcY * srcW + srcX) * 4;
      const r = srcData[idx];
      const g = srcData[idx+1];
      const b = srcData[idx+2];
      
      let luminance = 0.299 * r + 0.587 * g + 0.114 * b;
      luminance += state.brightness;
      luminance = 128 + (luminance - 128) * state.contrast;
      luminance = Math.max(0, Math.min(255, luminance));
      
      const darkness = 1.0 - (luminance / 255.0);
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
    let rightPoints = [];
    let leftPoints = [];
    
    for (let s = 0; s < numSamples; s++) {
      const v = vStart + s * dy;
      const cX = U_c * cosA + v * sinA;
      const cY = -U_c * sinA + v * cosA;
      const halfW = smoothWidths[s] / 2;
      
      const xR = cX + halfW * cosA;
      const yR = cY - halfW * sinA;
      rightPoints.push(`${xR.toFixed(2)},${yR.toFixed(2)}`);
    }
    
    for (let s = numSamples - 1; s >= 0; s--) {
      const v = vStart + s * dy;
      const cX = U_c * cosA + v * sinA;
      const cY = -U_c * sinA + v * cosA;
      const halfW = smoothWidths[s] / 2;
      
      const xL = cX - halfW * cosA;
      const yL = cY + halfW * sinA;
      leftPoints.push(`${xL.toFixed(2)},${yL.toFixed(2)}`);
    }
    
    const firstPt = rightPoints[0].split(',');
    let pathD = `M ${firstPt[0]} ${firstPt[1]}`;
    for (let s = 1; s < rightPoints.length; s++) {
      const pt = rightPoints[s].split(',');
      pathD += ` L ${pt[0]} ${pt[1]}`;
    }
    for (let s = 0; s < leftPoints.length; s++) {
      const pt = leftPoints[s].split(',');
      pathD += ` L ${pt[0]} ${pt[1]}`;
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
