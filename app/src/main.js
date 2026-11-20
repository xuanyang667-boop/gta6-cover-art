// main.js — bootstrap for Neon Vice, the GTA 6-style cover maker.
//
// Two ways in: the plain editor, and screenshot mode (?shot=cover or
// ?shot=editor — see shots.js). Fonts load first so the first render already
// uses the bundled condensed type.

import { defaultState, loadFonts, wireEditor } from './editor.js';
import { readShotParams, runCoverShot, runEditorShot } from './shots.js';

function collectElements() {
  const byId = (id) => document.getElementById(id);
  return {
    preview: byId('preview'),
    layoutBtns: byId('layoutBtns'),
    gradeBtns: byId('gradeBtns'),
    sizeBtns: byId('sizeBtns'),
    titleInput: byId('titleInput'),
    subtitleInput: byId('subtitleInput'),
    kickerInput: byId('kickerInput'),
    panelList: byId('panelList'),
    fillAllBtn: byId('fillAllBtn'),
    exportBtn: byId('exportBtn'),
    sizeNote: byId('sizeNote'),
  };
}

async function main() {
  const params = readShotParams();
  const state = defaultState();
  await loadFonts();

  if (params.shot === 'cover') {
    const shotCanvas = document.getElementById('shotCanvas');
    await runCoverShot(state, params, shotCanvas);
    return;
  }

  const editor = wireEditor(collectElements(), state);
  if (params.shot === 'editor') {
    await runEditorShot(editor.state, params);
    editor.refreshPanels();
  }
  editor.render();
}

main().catch((e) => {
  document.title = `error: ${e.message}`;
  throw e;
});
