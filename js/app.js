/* ============================================================
   SubtitleMerge — App Orchestration
   DOM wiring, state management, event handling
   ============================================================ */

import { detectLanguage, baseName, autoPairFiles, readFileAsText, uid } from './utils.js';
import { parseSubtitle, serializeToSRT, serializeToVTT } from './parser.js';
import { mergeCues, applyCueOffset } from './merger.js';

/* -------- State -------- */
const state = {
  files: [],   // { id, file, lang, base }
  pairs: [],   // { id, top: fileEntry, bottom: fileEntry, topOffset: 0, bottomOffset: 0, topCues, bottomCues, showPreview }
  unpaired: [],
};

/* -------- DOM References -------- */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const dropzone = $('#dropzone');
const fileInput = $('#file-input');
const fileListEl = $('#file-list');
const pairsSection = $('#pairs-section');
const pairsContainer = $('#pairs-container');
const emptyState = $('#empty-state');
const mergeSection = $('#merge-section');
const outputFormat = $('#output-format');
const mergeBtn = $('#merge-btn');
const mergeBtnText = $('#merge-btn-text');
const downloadAllBtn = $('#download-all-btn');
const clearBtn = $('#clear-btn');
const toastContainer = $('#toast-container');
const topItalicCheckbox = $('#top-italic');
const bottomItalicCheckbox = $('#bottom-italic');

/* -------- Toast -------- */
function showToast(message, type = 'info') {
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.innerHTML = `<span class="toast__icon">${icons[type]}</span><span>${message}</span>`;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('toast--leaving');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

/* -------- File Handling -------- */
function handleFiles(fileList) {
  const validExts = ['srt', 'vtt'];
  const newFiles = [];

  for (const file of fileList) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (!validExts.includes(ext)) {
      showToast(`Skipped "${file.name}" — unsupported format`, 'error');
      continue;
    }
    const lang = detectLanguage(file.name);
    const base = baseName(file.name);
    newFiles.push({ id: uid(), file, lang, base });
  }

  if (newFiles.length === 0) return;

  state.files.push(...newFiles);
  renderFileChips();
  runAutoPairing();
}

function removeFile(id) {
  state.files = state.files.filter(f => f.id !== id);
  renderFileChips();
  runAutoPairing();
}

function clearAll() {
  state.files = [];
  state.pairs = [];
  state.unpaired = [];
  renderFileChips();
  renderPairs();
}

/* -------- Auto-pairing -------- */
function runAutoPairing() {
  // Build a pseudo fileList from state files
  const entries = state.files.map(f => ({
    ...f,
    base: f.base,
    lang: f.lang,
  }));

  // Group by base
  const groups = {};
  for (const entry of entries) {
    const key = entry.base.toLowerCase();
    if (!groups[key]) groups[key] = [];
    groups[key].push(entry);
  }

  const pairs = [];
  const unpaired = [];

  for (const [, items] of Object.entries(groups)) {
    if (items.length >= 2) {
      pairs.push({
        id: uid(),
        base: items[0].base,
        top: items[0],
        bottom: items[1],
        topOffset: 0,
        bottomOffset: 0,
        topCues: null,
        bottomCues: null,
        showPreview: false,
      });
      if (items.length > 2) unpaired.push(...items.slice(2));
    } else {
      unpaired.push(...items);
    }
  }

  state.pairs = pairs;
  state.unpaired = unpaired;
  renderPairs();
}

/* -------- Rendering: File Chips -------- */
function renderFileChips() {
  fileListEl.innerHTML = '';
  for (const entry of state.files) {
    const chip = document.createElement('div');
    chip.className = 'file-chip';
    chip.innerHTML = `
      <span>${entry.file.name}</span>
      ${entry.lang ? `<span class="file-chip__lang">${entry.lang.code}</span>` : ''}
      <button class="file-chip__remove" data-id="${entry.id}" title="Remove">✕</button>
    `;
    fileListEl.appendChild(chip);
  }

  // Show/hide sections
  if (state.files.length > 0) {
    pairsSection.classList.remove('hidden');
    mergeSection.classList.remove('hidden');
  } else {
    pairsSection.classList.add('hidden');
    mergeSection.classList.add('hidden');
  }
}

