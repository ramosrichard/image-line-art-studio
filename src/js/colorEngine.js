import { state } from './state.js';

export function rgbToHex(r, g, b) {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

export function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

export function getRelativeLuminance(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

// Deterministic Median Cut Quantization Algorithm
export function extractPalette(image, K) {
  // Create offscreen downsampled canvas
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0, 128, 128);
  const imgData = ctx.getImageData(0, 0, 128, 128).data;

  // Collect RGB pixels, ignoring transparency
  const pixels = [];
  for (let i = 0; i < imgData.length; i += 4) {
    const r = imgData[i];
    const g = imgData[i + 1];
    const b = imgData[i + 2];
    const a = imgData[i + 3];
    if (a >= 128) {
      pixels.push({ r, g, b });
    }
  }

  // Fallback if no pixels
  if (pixels.length === 0) {
    const fallbackColors = [];
    for (let i = 0; i < K; i++) {
      const c = Math.round(i * (255 / (K - 1)));
      fallbackColors.push({ r: c, g: c, b: c, hex: rgbToHex(c, c, c) });
    }
    return fallbackColors;
  }

  const buckets = [pixels];

  while (buckets.length < K) {
    let maxRange = -1;
    let splitIndex = -1;
    let splitChannel = 'r';

    for (let i = 0; i < buckets.length; i++) {
      const b = buckets[i];
      if (b.length <= 1) continue;

      let minR = 255, maxR = 0;
      let minG = 255, maxG = 0;
      let minB = 255, maxB = 0;

      for (let p of b) {
        if (p.r < minR) minR = p.r;
        if (p.r > maxR) maxR = p.r;
        if (p.g < minG) minG = p.g;
        if (p.g > maxG) maxG = p.g;
        if (p.b < minB) minB = p.b;
        if (p.b > maxB) maxB = p.b;
      }

      const rangeR = maxR - minR;
      const rangeG = maxG - minG;
      const rangeB = maxB - minB;
      const rangeMax = Math.max(rangeR, rangeG, rangeB);

      if (rangeMax > maxRange) {
        maxRange = rangeMax;
        splitIndex = i;
        if (rangeMax === rangeR) splitChannel = 'r';
        else if (rangeMax === rangeG) splitChannel = 'g';
        else splitChannel = 'b';
      }
    }

    if (splitIndex === -1) break;

    const bucketToSplit = buckets.splice(splitIndex, 1)[0];
    bucketToSplit.sort((a, b) => a[splitChannel] - b[splitChannel]);
    const median = Math.floor(bucketToSplit.length / 2);
    buckets.push(bucketToSplit.slice(0, median));
    buckets.push(bucketToSplit.slice(median));
  }

  const colors = buckets.map((b) => {
    let sumR = 0, sumG = 0, sumB = 0;
    for (let p of b) {
      sumR += p.r;
      sumG += p.g;
      sumB += p.b;
    }
    const count = b.length;
    const r = Math.round(sumR / count);
    const g = Math.round(sumG / count);
    const bVal = Math.round(sumB / count);
    return {
      r,
      g,
      b: bVal,
      hex: rgbToHex(r, g, bVal)
    };
  });

  return colors;
}

export function sortPalette(palette) {
  return [...palette].sort((a, b) => {
    const lumA = getRelativeLuminance(a.r, a.g, a.b);
    const lumB = getRelativeLuminance(b.r, b.g, b.b);
    return lumA - lumB;
  });
}

// Euclidean distance RGB lookup
export function getClosestPaletteColor(r, g, b, palette) {
  let minDist = Infinity;
  let closestColor = '#ffffff';

  for (let i = 0; i < palette.length; i++) {
    const p = palette[i];
    const dR = r - p.r;
    const dG = g - p.g;
    const dB = b - p.b;
    const dist = dR * dR + dG * dG + dB * dB;

    if (dist < minDist) {
      minDist = dist;
      closestColor = p.hex;
    }
  }

  return closestColor;
}

// Luminance threshold mapping selector
export function getLuminanceColor(luminance, palette, bgSource) {
  const K = palette.length;
  if (K === 0) return '#ffffff';
  if (K === 1) return palette[0].hex;

  // luminance is normalized 0.0 to 1.0 (dark to light)
  // darkness is 1.0 - luminance
  const darkness = Math.max(0, Math.min(1.0, 1.0 - luminance));

  if (bgSource === 'lightest') {
    // Lightest color is background. Map darkness to shapes using darker colors (0 to K-2).
    const idx = Math.min(K - 2, Math.floor(darkness * (K - 1)));
    return palette[idx].hex;
  } else if (bgSource === 'darkest') {
    // Darkest color is background. Map brightness (luminance) to shapes using lighter colors (1 to K-1).
    const idx = 1 + Math.min(K - 2, Math.floor(luminance * (K - 1)));
    return palette[idx].hex;
  } else {
    // Custom background override. Map darkness to all shape colors (0 to K-1).
    const idx = Math.min(K - 1, Math.floor(darkness * K));
    return palette[idx].hex;
  }
}

// Synchronizes state.extractedPalette with newly quantized colors, respecting locks
export function syncPaletteWithImage(image) {
  const K = state.paletteSize;

  // Keep track of locked slots and their current colors
  const lockedColors = [];
  for (let i = 0; i < K; i++) {
    if (state.lockedPaletteSlots[i] && state.extractedPalette[i]) {
      lockedColors.push({ ...state.extractedPalette[i], index: i });
    }
  }

  // Extract K colors from image
  let newColors = extractPalette(image, K);
  newColors = sortPalette(newColors);

  // Re-merge locked slots
  const mergedPalette = [];
  let newColorIdx = 0;

  for (let i = 0; i < K; i++) {
    // If this slot is locked and we have a locked color, restore it
    const locked = lockedColors.find(lc => lc.index === i);
    if (locked) {
      mergedPalette.push({ r: locked.r, g: locked.g, b: locked.b, hex: locked.hex });
    } else {
      // Find the next available extracted color that isn't already used
      if (newColorIdx < newColors.length) {
        mergedPalette.push(newColors[newColorIdx]);
        newColorIdx++;
      } else {
        // Fallback if fewer colors extracted
        mergedPalette.push({ r: 128, g: 128, b: 128, hex: '#808080' });
      }
    }
  }

  // Always re-sort the final merged palette by luminance to keep mapping predictable
  state.extractedPalette = sortPalette(mergedPalette);
}

export function renderCanvasBackground(ctx, w, h, preset) {
  if (state.transparentBg) {
    ctx.clearRect(0, 0, w, h);
    return;
  }

  if (state.colorMode === 'monochrome') {
    if (preset.bgGradient) {
      const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
      bgGrad.addColorStop(0, preset.bgGradient[0]);
      bgGrad.addColorStop(1, preset.bgGradient[1]);
      ctx.fillStyle = bgGrad;
    } else {
      ctx.fillStyle = preset.bgColor || '#1e293b';
    }
  } else {
    const K = state.extractedPalette.length;
    if (K > 0) {
      if (state.colorBgSource === 'lightest') {
        ctx.fillStyle = state.extractedPalette[K - 1].hex;
      } else if (state.colorBgSource === 'darkest') {
        ctx.fillStyle = state.extractedPalette[0].hex;
      } else {
        ctx.fillStyle = state.colorBgCustom;
      }
    } else {
      ctx.fillStyle = '#1e293b';
    }
  }
  ctx.fillRect(0, 0, w, h);
}
