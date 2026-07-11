import { state } from './state.js';
import { presets } from './presets.js';
import { renderCanvasBackground, getLuminanceColor, getClosestPaletteColor } from './colorEngine.js';

export function drawSourceImage(sourceCanvas) {
  if (!sourceCanvas) return;
  const ctx = sourceCanvas.getContext('2d');
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  
  // Translate to center for rotation/zoom operations
  ctx.translate(w / 2 + state.panX, h / 2 + state.panY);
  ctx.rotate((state.rotation * Math.PI) / 180);
  ctx.scale(state.zoom, state.zoom);
  
  if (state.image) {
    const imgW = state.image.width;
    const imgH = state.image.height;
    
    // Covering Scale Ratio (Aspect-Cover fit)
    const scale = Math.max(w / imgW, h / imgH);
    const drawW = imgW * scale;
    const drawH = imgH * scale;
    
    ctx.drawImage(state.image, -drawW / 2, -drawH / 2, drawW, drawH);
  }
  ctx.restore();
}

export function renderLineModulation(srcCanvas, dstCanvas, isExport = false, updateUIStats = null) {
  const startTime = performance.now();
  
  const srcCtx = srcCanvas.getContext('2d');
  const dstCtx = dstCanvas.getContext('2d');
  const w = dstCanvas.width;
  const h = dstCanvas.height;
  
  // Clear
  dstCtx.clearRect(0, 0, w, h);
  
  const preset = presets[state.colorPreset];
  
  // Render Background
  renderCanvasBackground(dstCtx, w, h, preset);
  
  // Setup Line Coloring (Only for monochrome mode)
  if (state.colorMode === 'monochrome') {
    if (preset.lineGradient) {
      const lineGrad = dstCtx.createLinearGradient(0, 0, w, 0);
      lineGrad.addColorStop(0, preset.lineGradient[0]);
      lineGrad.addColorStop(1, preset.lineGradient[1]);
      dstCtx.fillStyle = lineGrad;
    } else {
      dstCtx.fillStyle = preset.lineColor || '#ffffff';
    }
  }
  
  // Get image data
  const srcData = srcCtx.getImageData(0, 0, srcCanvas.width, srcCanvas.height).data;
  const srcW = srcCanvas.width;
  const srcH = srcCanvas.height;
  
  // Config Parameters
  const N = state.lineCount;
  
  // Scale lines and smoothing factors dynamically if rendering high-resolution downloads
  const scaleFactor = w / 800; 
  const maxW = state.maxWidth * scaleFactor;
  const minW = state.minWidth * scaleFactor;
  const smoothing = Math.max(0, Math.floor(state.smoothing * (h / 800)));
  
  // Sampling step along the lines
  const dv = isExport ? 1 : 2;
  
  // Line angle math
  const alpha = (state.lineAngle * Math.PI) / 180;
  const cosA = Math.cos(alpha);
  const sinA = Math.sin(alpha);
  
  // Calculate bounding u coordinates perpendicular to the lines
  // u = x * cosA - y * sinA
  const u0 = 0;
  const u1 = w * cosA;
  const u2 = -h * sinA;
  const u3 = w * cosA - h * sinA;
  const uMin = Math.min(u0, u1, u2, u3);
  const uMax = Math.max(u0, u1, u2, u3);
  
  const uRange = uMax - uMin;
  const spacing = uRange / N;
  
  // Helper to get exact intersection of a line with the canvas bounds
  function getLineIntersection(U_c) {
    let vMin = -Infinity;
    let vMax = Infinity;
    
    // Bounds from X: 0 <= U_c * cosA + v * sinA <= w
    if (Math.abs(sinA) > 1e-6) {
      const v1 = (-U_c * cosA) / sinA;
      const v2 = (w - U_c * cosA) / sinA;
      vMin = Math.max(vMin, Math.min(v1, v2));
      vMax = Math.min(vMax, Math.max(v1, v2));
    } else {
      const x = U_c * cosA;
      if (x < 0 || x > w) return null;
    }
    
    // Bounds from Y: 0 <= -U_c * sinA + v * cosA <= h
    if (Math.abs(cosA) > 1e-6) {
      const v1 = (U_c * sinA) / cosA;
      const v2 = (h + U_c * sinA) / cosA;
      vMin = Math.max(vMin, Math.min(v1, v2));
      vMax = Math.min(vMax, Math.max(v1, v2));
    } else {
      const y = -U_c * sinA;
      if (y < 0 || y > h) return null;
    }
    
    if (vMin > vMax) return null;
    return { vStart: vMin, vEnd: vMax };
  }
  
  // Draw each line
  for (let i = 0; i < N; i++) {
    const U_c = uMin + (i + 0.5) * spacing;
    
    // Get intersection segment inside canvas bounds
    const intersect = getLineIntersection(U_c);
    if (!intersect) continue;
    
    const { vStart, vEnd } = intersect;
    const L = vEnd - vStart;
    if (L <= 0) continue;
    
    const numSamples = Math.ceil(L / dv);
    if (numSamples < 2) continue;
    
    const rawWidths = new Float32Array(numSamples);
    const smoothWidths = new Float32Array(numSamples);
    
    let sumLuminance = 0;

    // Step 1: Sample
    for (let s = 0; s < numSamples; s++) {
      const v = vStart + s * dv;
      const canvasX = U_c * cosA + v * sinA;
      const canvasY = -U_c * sinA + v * cosA;
      
      // Map to source image coordinates
      const srcX = Math.min(srcW - 1, Math.max(0, Math.floor(canvasX * (srcW / w))));
      const srcY = Math.min(srcH - 1, Math.max(0, Math.floor(canvasY * (srcH / h))));
      
      const idx = (srcY * srcW + srcX) * 4;
      const r = srcData[idx];
      const g = srcData[idx+1];
      const b = srcData[idx+2];
      
      let luminance = 0.299 * r + 0.587 * g + 0.114 * b;
      luminance += state.brightness;
      luminance = 128 + (luminance - 128) * state.contrast;
      luminance = Math.max(0, Math.min(255, luminance));
      
      sumLuminance += luminance / 255.0;
      
      const darkness = 1.0 - (luminance / 255.0);
      rawWidths[s] = minW + darkness * (maxW - minW);
    }
    
    // Step 2: Smooth along the line path
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
    
    // Step 3: Draw ribbon
    dstCtx.beginPath();
    
    // Right side going down
    for (let s = 0; s < numSamples; s++) {
      const v = vStart + s * dv;
      const cX = U_c * cosA + v * sinA;
      const cY = -U_c * sinA + v * cosA;
      const halfW = smoothWidths[s] / 2;
      
      const xR = cX + halfW * cosA;
      const yR = cY - halfW * sinA;
      
      if (s === 0) {
        dstCtx.moveTo(xR, yR);
      } else {
        dstCtx.lineTo(xR, yR);
      }
    }
    
    // Left side going back up
    for (let s = numSamples - 1; s >= 0; s--) {
      const v = vStart + s * dv;
      const cX = U_c * cosA + v * sinA;
      const cY = -U_c * sinA + v * cosA;
      const halfW = smoothWidths[s] / 2;
      
      const xL = cX - halfW * cosA;
      const yL = cY + halfW * sinA;
      
      dstCtx.lineTo(xL, yL);
    }
    
    dstCtx.closePath();

    if (state.colorMode === 'adaptive-luminance') {
      const avgLum = sumLuminance / numSamples;
      dstCtx.fillStyle = getLuminanceColor(avgLum, state.extractedPalette, state.colorBgSource);
    } else if (state.colorMode === 'adaptive-local') {
      const midS = Math.floor(numSamples / 2);
      const vMid = vStart + midS * dv;
      const cX = U_c * cosA + vMid * sinA;
      const cY = -U_c * sinA + vMid * cosA;
      
      const srcX = Math.min(srcW - 1, Math.max(0, Math.floor(cX * (srcW / w))));
      const srcY = Math.min(srcH - 1, Math.max(0, Math.floor(cY * (srcH / h))));
      
      const idx = (srcY * srcW + srcX) * 4;
      const r = srcData[idx];
      const g = srcData[idx+1];
      const b = srcData[idx+2];
      dstCtx.fillStyle = getClosestPaletteColor(r, g, b, state.extractedPalette);
    }

    dstCtx.fill();
  }
  
  const duration = performance.now() - startTime;
  if (!isExport && typeof updateUIStats === 'function') {
    updateUIStats(duration);
  }
}
