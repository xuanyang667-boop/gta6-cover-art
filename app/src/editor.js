// editor.js — the cover editor: state, controls, live preview and export.
//
// The editor keeps one cover state (see cover.js) and re-renders the preview
// canvas on every change. Photos come from the file picker (read on the
// user's own machine, never uploaded) or from the bundled sample photos.

import { SIZES, LAYOUTS, GRADES, panelCount, renderCover, renderCoverToCanvas } from './cover.js';

export const SAMPLE_PHOTOS = {
  pier: { label: 'Pier sunset', src: 'samples/pier.jpg' },
  boulevard: { label: 'Boulevard', src: 'samples/boulevard.jpg' },
};

export function defaultState() {
  return {
    layout: 'duo',
    grade: 'sunset',
    size: 'square',
    title: 'Sunset Heist',
    subtitle: 'Two thieves. One last score.',
    kicker: 'Neon Vice',
    photos: [],
  };
}

// Load an image from a URL (sample photo) or a data URL (upload).
export function loadPhoto(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load photo: ${src}`));
    img.src = src;
  });
}

function emptyPhoto() {
  return { img: null, zoom: 1, ox: 0, oy: 0 };
}

// Make sure the state has exactly one photo slot per panel of its layout.
export function syncPhotoSlots(state) {
  const n = panelCount(state.layout);
  while (state.photos.length < n) state.photos.push(emptyPhoto());
  state.photos.length = n;
  return state;
}

// Fill every panel with the same photo object.
export function fillAllPanels(state, img) {
  syncPhotoSlots(state);
  state.photos = state.photos.map((p) => ({ img, zoom: p.zoom || 1, ox: 0, oy: 0 }));
  return state;
}

// Read a File from the picker into an image.
export function readUploadFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => loadPhoto(reader.result).then(resolve, reject);
    reader.onerror = () => reject(new Error('could not read that file'));
    reader.readAsDataURL(file);
  });
}

// Render the preview canvas at a display size that keeps the export aspect.
export function renderPreview(preview, state) {
  const size = SIZES[state.size] || SIZES.square;
  const maxSide = 640;
  const scale = Math.min(1, maxSide / Math.max(size.w, size.h));
  const off = document.createElement('canvas');
  renderCover(off, state);
  preview.width = Math.round(size.w * scale);
  preview.height = Math.round(size.h * scale);
  const ctx = preview.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(off, 0, 0, preview.width, preview.height);
}

// Export the cover at full size and trigger a PNG download.
export function exportCover(state, filename) {
  const canvas = renderCoverToCanvas(state);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) { reject(new Error('export failed')); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || 'neon-vice-cover.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      resolve(blob);
    }, 'image/png');
  });
}

// Build one panel control card inside a container element.
// onPhoto runs when the panel's photo changes (the card is rebuilt);
// onAdjust runs for slider drags (render only, so the slider is not
// destroyed while it is being dragged).
function buildPanelCard(container, index, state, onPhoto, onAdjust) {
  const card = document.createElement('div');
  card.className = 'panel-card';
  card.dataset.panel = String(index);

  const head = document.createElement('div');
  head.className = 'panel-head';
  const title = document.createElement('span');
  title.textContent = `Panel ${index + 1}`;
  const status = document.createElement('span');
  status.className = 'panel-status';
  status.textContent = state.photos[index] && state.photos[index].img ? 'photo set' : 'empty';
  head.appendChild(title);
  head.appendChild(status);
  card.appendChild(head);

  const row = document.createElement('div');
  row.className = 'panel-row';

  const uploadLabel = document.createElement('label');
  uploadLabel.className = 'btn btn-small';
  uploadLabel.textContent = 'Upload photo';
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*';
  fileInput.hidden = true;
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    try {
      const img = await readUploadFile(file);
      state.photos[index].img = img;
      state.photos[index].zoom = 1;
      state.photos[index].ox = 0;
      state.photos[index].oy = 0;
      onPhoto();
    } catch (e) {
      alert(`That photo could not be read: ${e.message}`);
    }
    fileInput.value = '';
  });
  uploadLabel.appendChild(fileInput);
  row.appendChild(uploadLabel);

  for (const [key, sample] of Object.entries(SAMPLE_PHOTOS)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn btn-small btn-ghost';
    b.textContent = sample.label;
    b.addEventListener('click', async () => {
      try {
        const img = await loadPhoto(sample.src);
        state.photos[index].img = img;
        state.photos[index].zoom = 1;
        state.photos[index].ox = 0;
        state.photos[index].oy = 0;
        onPhoto();
      } catch (e) {
        alert(`Sample photo failed to load: ${e.message}`);
      }
    });
    row.appendChild(b);
  }
  card.appendChild(row);

  const sliders = document.createElement('div');
  sliders.className = 'panel-sliders';
  const defs = [
    ['zoom', 'Zoom', 1, 3, 0.05],
    ['ox', 'Left ↔ right', -1, 1, 0.05],
    ['oy', 'Up ↕ down', -1, 1, 0.05],
  ];
  for (const [key, label, min, max, step] of defs) {
    const wrap = document.createElement('label');
    wrap.className = 'slider-row';
    const span = document.createElement('span');
    span.textContent = label;
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(state.photos[index][key]);
    input.addEventListener('input', () => {
      state.photos[index][key] = parseFloat(input.value);
      onAdjust();
    });
    wrap.appendChild(span);
    wrap.appendChild(input);
    sliders.appendChild(wrap);
  }
  card.appendChild(sliders);
  container.appendChild(card);
  return card;
}

// Wire the whole editor. `els` holds the DOM elements by id; returns an
// object with the live state and a rerender function for shot mode.
export function wireEditor(els, initialState) {
  const state = syncPhotoSlots(initialState || defaultState());
  let scheduled = false;

  function render() {
    renderPreview(els.preview, state);
    const size = SIZES[state.size];
    if (els.sizeNote) els.sizeNote.textContent = `Exporting at ${size.w} × ${size.h} PNG`;
  }

  function requestRender() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; render(); });
  }

  function refreshPanels() {
    syncPhotoSlots(state);
    els.panelList.innerHTML = '';
    state.photos.forEach((_, i) => buildPanelCard(
      els.panelList, i, state,
      () => { requestRender(); refreshPanels(); },
      () => requestRender(),
    ));
  }

  // Copy the live state back into the controls: caption inputs and the
  // active layout / grade / size buttons. Screenshot mode changes the state
  // after wiring, so without this the inputs show the defaults while the
  // preview shows the shot's caption and layout.
  function syncControls() {
    if (els.layoutBtns) markActive(els.layoutBtns, state.layout);
    if (els.gradeBtns) markActive(els.gradeBtns, state.grade);
    if (els.sizeBtns) markActive(els.sizeBtns, state.size);
    if (els.titleInput) els.titleInput.value = state.title;
    if (els.subtitleInput) els.subtitleInput.value = state.subtitle;
    if (els.kickerInput) els.kickerInput.value = state.kicker;
  }

  function markActive(group, value) {
    group.querySelectorAll('button').forEach((b) => {
      b.classList.toggle('active', b.dataset.value === value);
    });
  }

  function bindChoice(group, key, onPick) {
    if (!group) return;
    group.querySelectorAll('button').forEach((b) => {
      b.addEventListener('click', () => {
        state[key] = b.dataset.value;
        markActive(group, state[key]);
        if (onPick) onPick();
        requestRender();
      });
    });
    markActive(group, state[key]);
  }

  bindChoice(els.layoutBtns, 'layout', refreshPanels);
  bindChoice(els.gradeBtns, 'grade');
  bindChoice(els.sizeBtns, 'size');

  if (els.titleInput) {
    els.titleInput.value = state.title;
    els.titleInput.addEventListener('input', () => { state.title = els.titleInput.value; requestRender(); });
  }
  if (els.subtitleInput) {
    els.subtitleInput.value = state.subtitle;
    els.subtitleInput.addEventListener('input', () => { state.subtitle = els.subtitleInput.value; requestRender(); });
  }
  if (els.kickerInput) {
    els.kickerInput.value = state.kicker;
    els.kickerInput.addEventListener('input', () => { state.kicker = els.kickerInput.value; requestRender(); });
  }
  if (els.fillAllBtn) {
    els.fillAllBtn.addEventListener('click', () => {
      const first = state.photos.find((p) => p.img);
      if (!first) { alert('Add a photo to any panel first.'); return; }
      fillAllPanels(state, first.img);
      refreshPanels();
      requestRender();
    });
  }
  if (els.exportBtn) {
    els.exportBtn.addEventListener('click', async () => {
      els.exportBtn.disabled = true;
      els.exportBtn.textContent = 'Exporting…';
      try {
        await exportCover(state);
      } catch (e) {
        alert(`Export failed: ${e.message}`);
      }
      els.exportBtn.disabled = false;
      els.exportBtn.textContent = 'Export PNG';
    });
  }

  refreshPanels();
  return { state, render, requestRender, refreshPanels, syncControls };
}

// Load the bundled fonts, then render once. Falls back silently if a font
// fails: the canvas uses its sans-serif fallback.
export async function loadFonts() {
  const faces = [
    ['ViceCondensed', "url('fonts/NotoSans-CondensedBlack.ttf')", '900'],
    ['ViceBold', "url('fonts/NotoSans-Bold.ttf')", '700'],
    ['ViceText', "url('fonts/NotoSans-Regular.ttf')", '400'],
  ];
  await Promise.all(faces.map(async ([family, src, weight]) => {
    try {
      const face = new FontFace(family, src, { weight });
      const loaded = await face.load();
      document.fonts.add(loaded);
    } catch (e) {
      // Font failed; canvas falls back to sans-serif.
    }
  }));
  try {
    await Promise.race([
      Promise.all([
        document.fonts.load('900 100px ViceCondensed'),
        document.fonts.load('700 40px ViceBold'),
      ]),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
  } catch (e) { /* fall back */ }
}
