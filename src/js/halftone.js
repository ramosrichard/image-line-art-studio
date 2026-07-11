import { state } from './state.js';
import { presets } from './presets.js';
import { renderCanvasBackground, getLuminanceColor, getClosestPaletteColor } from './colorEngine.js';

export function renderHalftoneMatrix(sourceCanvas, renderCanvas, isExport = false, statsCallback = null) {
  const startTime = performance.now();

  const W = renderCanvas.width;
  const H = renderCanvas.height;
  const ctx = renderCanvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  const preset = presets[state.colorPreset];

  // Draw Background
  renderCanvasBackground(ctx, W, H, preset);

  // Setup Foreground Color (Only for monochrome mode)
  if (state.colorMode === 'monochrome') {
    if (preset.lineGradient) {
      const fgGrad = ctx.createLinearGradient(0, 0, W, 0);
      fgGrad.addColorStop(0, preset.lineGradient[0]);
      fgGrad.addColorStop(1, preset.lineGradient[1]);
      ctx.fillStyle = fgGrad;
    } else {
      ctx.fillStyle = preset.lineColor || '#ffffff';
    }
  }

  // Get active source canvas dimensions
  const srcCtx = sourceCanvas.getContext('2d');
  const srcW = sourceCanvas.width;
  const srcH = sourceCanvas.height;
  const srcData = srcCtx.getImageData(0, 0, srcW, srcH).data;

  // Retrieve parameters and scale them dynamically for high-resolution exports
  const scaleFactor = W / 800;
  const cellSize = state.halftoneCellSize * scaleFactor;
  const angleDeg = state.halftoneAngle;
  const shape = state.halftoneShape;
  const maxScale = state.halftoneMaxScale;
  const minThreshold = state.halftoneMinThreshold;
  const invert = state.halftoneInvert;

  const theta = (angleDeg * Math.PI) / 180;
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);

  // Viewport diagonal bounding box to cover the full canvas when rotated
  const D = Math.ceil(Math.sqrt(W * W + H * H));
  const halfD = D / 2;

  // Begin path to batch draw nodes for maximum performance (only for circles)
  const isCircle = shape === 'Circle';
  
  if (isCircle) {
    ctx.beginPath();
  }

  // Loop through rotated coordinates
  for (let uy = -halfD; uy <= halfD; uy += cellSize) {
    for (let ux = -halfD; ux <= halfD; ux += cellSize) {
      // Rotate back to canvas viewport coordinates
      const x = ux * cosT + uy * sinT + W / 2;
      const y = -ux * sinT + uy * cosT + H / 2;

      // Check bounds
      if (x < 0 || x >= W || y < 0 || y >= H) continue;

      // Sample pixel luminance
      const srcX = Math.min(srcW - 1, Math.max(0, Math.floor(x * (srcW / W))));
      const srcY = Math.min(srcH - 1, Math.max(0, Math.floor(y * (srcH / H))));

      const idx = (srcY * srcW + srcX) * 4;
      const r = srcData[idx];
      const g = srcData[idx + 1];
      const b = srcData[idx + 2];

      let luminance = 0.299 * r + 0.587 * g + 0.114 * b;
      luminance += state.brightness;
      luminance = 128 + (luminance - 128) * state.contrast;
      luminance = Math.max(0, Math.min(255, luminance));

      let d = 1.0 - (luminance / 255.0);
      if (invert) {
        d = luminance / 255.0;
      }

      if (d < minThreshold) continue;

      const size = cellSize * d * maxScale;
      if (size <= 0) continue;

      // Determine color
      let nodeColor = '#ffffff';
      if (state.colorMode === 'adaptive-luminance') {
        nodeColor = getLuminanceColor(luminance / 255.0, state.extractedPalette, state.colorBgSource);
      } else if (state.colorMode === 'adaptive-local') {
        nodeColor = getClosestPaletteColor(r, g, b, state.extractedPalette);
      }

      // Draw shape
      if (isCircle) {
        if (state.colorMode !== 'monochrome') {
          ctx.beginPath();
          ctx.arc(x, y, size / 2, 0, 2 * Math.PI);
          ctx.fillStyle = nodeColor;
          ctx.fill();
        } else {
          ctx.moveTo(x + size / 2, y);
          ctx.arc(x, y, size / 2, 0, 2 * Math.PI);
        }
      } else if (shape === 'Square') {
        const vrx = (size / 2) * cosT;
        const vry = (size / 2) * sinT;
        const vux = -(size / 2) * sinT;
        const vuy = (size / 2) * cosT;

        ctx.beginPath();
        ctx.moveTo(x - vrx - vux, y - vry - vuy);
        ctx.lineTo(x + vrx - vux, y + vry - vuy);
        ctx.lineTo(x + vrx + vux, y + vry + vuy);
        ctx.lineTo(x - vrx + vux, y - vry + vuy);
        ctx.closePath();
        if (state.colorMode !== 'monochrome') {
          ctx.fillStyle = nodeColor;
        }
        ctx.fill();
      } else if (shape === 'Diamond') {
        const vrx = (size / 2) * cosT;
        const vry = (size / 2) * sinT;
        const vux = -(size / 2) * sinT;
        const vuy = (size / 2) * cosT;

        ctx.beginPath();
        ctx.moveTo(x - vux, y - vuy);
        ctx.lineTo(x + vrx, y + vry);
        ctx.lineTo(x + vux, y + vuy);
        ctx.lineTo(x - vrx, y - vry);
        ctx.closePath();
        if (state.colorMode !== 'monochrome') {
          ctx.fillStyle = nodeColor;
        }
        ctx.fill();
      }
    }
  }

  if (isCircle && state.colorMode === 'monochrome') {
    ctx.fill();
  }

  const duration = performance.now() - startTime;
  if (statsCallback) {
    statsCallback(duration);
  }
}
