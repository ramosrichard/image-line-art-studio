import { state } from './state.js';
import { presets } from './presets.js';

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
  if (!state.transparentBg) {
    if (preset.bgGradient) {
      const bgGrad = dstCtx.createLinearGradient(0, 0, 0, h);
      bgGrad.addColorStop(0, preset.bgGradient[0]);
      bgGrad.addColorStop(1, preset.bgGradient[1]);
      dstCtx.fillStyle = bgGrad;
    } else {
      dstCtx.fillStyle = preset.bgColor;
    }
    dstCtx.fillRect(0, 0, w, h);
  }
  
  // Setup Line Coloring
  if (preset.lineGradient) {
    const lineGrad = dstCtx.createLinearGradient(0, 0, w, 0);
    lineGrad.addColorStop(0, preset.lineGradient[0]);
    lineGrad.addColorStop(1, preset.lineGradient[1]);
    dstCtx.fillStyle = lineGrad;
  } else {
    dstCtx.fillStyle = preset.lineColor;
  }
  
  // Get image data
  const srcData = srcCtx.getImageData(0, 0, srcCanvas.width, srcCanvas.height).data;
  const srcW = srcCanvas.width;
  const srcH = srcCanvas.height;
  
  // Config Parameters
  const N = state.lineCount;
  const spacing = w / N;
  
  // Scale lines and smoothing factors dynamically if rendering high-resolution downloads
  const scaleFactor = w / 800; 
  const maxW = state.maxWidth * scaleFactor;
  const minW = state.minWidth * scaleFactor;
  const smoothing = Math.max(0, Math.floor(state.smoothing * (h / 800)));
  
  // Sampling steps down the Y axis
  const dy = isExport ? 1 : 2;
  const numSamples = Math.ceil(h / dy);
  
  // Preallocate width buffer
  const rawWidths = new Float32Array(numSamples);
  const smoothWidths = new Float32Array(numSamples);
  
  // Process vertical columns
  for (let i = 0; i < N; i++) {
    const X_c = (i + 0.5) * spacing;
    
    // Loop down the column path
    for (let s = 0; s < numSamples; s++) {
      const y = s * dy;
      
      // Map to pixel array index
      const srcX = Math.min(srcW - 1, Math.max(0, Math.floor(X_c * (srcW / w))));
      const srcY = Math.min(srcH - 1, Math.max(0, Math.floor(y * (srcH / h))));
      
      const idx = (srcY * srcW + srcX) * 4;
      const r = srcData[idx];
      const g = srcData[idx+1];
      const b = srcData[idx+2];
      
      // Grayscale Conversion
      let L = 0.299 * r + 0.587 * g + 0.114 * b;
      
      // Apply controls: Brightness
      L += state.brightness;
      
      // Apply controls: Contrast
      L = 128 + (L - 128) * state.contrast;
      
      // Clamp value
      L = Math.max(0, Math.min(255, L));
      
      // Darkness inversion
      const darkness = 1.0 - (L / 255.0);
      
      // Compute raw modulated width
      rawWidths[s] = minW + darkness * (maxW - minW);
    }
    
    // Apply Box Blur Moving Average Filter along Y
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
    
    // Build variable-width ribbon outline
    dstCtx.beginPath();
    dstCtx.moveTo(X_c + smoothWidths[0] / 2, 0);
    
    // Right side boundary going down
    for (let s = 1; s < numSamples; s++) {
      dstCtx.lineTo(X_c + smoothWidths[s] / 2, s * dy);
    }
    
    // Left side boundary going up
    dstCtx.lineTo(X_c - smoothWidths[numSamples - 1] / 2, (numSamples - 1) * dy);
    for (let s = numSamples - 2; s >= 0; s--) {
      dstCtx.lineTo(X_c - smoothWidths[s] / 2, s * dy);
    }
    
    dstCtx.closePath();
    dstCtx.fill();
  }
  
  const duration = performance.now() - startTime;
  if (!isExport && typeof updateUIStats === 'function') {
    updateUIStats(duration);
  }
}
