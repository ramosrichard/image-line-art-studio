export function drawShadedSphere(ctx, w, h) {
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, w, h);
  
  const cx = w * 0.4;
  const cy = h * 0.4;
  const r = Math.min(w, h) * 0.42;
  
  const grad = ctx.createRadialGradient(cx, cy, r * 0.05, w * 0.5, h * 0.5, r);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.3, '#dddddd');
  grad.addColorStop(0.7, '#3a3a3a');
  grad.addColorStop(1, '#000000');
  
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(w * 0.5, h * 0.5, r, 0, Math.PI * 2);
  ctx.fill();
}

export function drawSilhouettePortrait(ctx, w, h) {
  // Draw background gradient
  const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
  bgGrad.addColorStop(0, '#1e293b');
  bgGrad.addColorStop(1, '#0f172a');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, w, h);
  
  ctx.fillStyle = '#ffffff';
  
  // Neck
  ctx.beginPath();
  ctx.moveTo(w * 0.44, h * 0.65);
  ctx.quadraticCurveTo(w * 0.44, h * 0.85, w * 0.40, h * 0.90);
  ctx.lineTo(w * 0.60, h * 0.90);
  ctx.quadraticCurveTo(w * 0.56, h * 0.85, w * 0.56, h * 0.65);
  ctx.closePath();
  ctx.fill();
  
  // Face / Head
  ctx.beginPath();
  ctx.arc(w * 0.5, h * 0.48, w * 0.175, 0, Math.PI * 2);
  ctx.fill();
  
  // Jaw shaping
  ctx.beginPath();
  ctx.moveTo(w * 0.325, h * 0.48);
  ctx.quadraticCurveTo(w * 0.325, h * 0.65, w * 0.5, h * 0.68);
  ctx.quadraticCurveTo(w * 0.675, h * 0.65, w * 0.675, h * 0.48);
  ctx.closePath();
  ctx.fill();
  
  // Hair (dark contrast elements)
  ctx.fillStyle = '#050b14';
  ctx.beginPath();
  ctx.arc(w * 0.5, h * 0.40, w * 0.19, Math.PI, 0); // top hair
  ctx.arc(w * 0.40, h * 0.44, w * 0.08, 0, Math.PI * 2); // side volume
  ctx.arc(w * 0.60, h * 0.44, w * 0.08, 0, Math.PI * 2);
  ctx.fill();
  
  // Glasses bridge & rims
  ctx.lineWidth = w * 0.015;
  ctx.strokeStyle = '#050b14';
  ctx.fillStyle = '#050b14';
  
  // Left eye/glass
  ctx.beginPath();
  ctx.arc(w * 0.425, h * 0.50, w * 0.055, 0, Math.PI * 2);
  ctx.fill();
  
  // Right eye/glass
  ctx.beginPath();
  ctx.arc(w * 0.575, h * 0.50, w * 0.055, 0, Math.PI * 2);
  ctx.fill();
  
  // Nose shadow triangle
  ctx.beginPath();
  ctx.moveTo(w * 0.5, h * 0.50);
  ctx.lineTo(w * 0.48, h * 0.57);
  ctx.lineTo(w * 0.52, h * 0.57);
  ctx.closePath();
  ctx.fill();
  
  // Lips
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.ellipse(w * 0.5, h * 0.61, w * 0.035, h * 0.012, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Apply Composite shade overlay (delivers smooth dark/light gradient to vector structure)
  ctx.globalCompositeOperation = 'source-atop';
  const shade = ctx.createLinearGradient(0, h * 0.2, w, h * 0.8);
  shade.addColorStop(0, '#ffffff');
  shade.addColorStop(0.4, '#e2e8f0');
  shade.addColorStop(0.75, '#475569');
  shade.addColorStop(1, '#020617');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, w, h);
  
  ctx.globalCompositeOperation = 'source-over';
}

export function drawRippleWaves(ctx, w, h) {
  const imgData = ctx.createImageData(w, h);
  const data = imgData.data;
  
  const cx1 = w * 0.35;
  const cy1 = h * 0.35;
  const cx2 = w * 0.70;
  const cy2 = h * 0.70;
  
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      
      const d1 = Math.sqrt((x - cx1)**2 + (y - cy1)**2);
      const d2 = Math.sqrt((x - cx2)**2 + (y - cy2)**2);
      
      const wave1 = Math.sin(d1 / (w * 0.02));
      const wave2 = Math.sin(d2 / (w * 0.03));
      
      const combined = (wave1 + wave2) / 2;
      const val = Math.floor((combined + 1) * 127.5);
      
      data[idx] = val;
      data[idx+1] = val;
      data[idx+2] = val;
      data[idx+3] = 255;
    }
  }
  ctx.putImageData(imgData, 0, 0);
}