/* -------- Rendering: Pair Cards -------- */
function renderPairs() {
  pairsContainer.innerHTML = '';

  if (state.pairs.length === 0 && state.files.length > 0) {
    emptyState.classList.remove('hidden');
    emptyState.querySelector('.empty-state__text').textContent =
      'No pairs detected. Upload files with matching names and different language suffixes (e.g. Movie.en.srt & Movie.de.srt).';
    mergeBtn.disabled = true;
    downloadAllBtn.classList.add('hidden');
    return;
  } else if (state.pairs.length === 0) {
    emptyState.classList.remove('hidden');
    emptyState.querySelector('.empty-state__text').textContent =
      'Upload subtitle files to get started.';
    mergeBtn.disabled = true;
    downloadAllBtn.classList.add('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  mergeBtn.disabled = false;

  for (let pi = 0; pi < state.pairs.length; pi++) {
    const pair = state.pairs[pi];
    const card = document.createElement('div');
    card.className = 'pair-card';
    card.style.animationDelay = `${pi * 0.08}s`;

    const topLangLabel = pair.top.lang ? pair.top.lang.label : 'Unknown';
    const botLangLabel = pair.bottom.lang ? pair.bottom.lang.label : 'Unknown';
    const topLangCode = pair.top.lang ? pair.top.lang.code : '?';
    const botLangCode = pair.bottom.lang ? pair.bottom.lang.code : '?';

    card.innerHTML = `
      <div class="pair-card__header">
        <div class="pair-card__title">
          <span class="pair-icon">🔗</span>
          <span>${escapeHtml(pair.base)}</span>
        </div>
        <div class="pair-card__actions">
          <button class="btn btn--secondary btn--sm preview-toggle-btn" data-pair="${pi}">
            👁 Preview
          </button>
          <button class="btn btn--ghost btn--sm remove-pair-btn" data-pair="${pi}" title="Remove pair">
            ✕
          </button>
        </div>
      </div>

      <div class="pair-lane">
        <span class="pair-lane__label pair-lane__label--top">Top</span>
        <span class="pair-lane__file">${escapeHtml(pair.top.file.name)}</span>
        <span class="pair-lane__lang pair-lane__lang--top">${escapeHtml(topLangLabel)}</span>
      </div>

      <div class="pair-card__swap">
        <button class="btn btn--ghost btn--icon swap-btn" data-pair="${pi}" title="Swap top/bottom">⇅</button>
      </div>

      <div class="pair-lane">
        <span class="pair-lane__label pair-lane__label--bottom">Bottom</span>
        <span class="pair-lane__file">${escapeHtml(pair.bottom.file.name)}</span>
        <span class="pair-lane__lang pair-lane__lang--bottom">${escapeHtml(botLangLabel)}</span>
      </div>

      <div class="offset-control">
        <span class="offset-control__label">Top offset</span>
        <input type="range" min="-10000" max="10000" step="100" value="${pair.topOffset}" data-pair="${pi}" data-lane="top" class="offset-slider">
        <input type="number" value="${pair.topOffset}" data-pair="${pi}" data-lane="top" class="offset-number">
        <span class="offset-control__unit">ms</span>
      </div>

      <div class="offset-control">
        <span class="offset-control__label">Bottom offset</span>
        <input type="range" min="-10000" max="10000" step="100" value="${pair.bottomOffset}" data-pair="${pi}" data-lane="bottom" class="offset-slider">
        <input type="number" value="${pair.bottomOffset}" data-pair="${pi}" data-lane="bottom" class="offset-number">
        <span class="offset-control__unit">ms</span>
      </div>

      <div class="preview-container hidden" id="preview-${pi}">
        <table class="preview-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>${escapeHtml(topLangCode.toUpperCase())}</th>
              <th>${escapeHtml(botLangCode.toUpperCase())}</th>
            </tr>
          </thead>
          <tbody id="preview-body-${pi}"></tbody>
        </table>
      </div>
    `;

    pairsContainer.appendChild(card);
  }

  // Show unpaired files warning
  if (state.unpaired.length > 0) {
    const warning = document.createElement('div');
    warning.className = 'empty-state mt-md';
    warning.innerHTML = `
      <div class="empty-state__icon">⚠️</div>
      <p class="text-muted" style="font-size:0.9rem;">
        ${state.unpaired.length} file(s) could not be auto-paired:
        ${state.unpaired.map(u => `<strong>${escapeHtml(u.file.name)}</strong>`).join(', ')}
      </p>
    `;
    pairsContainer.appendChild(warning);
  }
}

/* -------- Preview -------- */
async function togglePreview(pairIdx) {
  const pair = state.pairs[pairIdx];
  if (!pair) return;

  const container = $(`#preview-${pairIdx}`);
  const btn = document.querySelector(`.preview-toggle-btn[data-pair="${pairIdx}"]`);

  if (pair.showPreview) {
    pair.showPreview = false;
    container.classList.add('hidden');
    btn.textContent = '👁 Preview';
    return;
  }

  // Parse if not yet done
  if (!pair.topCues) {
    try {
      const topText = await readFileAsText(pair.top.file);
      const { cues } = parseSubtitle(topText, pair.top.file.name);
      pair.topCues = cues;
    } catch (e) {
      showToast(`Error reading ${pair.top.file.name}`, 'error');
      return;
    }
  }

  if (!pair.bottomCues) {
    try {
      const botText = await readFileAsText(pair.bottom.file);
      const { cues } = parseSubtitle(botText, pair.bottom.file.name);
      pair.bottomCues = cues;
    } catch (e) {
      showToast(`Error reading ${pair.bottom.file.name}`, 'error');
      return;
    }
  }

  renderPreviewTable(pairIdx);
  pair.showPreview = true;
  container.classList.remove('hidden');
  btn.textContent = '👁 Hide';
}

function renderPreviewTable(pairIdx) {
  const pair = state.pairs[pairIdx];
  const tbody = $(`#preview-body-${pairIdx}`);
  if (!tbody || !pair.topCues || !pair.bottomCues) return;

  const topCues = applyCueOffset(pair.topCues, pair.topOffset);
  const bottomCues = applyCueOffset(pair.bottomCues, pair.bottomOffset);

  // Simple merge preview (show first 80 matched cues)
  const rows = [];
  const consumed = new Set();

  for (const tc of topCues) {
    let bestIdx = -1, bestOv = 0;
    for (let i = 0; i < bottomCues.length; i++) {
      if (consumed.has(i)) continue;
      const ov = Math.max(0, Math.min(tc.end, bottomCues[i].end) - Math.max(tc.start, bottomCues[i].start));
      if (ov > bestOv) { bestOv = ov; bestIdx = i; }
    }
    const minDur = Math.min(tc.end - tc.start, bestIdx >= 0 ? bottomCues[bestIdx].end - bottomCues[bestIdx].start : Infinity);
    const threshold = Math.min(100, minDur * 0.2);

    if (bestIdx >= 0 && bestOv >= threshold) {
      consumed.add(bestIdx);
      rows.push({ start: Math.min(tc.start, bottomCues[bestIdx].start), topText: tc.text, botText: bottomCues[bestIdx].text });
    } else {
      rows.push({ start: tc.start, topText: tc.text, botText: '' });
    }
  }

  // Add unmatched bottom cues
  for (let i = 0; i < bottomCues.length; i++) {
    if (!consumed.has(i)) {
      rows.push({ start: bottomCues[i].start, topText: '', botText: bottomCues[i].text });
    }
  }

  rows.sort((a, b) => a.start - b.start);
  const display = rows.slice(0, 80);

  tbody.innerHTML = display.map(r => `
    <tr>
      <td class="time-cell">${formatTimeShort(r.start)}</td>
      <td class="text-cell--top">${escapeHtml(r.topText).replace(/\n/g, '<br>')}</td>
      <td class="text-cell--bottom">${escapeHtml(r.botText).replace(/\n/g, '<br>')}</td>
    </tr>
  `).join('');

  if (rows.length > 80) {
    tbody.innerHTML += `<tr><td colspan="3" class="text-muted" style="text-align:center;padding:8px;">… and ${rows.length - 80} more cues</td></tr>`;
  }
}

/* -------- Merge -------- */
let mergedResults = []; // store for download

async function doMerge() {
  if (state.pairs.length === 0) return;

  mergeBtn.disabled = true;
  mergeBtnText.textContent = 'Merging…';

  mergedResults = [];

  try {
    for (const pair of state.pairs) {
      // Parse if needed
      if (!pair.topCues) {
        const topText = await readFileAsText(pair.top.file);
        pair.topCues = parseSubtitle(topText, pair.top.file.name).cues;
      }
      if (!pair.bottomCues) {
        const botText = await readFileAsText(pair.bottom.file);
        pair.bottomCues = parseSubtitle(botText, pair.bottom.file.name).cues;
      }

      const topCues = applyCueOffset(pair.topCues, pair.topOffset);
      const botCues = applyCueOffset(pair.bottomCues, pair.bottomOffset);

      const merged = mergeCues(topCues, botCues, {
        separator: '\n',
        topItalic: topItalicCheckbox?.checked || false,
        bottomItalic: bottomItalicCheckbox?.checked || false,
      });

      const format = outputFormat.value;
      const output = format === 'vtt' ? serializeToVTT(merged) : serializeToSRT(merged);
      const ext = format === 'vtt' ? '.vtt' : '.srt';

      const topCode = pair.top.lang ? pair.top.lang.code : '';
      const botCode = pair.bottom.lang ? pair.bottom.lang.code : '';
      const langSuffix = topCode && botCode ? `.${topCode}-${botCode}` : '.dual';
      const filename = `${pair.base}${langSuffix}${ext}`;

      mergedResults.push({ filename, content: output });
    }

    showToast(`Merged ${mergedResults.length} pair(s) successfully!`, 'success');
    downloadAllBtn.classList.remove('hidden');

    // Auto-download if single pair
    if (mergedResults.length === 1) {
      downloadFile(mergedResults[0].filename, mergedResults[0].content);
    }

  } catch (e) {
    console.error(e);
    showToast(`Merge failed: ${e.message}`, 'error');
  } finally {
    mergeBtn.disabled = false;
    mergeBtnText.textContent = 'Merge & Download';
  }
}

/* -------- Downloads -------- */
function downloadFile(name, content) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 100);
}

