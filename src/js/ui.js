import { state } from './state.js';
import { presets } from './presets.js';
import { downloadPNG, downloadSVG } from './exporter.js';

export function initUI(sourceCanvas, renderCanvas, triggerRedraw, loadSamplePattern, updateCanvasResolution) {
  // DOM Module Selection
  const moduleDropdownBtn = document.getElementById('moduleDropdownBtn');
  const moduleDropdownPanel = document.getElementById('moduleDropdownPanel');
  const activeModuleIcon = document.getElementById('activeModuleIcon');

  // DOM Sliders & Badges
  const zoomSlider = document.getElementById('zoomSlider');
  const zoomVal = document.getElementById('zoomVal');
  const lineCountSlider = document.getElementById('lineCountSlider');
  const lineCountVal = document.getElementById('lineCountVal');
  const lineAngleSlider = document.getElementById('lineAngleSlider');
  const lineAngleVal = document.getElementById('lineAngleVal');
  const maxWidthSlider = document.getElementById('maxWidthSlider');
  const maxWidthVal = document.getElementById('maxWidthVal');
  const minWidthSlider = document.getElementById('minWidthSlider');
  const minWidthVal = document.getElementById('minWidthVal');
  const smoothingSlider = document.getElementById('smoothingSlider');
  const smoothingVal = document.getElementById('smoothingVal');
  const contrastSlider = document.getElementById('contrastSlider');
  const contrastVal = document.getElementById('contrastVal');
  const brightnessSlider = document.getElementById('brightnessSlider');
  const brightnessVal = document.getElementById('brightnessVal');
  
  const fileInput = document.getElementById('fileInput');
  const dropZone = document.getElementById('dropZone');
  const clearSourceImgBtn = document.getElementById('clearSourceImgBtn');
  
  const compareBtn = document.getElementById('compareBtn');
  const sourceOverlay = document.getElementById('sourceOverlayCanvas');
  
  const previewCanvas = document.getElementById('previewCanvas');
  
  // Hold-to-compare View Logic
  const updateSourceOverlay = () => {
    const overlayCtx = sourceOverlay.getContext('2d');
    sourceOverlay.width = sourceCanvas.width;
    sourceOverlay.height = sourceCanvas.height;
    overlayCtx.drawImage(sourceCanvas, 0, 0);
  };
  
  const showOverlay = () => {
    updateSourceOverlay();
    sourceOverlay.classList.remove('opacity-0');
    sourceOverlay.classList.add('opacity-70');
  };
  
  const hideOverlay = () => {
    sourceOverlay.classList.remove('opacity-70');
    sourceOverlay.classList.add('opacity-0');
  };

  compareBtn.addEventListener('mousedown', showOverlay);
  compareBtn.addEventListener('mouseup', hideOverlay);
  compareBtn.addEventListener('mouseleave', hideOverlay);
  
  compareBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    showOverlay();
  });
  compareBtn.addEventListener('touchend', hideOverlay);

  // Sliders Input Bindings
  const sliders = [
    { el: zoomSlider, valEl: zoomVal, key: 'zoom', suffix: 'x', decimals: 2 },
    { el: lineCountSlider, valEl: lineCountVal, key: 'lineCount', suffix: '', decimals: 0 },
    { el: lineAngleSlider, valEl: lineAngleVal, key: 'lineAngle', suffix: '°', decimals: 0 },
    { el: maxWidthSlider, valEl: maxWidthVal, key: 'maxWidth', suffix: 'px', decimals: 1 },
    { el: minWidthSlider, valEl: minWidthVal, key: 'minWidth', suffix: 'px', decimals: 1 },
    { el: smoothingSlider, valEl: smoothingVal, key: 'smoothing', suffix: 'px', decimals: 0 },
    { el: contrastSlider, valEl: contrastVal, key: 'contrast', suffix: 'x', decimals: 2 },
    { el: brightnessSlider, valEl: brightnessVal, key: 'brightness', suffix: '', decimals: 0 }
  ];

  sliders.forEach((sliderDef) => {
    sliderDef.el.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      state[sliderDef.key] = val;
      sliderDef.valEl.innerText = val.toFixed(sliderDef.decimals) + sliderDef.suffix;
      triggerRedraw();
    });
  });

  // Canvas Drag/Pan coordinates tracking
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let startPanX = 0;
  let startPanY = 0;

  const onStart = (clientX, clientY) => {
    isDragging = true;
    dragStartX = clientX;
    dragStartY = clientY;
    startPanX = state.panX;
    startPanY = state.panY;
    previewCanvas.classList.add('cursor-grabbing');
  };
  
  const onMove = (clientX, clientY) => {
    if (!isDragging) return;
    const rect = previewCanvas.getBoundingClientRect();
    const scaleX = previewCanvas.width / rect.width;
    const scaleY = previewCanvas.height / rect.height;
    
    const dx = (clientX - dragStartX) * scaleX;
    const dy = (clientY - dragStartY) * scaleY;
    
    state.panX = startPanX + dx;
    state.panY = startPanY + dy;
    triggerRedraw();
  };
  
  const onEnd = () => {
    if (isDragging) {
      isDragging = false;
      previewCanvas.classList.remove('cursor-grabbing');
    }
  };

  previewCanvas.addEventListener('mousedown', (e) => onStart(e.clientX, e.clientY));
  window.addEventListener('mousemove', (e) => onMove(e.clientX, e.clientY));
  window.addEventListener('mouseup', onEnd);
  
  previewCanvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      onStart(e.touches[0].clientX, e.touches[0].clientY);
    }
  });
  previewCanvas.addEventListener('touchmove', (e) => {
    if (e.touches.length === 1) {
      onMove(e.touches[0].clientX, e.touches[0].clientY);
      e.preventDefault();
    }
  }, { passive: false });
  previewCanvas.addEventListener('touchend', onEnd);

  // File Uploader Event Bindings
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('border-cyan-500', 'bg-slate-800/40');
  });
  
  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('border-cyan-500', 'bg-slate-800/40');
  });
  
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('border-cyan-500', 'bg-slate-800/40');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  });
  
  dropZone.addEventListener('click', () => fileInput.click());
  
  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  });

  clearSourceImgBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    loadSamplePattern('portrait');
  });

  const processFile = (file) => {
    if (!file.type.match('image/png') && !file.type.match('image/jpeg')) {
      alert('Invalid file format. Please upload a PNG or JPEG file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        state.image = img;
        state.imageName = file.name;
        
        state.zoom = 1.0;
        state.panX = 0;
        state.panY = 0;
        state.rotation = 0;
        
        zoomSlider.value = 1.0;
        zoomVal.innerText = '1.00x';
        
        updateSourceThumbnail(false);
        if (state.aspectRatio === 'original') {
          updateCanvasResolution();
        } else {
          triggerRedraw();
        }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  };

  // Thumbnail rendering helper
  const updateSourceThumbnail = (isPreset) => {
    const container = document.getElementById('sourceThumbnailContainer');
    const thumbImg = document.getElementById('sourceThumbnailImg');
    const nameTxt = document.getElementById('sourceImgName');
    const resTxt = document.getElementById('sourceImgResolution');
    
    container.classList.remove('hidden');
    nameTxt.innerText = state.imageName;
    
    if (isPreset) {
      const thumbCanvas = document.createElement('canvas');
      thumbCanvas.width = 100;
      thumbCanvas.height = 100;
      const thumbCtx = thumbCanvas.getContext('2d');
      thumbCtx.drawImage(state.image, 0, 0, 100, 100);
      thumbImg.src = thumbCanvas.toDataURL();
      resTxt.innerText = '800 x 800 px (Preset)';
    } else {
      thumbImg.src = state.image.src;
      resTxt.innerText = `${state.image.width} x ${state.image.height} px`;
    }
  };

  // Preset Colors Selector Grid Generator
  const initPaletteGrid = () => {
    const grid = document.getElementById('paletteGrid');
    grid.innerHTML = '';
    
    Object.keys(presets).forEach((key) => {
      const preset = presets[key];
      const btn = document.createElement('button');
      btn.id = `preset-btn-${key}`;
      btn.title = preset.name;
      
      btn.className = `w-full aspect-square rounded-xl border-2 transition duration-200 shadow-sm relative group cursor-pointer ${preset.previewClass} ${
        state.colorPreset === key ? 'border-cyan-400 scale-[1.08] ring-2 ring-cyan-500/20 shadow-cyan-500/10' : 'border-slate-800 hover:border-slate-600 hover:scale-[1.04]'
      }`;
      
      btn.innerHTML = `
        <div class="absolute inset-0 rounded-lg flex items-center justify-center">
          <span class="text-[9px] font-bold opacity-0 group-hover:opacity-100 transition duration-150 ${
            key === 'monochrome-light' || key === 'sepia' ? 'text-slate-800' : 'text-slate-200'
          }">${preset.name.split(' ')[0]}</span>
        </div>
      `;
      
      btn.addEventListener('click', () => {
        const activeBtn = document.getElementById(`preset-btn-${state.colorPreset}`);
        if (activeBtn) {
          activeBtn.classList.remove('border-cyan-400', 'scale-[1.08]', 'ring-2', 'ring-cyan-500/20', 'shadow-cyan-500/10');
          activeBtn.classList.add('border-slate-800');
        }
        
        state.colorPreset = key;
        
        btn.classList.remove('border-slate-800');
        btn.classList.add('border-cyan-400', 'scale-[1.08]', 'ring-2', 'ring-cyan-500/20', 'shadow-cyan-500/10');
        
        triggerRedraw();
      });
      
      grid.appendChild(btn);
    });
  };

  initPaletteGrid();

  // Attach global actions to window for native HTML callback compatibility
  window.downloadPNG = () => downloadPNG(renderCanvas);
  window.downloadSVG = () => downloadSVG(sourceCanvas, renderCanvas);
  window.toggleTransparency = () => {
    state.transparentBg = document.getElementById('transparencyToggle').checked;
    const checkerboard = document.getElementById('checkerboard');
    if (state.transparentBg) {
      checkerboard.classList.remove('hidden');
    } else {
      checkerboard.classList.add('hidden');
    }
    triggerRedraw();
  };
  window.toggleHighResExport = () => {
    state.highResExport = document.getElementById('highResExportToggle').checked;
  };

  // Attach button triggers to window
  window.resetPlacement = () => {
    state.zoom = 1.0;
    state.panX = 0;
    state.panY = 0;
    state.rotation = 0;
    
    zoomSlider.value = 1.0;
    zoomVal.innerText = '1.00x';
    triggerRedraw();
  };

  window.adjustZoom = (amount) => {
    let newVal = parseFloat(zoomSlider.value) + amount;
    newVal = Math.max(0.1, Math.min(5.0, newVal));
    zoomSlider.value = newVal.toFixed(2);
    state.zoom = newVal;
    zoomVal.innerText = newVal.toFixed(2) + 'x';
    triggerRedraw();
  };

  window.rotateImage = () => {
    state.rotation = (state.rotation + 90) % 360;
    triggerRedraw();
  };

  window.changeAspectRatio = () => {
    state.aspectRatio = document.getElementById('aspectRatioSelect').value;
    updateCanvasResolution();
  };

  // Toggle module dropdown visibility
  moduleDropdownBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    moduleDropdownPanel.classList.toggle('hidden');
  });

  // Close dropdown on click outside
  window.addEventListener('click', (e) => {
    if (!moduleDropdownPanel.classList.contains('hidden') && !e.target.closest('#moduleDropdownContainer')) {
      moduleDropdownPanel.classList.add('hidden');
    }
  });

  // Module switcher callback
  window.selectModule = (moduleName) => {
    state.activeModule = moduleName;
    moduleDropdownPanel.classList.add('hidden');

    // Update active icon
    const icons = {
      'line-modulation': '🌊',
      'dot-halftone': '⚫',
      'geometric-triangles': '🔺'
    };
    activeModuleIcon.innerText = icons[moduleName] || '🌊';

    // Show/hide respective controls panel
    const panels = ['line-modulation', 'dot-halftone', 'geometric-triangles'];
    panels.forEach((p) => {
      const panelEl = document.getElementById(`panel-controls-${p}`);
      const btnEl = document.getElementById(`btn-opt-${p}`);
      const checkEl = document.getElementById(`check-${p}`);

      if (panelEl) {
        if (p === moduleName) {
          panelEl.classList.remove('hidden');
        } else {
          panelEl.classList.add('hidden');
        }
      }

      if (btnEl) {
        if (p === moduleName) {
          btnEl.classList.add('bg-slate-800/80', 'border-slate-700');
        } else {
          btnEl.classList.remove('bg-slate-800/80', 'border-slate-700');
        }
      }

      if (checkEl) {
        if (p === moduleName) {
          checkEl.classList.remove('hidden');
        } else {
          checkEl.classList.add('hidden');
        }
      }
    });

    triggerRedraw();
  };

  return {
    updateSourceThumbnail,
    resetSliders: () => {
      zoomSlider.value = 1.0;
      zoomVal.innerText = '1.00x';
    }
  };
}
