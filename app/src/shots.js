// shots.js — screenshot mode for the cover maker.
//
// The app supports two shareable views through its query string, so a cover
// or the editor can be opened exactly as it should be photographed:
//
//   ?shot=cover&photo=pier&caption=Sunset%20Heist&layout=duo&grade=sunset&size=wide
//   ?shot=editor&photo=boulevard&caption=Boulevard%20Queen&layout=grid&grade=neon
//
// `photo` fills panel 1; `panels=pier,boulevard,pier` fills several panels
// in order. In cover mode the editor chrome is hidden and the exported cover
// is drawn full-viewport. When the view is ready, window.__shotReady is set
// to true and the document title becomes "shot-ready".

import { SIZES, LAYOUTS, GRADES, panelCount, renderCover } from './cover.js';
import { SAMPLE_PHOTOS, loadPhoto, syncPhotoSlots } from './editor.js';

export function readShotParams(search) {
  const q = new URLSearchParams(search || window.location.search);
  const pick = (key, allowed, fallback) => {
    const v = q.get(key);
    return v && allowed.includes(v) ? v : fallback;
  };
  return {
    shot: pick('shot', ['cover', 'editor'], ''),
    layout: pick('layout', Object.keys(LAYOUTS), 'duo'),
    grade: pick('grade', Object.keys(GRADES), 'sunset'),
    size: pick('size', Object.keys(SIZES), 'square'),
    caption: q.get('caption') || '',
    subtitle: q.get('subtitle') || '',
    kicker: q.get('kicker') || '',
    photo: q.get('photo') || '',
    panels: q.get('panels') || '',
  };
}

// Resolve a sample-photo name to its bundled file.
function sampleSrc(name) {
  const sample = SAMPLE_PHOTOS[name];
  return sample ? sample.src : null;
}

// Load the photos named by the shot params into the state, in panel order.
export async function applyShotPhotos(state, params) {
  syncPhotoSlots(state);
  const names = params.panels
    ? params.panels.split(',').map((s) => s.trim()).filter(Boolean)
    : (params.photo ? [params.photo] : []);
  const jobs = names.slice(0, state.photos.length).map(async (name, i) => {
    const src = sampleSrc(name);
    if (!src) return;
    try {
      const img = await loadPhoto(src);
      state.photos[i].img = img;
      state.photos[i].zoom = 1;
      state.photos[i].ox = 0;
      state.photos[i].oy = 0;
    } catch (e) {
      // A missing sample leaves the panel empty; the cover still renders.
    }
  });
  await Promise.all(jobs);
  return state;
}

function applyShotText(state, params) {
  if (params.caption) state.title = params.caption;
  if (params.subtitle) state.subtitle = params.subtitle;
  if (params.kicker) state.kicker = params.kicker;
  state.layout = params.layout;
  state.grade = params.grade;
  state.size = params.size;
  return state;
}

function markReady() {
  window.__shotReady = true;
  document.title = 'shot-ready';
}

// Cover mode: hide the editor, draw the cover full-viewport.
export async function runCoverShot(state, params, shotCanvas) {
  document.body.classList.add('shot-cover');
  applyShotText(state, params);
  await applyShotPhotos(state, params);
  renderCover(shotCanvas, state);
  const size = SIZES[state.size];
  shotCanvas.style.aspectRatio = `${size.w} / ${size.h}`;
  markReady();
  return state;
}

// Editor mode: prefill the editor with a photo and caption, then show it.
export async function runEditorShot(state, params) {
  applyShotText(state, params);
  await applyShotPhotos(state, params);
  markReady();
  return state;
}
