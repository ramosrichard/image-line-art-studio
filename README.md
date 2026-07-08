# Optical Line Art Studio (Line Modulation Generator)

An interactive, high-performance, single-file web application that transforms user-uploaded images or mathematical presets into minimalist, high-contrast monochrome optical line art. The generator maps pixel values along vertical columns to modulate ribbon widths, synthesizing halftones in real time.

---

## 🚀 Live Demo & How to Run
The studio is built entirely on client-side web technologies and requires no compilation, dev server, or node dependencies.

1. Clone or download this repository.
2. Open [index.html](index.html) directly in any modern web browser (Chrome, Firefox, Safari, Edge).
3. Start editing immediately!

---

## 🎨 Key Features

- **Real-Time Modulation Engine:** Instant visual feedback (1–3ms GPU/CPU render times) using throttled HTML5 Canvas API and `requestAnimationFrame`.
- **Flexible Positioning (Pan/Zoom/Rotate):** Drag directly on the preview canvas to pan your image. Use sliders to zoom in/out, and rotate in $90^\circ$ steps to orient the lines.
- **Curated Color Presets:** Choose from 8 premium color palettes, including solid backdrops and horizontal gradient sweeps:
  - *Dark Slate:* Clean ice-white ribbons on slate blue.
  - *Clean Light:* Premium black ink on white.
  - *Amber Glow:* Classic terminal amber on dark stone.
  - *Neo Matrix:* Cyber-green on deep forest black.
  - *Cyberpunk / Sunset / Ocean:* Stunning gradient spectra sweeping across the columns.
  - *Warm Sepia:* Nostalgic brown on cream paper.
- **Y-Axis Smoothing Filter:** Built-in moving average filter along the Y-axis to eliminate jagged edges and synthesize smooth, organic lines.
- **Aspect Ratio Control:** Adapt layouts to Square (1:1), Widescreen (16:9), Portrait (3:4), or match the image's original dimensions automatically.
- **Scalable SVG & PNG Export:**
  - *Download SVG:* Compiles paths into a vector XML document, preserving linear gradient fills. Perfect for print and design work.
  - *Download PNG:* Generates high-res image outputs matching original upload dimensions, scaling stroke widths and smoothing factors proportionally.

---

## 🧮 How It Works (The Algorithm)

For a canvas of width $W_{canvas}$ and density $N$ columns, the horizontal step size is:
$$S = \frac{W_{canvas}}{N}$$

For each vertical line (column $i \in [0, N-1]$), we locate the center coordinate $X_c = (i + 0.5) \times S$. We then step down the vertical $Y$ axis in increments of $dy$:

1. **Luminance Calculation:**
   At coordinate $(X_c, y)$, we retrieve the underlying image pixel $(R, G, B)$ and calculate grayscale luminance:
   $$L = 0.299R + 0.587G + 0.114B$$

2. **Contrast & Brightness Adjustment:**
   Let $\Delta B$ be the Brightness Shift, and $C$ be the Contrast multiplier:
   $$L_{adj} = 128 + (L + \Delta B - 128) \times C$$
   *Note: $L_{adj}$ is clamped to $[0, 255]$.*

3. **Width Modulation:**
   The darkness value is calculated as $d = 1.0 - (L_{adj} / 255.0)$. The raw stroke width is then mapped:
   $$W_{raw} = MinWidth + d \times (MaxWidth - MinWidth)$$

4. **Y-Axis Smoothing:**
   To prevent jagged noise artifacts, we run a moving-average window blur with radius $k$:
   $$W_{smooth}[j] = \frac{1}{2k+1} \sum_{m=-k}^{k} W_{raw}[j+m]$$

5. **Path Construction:**
   The ribbon is closed by tracing down the right boundary $(X_c + \frac{W_{smooth}}{2}, y)$ and back up the left boundary $(X_c - \frac{W_{smooth}}{2}, y)$, forming a single polygon fill operation.

---

## 🛠️ Built With
- **HTML5 Canvas API:** Grayscale sampling and vector path rendering.
- **Tailwind CSS v3 CDN:** Modern, dark-mode developer responsive layout.
- **Google Fonts:** Outfit (headings) and Inter (interface text).
