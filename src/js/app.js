import { state } from './state.js';
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
    
    renderLineModulation(sourceCanvas, renderCanvas, false, updateStats);
    
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
