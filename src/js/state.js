export const state = {
  activeModule: 'line-modulation', // Active generator module
  image: null,            // Active image element or Canvas object
  imageName: 'Sample Pattern',
  
  // Transform coordinates for mapping images
  zoom: 1.0,
  panX: 0,
  panY: 0,
  rotation: 0,            // 0, 90, 180, 270 degrees
  aspectRatio: '1:1',     // '1:1', '4:3', '16:9', '3:4', 'original'

  // Modulation Algorithm parameters
  lineCount: 60,
  lineAngle: 0,           // Angle of lines in degrees (-90 to 90)
  maxWidth: 8.0,
  minWidth: 0.5,
  smoothing: 5,
  contrast: 1.0,
  brightness: 0,

  // Aesthetics & Output config
  transparentBg: false,
  colorPreset: 'monochrome-light',
  highResExport: true
};
