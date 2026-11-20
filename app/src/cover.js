// cover.js — draws a GTA 6-style multi-panel cover onto a canvas.
//
// The cover is a collage of photo panels in a sunset / neon colour grade,
// with a big condensed caption across it. Everything here is pure drawing:
// no top-level DOM access, so the geometry can be smoke-tested in Node.
//
// A cover state looks like:
//   {
//     layout: 'duo' | 'grid' | 'hero',
//     grade: 'sunset' | 'neon' | 'noir' | 'vivid',
//     size: 'square' | 'portrait' | 'wide',
//     title: 'SUNSET HEIST',
//     subtitle: 'Two thieves. One last score.',
//     kicker: 'NEON VICE',
//     photos: [{ img, zoom, ox, oy }, ...]   // one entry per panel
//   }
// Photos are HTMLImageElement (or any object with naturalWidth/naturalHeight
// plus width/height). zoom is 1..3, ox/oy are -1..1 pan offsets.

export const SIZES = {
  square: { label: 'Square · 1080 × 1080', w: 1080, h: 1080 },
  portrait: { label: 'Portrait · 1080 × 1350', w: 1080, h: 1350 },
  wide: { label: 'Wide · 1920 × 1080', w: 1920, h: 1080 },
};

export const LAYOUTS = {
  duo: { label: 'Diagonal Duo', panels: 2, blurb: 'Two photos split on a diagonal' },
  grid: { label: 'Comic Grid', panels: 4, blurb: 'Four panels, comic-strip style' },
  hero: { label: 'Hero Strip', panels: 3, blurb: 'One big photo, two small below' },
};

export const GRADES = {
  sunset: {
    label: 'Vice Sunset',
    filter: 'sepia(0.32) saturate(1.55) contrast(1.06) hue-rotate(-12deg) brightness(1.02)',
    wash: ['#ff9a3c', '#ff2975'],
    washAlpha: 0.16,
  },
  neon: {
    label: 'Neon Nights',
    filter: 'saturate(1.65) contrast(1.14) hue-rotate(12deg) brightness(0.98)',
    wash: ['#ff2ea6', '#22d3ee'],
    washAlpha: 0.18,
  },
  noir: {
    label: 'Noir',
    filter: 'grayscale(1) contrast(1.22) brightness(0.96)',
    wash: ['#3b3b3b', '#000000'],
    washAlpha: 0.10,
  },
  vivid: {
    label: 'Vivid Day',
    filter: 'saturate(1.85) contrast(1.1) brightness(1.03)',
    wash: ['#ffd319', '#ff2975'],
    washAlpha: 0.10,
  },
};

// Panel polygons for a layout, in canvas pixels. Each polygon is a list of
// [x, y] points. Panels are listed in reading order (top-left first).
export function panelPolygons(layout, w, h) {
  const gap = Math.round(Math.min(w, h) * 0.012);
  if (layout === 'grid') {
    const hw = (w - gap) / 2;
    const hh = (h - gap) / 2;
    return [
      [[0, 0], [hw, 0], [hw, hh], [0, hh]],
      [[hw + gap, 0], [w, 0], [w, hh], [hw + gap, hh]],
      [[0, hh + gap], [hw, hh + gap], [hw, h], [0, h]],
      [[hw + gap, hh + gap], [w, hh + gap], [w, h], [hw + gap, h]],
    ];
  }
  if (layout === 'hero') {
    const topH = Math.round(h * 0.62);
    const botY = topH + gap;
    const botH = h - botY;
    const half = (w - gap) / 2;
    return [
      [[0, 0], [w, 0], [w, topH], [0, topH]],
      [[0, botY], [half, botY], [half, h], [0, h]],
      [[half + gap, botY], [w, botY], [w, h], [half + gap, h]],
    ];
  }
  // 'duo': two quads split on a diagonal from upper-left to lower-right.
  const xTop = Math.round(w * 0.42);
  const xBot = Math.round(w * 0.58);
  return [
    [[0, 0], [xTop, 0], [xBot, h], [0, h]],
    [[xTop, 0], [w, 0], [w, h], [xBot, h]],
  ];
}

export function panelCount(layout) {
  return LAYOUTS[layout] ? LAYOUTS[layout].panels : 2;
}

// Bounding box of a polygon: [x, y, w, h].
export function polygonBounds(poly) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of poly) {
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }
  return [x0, y0, x1 - x0, y1 - y0];
}

