import { state } from './state.js';
import { presets } from './presets.js';
import { drawSourceImage, renderLineModulation } from './engine.js';
import { drawShadedSphere, drawRippleWaves, drawSilhouettePortrait } from './generators.js';
import { initUI } from './ui.js';

let sourceCanvas = null;
let renderCanvas = null;
let renderPending = false;
let uiInterface = null;

function triggerRedraw() {
  if (renderPending) return;
  renderPending = true;
  requestAnimationFrame(() => {
    drawSourceImage(sourceCanvas);
    
    const updateStats = (duration) => {
      const el = document.getElementById('renderTimeVal');
      if (el) el.innerText = duration.toFixed(1) + 'ms';
    };
    
    if (state.activeModule === 'line-modulation') {
      renderLineModulation(sourceCanvas, renderCanvas, false, updateStats);
    } else {
      const ctx = renderCanvas.getContext('2d');
      const w = renderCanvas.width;
      const h = renderCanvas.height;
      
      // Clear
      ctx.clearRect(0, 0, w, h);
      
      const preset = presets[state.colorPreset];
      
      // Draw background
      if (!state.transparentBg) {
        if (preset.bgGradient) {
          const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
          bgGrad.addColorStop(0, preset.bgGradient[0]);
          bgGrad.addColorStop(1, preset.bgGradient[1]);
          ctx.fillStyle = bgGrad;
        } else {
          ctx.fillStyle = preset.bgColor;
        }
        ctx.fillRect(0, 0, w, h);
      }
      
      // Draw text
      if (preset.lineGradient) {
        const textGrad = ctx.createLinearGradient(0, 0, w, 0);
        textGrad.addColorStop(0, preset.lineGradient[0]);
        textGrad.addColorStop(1, preset.lineGradient[1]);
        ctx.fillStyle = textGrad;
      } else {
        ctx.fillStyle = preset.lineColor || '#ffffff';
      }
      
      ctx.font = 'bold 24px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      let moduleTitle = 'Artistic Module';
      let icon = '🎨';
      if (state.activeModule === 'dot-halftone') {
        moduleTitle = 'Dot Halftone Studio';
        icon = '⚫';
      } else if (state.activeModule === 'geometric-triangles') {
        moduleTitle = 'Delaunay Mesh Studio';
        icon = '🔺';
      }
      
      ctx.fillText(icon, w / 2, h / 2 - 30);
      ctx.fillText(`${moduleTitle}`, w / 2, h / 2 + 10);
      
      ctx.font = '13px Inter, sans-serif';
      ctx.fillStyle = '#64748b'; // soft slate
      ctx.fillText('Module Under Construction', w / 2, h / 2 + 50);
      
      const el = document.getElementById('renderTimeVal');
      if (el) el.innerText = '0.0ms';
    }
    
    // Draw on preview viewport canvas
    const previewCanvas = document.getElementById('previewCanvas');
    if (previewCanvas) {
      const previewCtx = previewCanvas.getContext('2d');
      previewCanvas.width = renderCanvas.width;
      previewCanvas.height = renderCanvas.height;
      previewCtx.drawImage(renderCanvas, 0, 0);
    }
    
    renderPending = false;
  });
}

function loadSamplePattern(type) {
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = 800;
  tempCanvas.height = 800;
  const ctx = tempCanvas.getContext('2d');
  
  if (type === 'sphere') {
    drawShadedSphere(ctx, 800, 800);
    state.imageName = '3D Sphere Preset';
  } else if (type === 'waves') {
    drawRippleWaves(ctx, 800, 800);
    state.imageName = 'Optical Wave Preset';
  } else if (type === 'portrait') {
    drawSilhouettePortrait(ctx, 800, 800);
    state.imageName = 'Art Portrait Preset';
  }
  
  state.image = tempCanvas;
  
  // Auto-reset coordinates
  state.zoom = 1.0;
  state.panX = 0;
  state.panY = 0;
  state.rotation = 0;
  
  if (uiInterface) {
    uiInterface.resetSliders();
    uiInterface.updateSourceThumbnail(true);
  }
  
  triggerRedraw();
}

function updateCanvasResolution() {
  let w = 800;
  let h = 800;
  
  if (state.aspectRatio === '4:3') {
    h = 600;
  } else if (state.aspectRatio === '16:9') {
    h = 450;
  } else if (state.aspectRatio === '3:4') {
    w = 600;
    h = 800;
  } else if (state.aspectRatio === 'original' && state.image) {
    const imgW = state.image.width || 800;
    const imgH = state.image.height || 800;
    const maxDim = 800;
    
    if (imgW >= imgH) {
      w = maxDim;
      h = Math.round((imgH / imgW) * maxDim);
    } else {
      h = maxDim;
      w = Math.round((imgW / imgH) * maxDim);
    }
  }
  
  sourceCanvas.width = w;
  sourceCanvas.height = h;
  renderCanvas.width = w;
  renderCanvas.height = h;
  
  const frame = document.getElementById('canvasFrame');
  if (frame) {
    frame.style.aspectRatio = `${w} / ${h}`;
  }
  
  triggerRedraw();
}

function init() {
  sourceCanvas = document.createElement('canvas');
  renderCanvas = document.createElement('canvas');
  
  sourceCanvas.width = 800;
  sourceCanvas.height = 800;
  renderCanvas.width = 800;
  renderCanvas.height = 800;
  
  // Initialize UI events & bindings
  uiInterface = initUI(sourceCanvas, renderCanvas, triggerRedraw, loadSamplePattern, updateCanvasResolution);
  
  // Bind standard window actions for HTML templates
  window.loadSamplePattern = loadSamplePattern;
  
  // Initial load
  loadSamplePattern('portrait');
}

window.addEventListener('DOMContentLoaded', init);
export { triggerRedraw, loadSamplePattern, updateCanvasResolution };