async function downloadAllAsZip() {
  if (mergedResults.length === 0) return;

  if (mergedResults.length === 1) {
    downloadFile(mergedResults[0].filename, mergedResults[0].content);
    return;
  }

  // Use JSZip if available
  if (typeof JSZip !== 'undefined') {
    const zip = new JSZip();
    for (const r of mergedResults) {
      zip.file(r.filename, r.content);
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'merged_subtitles.zip';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 100);
  } else {
    // Fallback: download individually
    for (const r of mergedResults) {
      downloadFile(r.filename, r.content);
    }
  }
}

/* -------- Helpers -------- */
function escapeHtml(str) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return str.replace(/[&<>"']/g, c => map[c]);
}

function formatTimeShort(ms) {
  const m = String(Math.floor(ms / 60000)).padStart(2, '0');
  const s = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0');
  const mil = String(Math.floor(ms % 1000)).padStart(3, '0');
  return `${m}:${s}.${mil}`;
}

/* -------- Event Wiring -------- */
function init() {
  // Drag & drop
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dropzone--active');
  });
  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dropzone--active');
  });
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dropzone--active');
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  });

  // File input
  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
      handleFiles(fileInput.files);
      fileInput.value = ''; // reset so same files can be re-added
    }
  });

  // File chip remove buttons (delegated)
  fileListEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.file-chip__remove');
    if (btn) removeFile(btn.dataset.id);
  });

  // Pair card actions (delegated)
  pairsContainer.addEventListener('click', (e) => {
    const previewBtn = e.target.closest('.preview-toggle-btn');
    if (previewBtn) {
      togglePreview(parseInt(previewBtn.dataset.pair));
      return;
    }

    const swapBtn = e.target.closest('.swap-btn');
    if (swapBtn) {
      const idx = parseInt(swapBtn.dataset.pair);
      const pair = state.pairs[idx];
      if (pair) {
        const temp = pair.top;
        pair.top = pair.bottom;
        pair.bottom = temp;
        const tempCues = pair.topCues;
        pair.topCues = pair.bottomCues;
        pair.bottomCues = tempCues;
        const tempOff = pair.topOffset;
        pair.topOffset = pair.bottomOffset;
        pair.bottomOffset = tempOff;
        renderPairs();
        showToast('Swapped top/bottom', 'info');
      }
      return;
    }

    const removeBtn = e.target.closest('.remove-pair-btn');
    if (removeBtn) {
      const idx = parseInt(removeBtn.dataset.pair);
      state.pairs.splice(idx, 1);
      renderPairs();
      return;
    }
  });

  // Offset sliders & number inputs (delegated)
  pairsContainer.addEventListener('input', (e) => {
    const slider = e.target.closest('.offset-slider');
    const numInput = e.target.closest('.offset-number');

    if (slider) {
      const idx = parseInt(slider.dataset.pair);
      const lane = slider.dataset.lane;
      const val = parseInt(slider.value);
      if (lane === 'top') state.pairs[idx].topOffset = val;
      else state.pairs[idx].bottomOffset = val;
      // Sync number input
      const numEl = pairsContainer.querySelector(`.offset-number[data-pair="${idx}"][data-lane="${lane}"]`);
      if (numEl) numEl.value = val;
      // Refresh preview if open
      if (state.pairs[idx].showPreview) renderPreviewTable(idx);
    }

    if (numInput) {
      const idx = parseInt(numInput.dataset.pair);
      const lane = numInput.dataset.lane;
      const val = parseInt(numInput.value) || 0;
      if (lane === 'top') state.pairs[idx].topOffset = val;
      else state.pairs[idx].bottomOffset = val;
      // Sync slider
      const sliderEl = pairsContainer.querySelector(`.offset-slider[data-pair="${idx}"][data-lane="${lane}"]`);
      if (sliderEl) sliderEl.value = val;
      // Refresh preview if open
      if (state.pairs[idx].showPreview) renderPreviewTable(idx);
    }
  });

  // Merge button
  mergeBtn.addEventListener('click', doMerge);

  // Download all
  downloadAllBtn.addEventListener('click', downloadAllAsZip);

  // Clear
  clearBtn.addEventListener('click', () => {
    clearAll();
    showToast('All files cleared', 'info');
  });
}

document.addEventListener('DOMContentLoaded', init);