// Cover-fit draw rectangle for an image inside a box, with zoom and pan.
// Returns [dx, dy, dw, dh] in canvas pixels.
export function fitPhoto(img, bx, by, bw, bh, zoom, ox, oy) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const scale = Math.max(bw / iw, bh / ih) * (zoom || 1);
  const dw = iw * scale;
  const dh = ih * scale;
  const px = ox || 0;
  const py = oy || 0;
  const dx = bx + (bw - dw) / 2 + px * Math.max(0, (dw - bw) / 2);
  const dy = by + (bh - dh) / 2 + py * Math.max(0, (dh - bh) / 2);
  return [dx, dy, dw, dh];
}

// Trace a polygon path on the context.
function tracePolygon(ctx, poly) {
  ctx.beginPath();
  ctx.moveTo(poly[0][0], poly[0][1]);
  for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i][0], poly[i][1]);
  ctx.closePath();
}

// Fill a panel that has no photo yet: a sunset gradient with a label.
function drawEmptyPanel(ctx, poly, index) {
  const [x, y, w, h] = polygonBounds(poly);
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, '#2b1055');
  g.addColorStop(0.55, '#7597de');
  g.addColorStop(1, '#ff7e5f');
  tracePolygon(ctx, poly);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = `700 ${Math.round(Math.min(w, h) * 0.06)}px ViceBold, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`PANEL ${index + 1}`, x + w / 2, y + h / 2);
  ctx.restore();
}

// Draw one photo inside its panel polygon, with the grade filter applied.
function drawPhotoPanel(ctx, poly, photo, grade, index) {
  const [x, y, w, h] = polygonBounds(poly);
  ctx.save();
  tracePolygon(ctx, poly);
  ctx.clip();
  if (photo && photo.img) {
    ctx.filter = grade.filter;
    const [dx, dy, dw, dh] = fitPhoto(photo.img, x, y, w, h, photo.zoom, photo.ox, photo.oy);
    ctx.drawImage(photo.img, dx, dy, dw, dh);
    ctx.filter = 'none';
  } else {
    drawEmptyPanel(ctx, poly, index);
  }
  // Thin dark seam between panels.
  ctx.strokeStyle = 'rgba(10, 8, 24, 0.9)';
  ctx.lineWidth = Math.max(2, Math.round(Math.min(w, h) * 0.008));
  ctx.stroke();
  ctx.restore();
}

// Largest pixel size (at most 100) at which the text fits maxWidth.
// fontForSize takes a pixel size and returns a full canvas font string.
function fitTextSize(ctx, text, maxWidth, fontForSize) {
  let px = 100;
  const measure = (size) => { ctx.font = fontForSize(size); return ctx.measureText(text).width; };
  while (px > 12 && measure(px) > maxWidth) px -= 4;
  return px;
}

// Shrink text until it fits the given width, then draw it centred.
function drawFittedText(ctx, text, cx, y, maxWidth, fontForSize, fill, stroke) {
  const px = fitTextSize(ctx, text, maxWidth, fontForSize);
  ctx.font = fontForSize(px);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (stroke) {
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.strokeText(text, cx, y);
  }
  ctx.fillStyle = fill;
  ctx.fillText(text, cx, y);
  return px;
}

// Draw the caption block: kicker, big title, subtitle bar.
//
// Laid out from the bottom up so the three lines never overlap and the
// block always ends with a margin inside the canvas: the subtitle bar sits
// a fixed margin above the bottom edge, the title above it, the kicker
// above the title. The title's fitted size is measured before anything is
// placed, so its real height sets the spacing (the old top-down layout let
// the title's lower half slide under the subtitle bar).
function drawCaption(ctx, w, h, state) {
  const pad = Math.round(w * 0.045);
  const title = (state.title || 'UNTITLED').toUpperCase();
  const subtitle = state.subtitle || '';
  const kicker = state.kicker || '';
  const cx = w / 2;

  // Title font: condensed 900, fitted to the canvas width.
  const titleFont = (s) => `900 ${s}px ViceCondensed, 'Arial Narrow', sans-serif`;
  const fitted = fitTextSize(ctx, title, w - pad * 2, titleFont);
  // Caps sit roughly ±0.38em around a 'middle' baseline.
  const titleHalf = Math.round(fitted * 0.38);
  const titleSize = Math.round(h * 0.105);

  const subSize = Math.round(h * 0.026);
  const barH = subSize + Math.round(h * 0.016);
  const bottomMargin = Math.round(h * 0.032);
  const gapTitleSub = Math.round(h * 0.028);
  const gapKickerTitle = Math.round(h * 0.022);
  const kickerSize = Math.round(h * 0.02);

  const subY = h - bottomMargin - barH / 2;
  const titleY = subY - barH / 2 - gapTitleSub - titleHalf;
  const kickerY = titleY - titleHalf - gapKickerTitle - kickerSize / 2;
  const ruleY = kickerY - kickerSize / 2 - Math.round(h * 0.012);

  // Dark legibility gradient behind the whole caption block.
  const legTop = Math.max(0, ruleY - Math.round(h * 0.05));
  const leg = ctx.createLinearGradient(0, legTop, 0, h);
  leg.addColorStop(0, 'rgba(8, 4, 24, 0)');
  leg.addColorStop(1, 'rgba(8, 4, 24, 0.82)');
  ctx.fillStyle = leg;
  ctx.fillRect(0, legTop, w, h - legTop);

  // Pink accent rule above the kicker.
  ctx.fillStyle = '#ff2975';
  ctx.fillRect(pad, ruleY, Math.round(w * 0.16), Math.max(3, Math.round(h * 0.006)));

  if (kicker) {
    ctx.save();
    try { ctx.letterSpacing = `${Math.round(w * 0.006)}px`; } catch (e) { /* older canvas */ }
    ctx.font = `700 ${kickerSize}px ViceBold, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffd319';
    ctx.fillText(kicker.toUpperCase(), cx, kickerY);
    ctx.restore();
  }

  // Big condensed title with a sunset fill and a black outline.
  const grad = ctx.createLinearGradient(0, titleY - titleHalf, 0, titleY + titleHalf);
  grad.addColorStop(0, '#fff7d6');
  grad.addColorStop(0.45, '#ffd319');
  grad.addColorStop(1, '#ff2975');
  ctx.save();
  ctx.translate(cx, titleY);
  ctx.rotate(-0.018);
  ctx.translate(-cx, -titleY);
  drawFittedText(
    ctx, title, cx, titleY, w - pad * 2,
    titleFont,
    grad, { color: 'rgba(8,4,24,0.95)', width: Math.max(4, Math.round(titleSize * 0.09)) },
  );
  ctx.restore();

  if (subtitle) {
    ctx.save();
    ctx.font = `700 ${subSize}px ViceBold, sans-serif`;
    const tw = ctx.measureText(subtitle).width;
    const barPad = Math.round(w * 0.02);
    const barW = Math.min(tw + barPad * 2, w - pad * 2);
    ctx.fillStyle = 'rgba(8, 4, 24, 0.88)';
    ctx.fillRect(cx - barW / 2, subY - barH / 2, barW, barH);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(subtitle, cx, subY + 1);
    ctx.restore();
  }
}

// Wash the whole cover with the grade's colour gradient, then vignette it.
function drawGradeWash(ctx, w, h, grade) {
  const wash = ctx.createLinearGradient(0, 0, w, h);
  wash.addColorStop(0, grade.wash[0]);
  wash.addColorStop(1, grade.wash[1]);
  ctx.save();
  ctx.globalAlpha = grade.washAlpha;
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  const vig = ctx.createRadialGradient(
    w / 2, h / 2, Math.min(w, h) * 0.42,
    w / 2, h / 2, Math.max(w, h) * 0.75,
  );
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(5,2,16,0.42)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
}

// Render a cover state onto a canvas sized to its export size.
// The canvas is resized in place and returned.
export function renderCover(canvas, state) {
  const size = SIZES[state.size] || SIZES.square;
  const grade = GRADES[state.grade] || GRADES.sunset;
  const w = size.w;
  const h = size.h;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);

  // Deep violet base so seams and empty space read as night sky.
  ctx.fillStyle = '#14082e';
  ctx.fillRect(0, 0, w, h);

  const polys = panelPolygons(state.layout || 'duo', w, h);
  const photos = state.photos || [];
  polys.forEach((poly, i) => {
    drawPhotoPanel(ctx, poly, photos[i] || null, grade, i);
  });

  drawGradeWash(ctx, w, h, grade);
  drawCaption(ctx, w, h, state);
  return canvas;
}

// Render to a fresh offscreen canvas (browser only).
export function renderCoverToCanvas(state) {
  const canvas = document.createElement('canvas');
  return renderCover(canvas, state);
}
