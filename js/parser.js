/* ============================================================
   SubtitleMerge — Subtitle Parser
   Parse & serialize SRT and VTT formats
   ============================================================ */

import { msToSrtTime, msToVttTime } from './utils.js';

/* ---- Time parsing helpers ---- */

/**
 * Parse a timestamp string (SRT or VTT) into milliseconds.
 * Supports:  "00:01:23,456"  "00:01:23.456"  "01:23.456"
 */
function parseTimestamp(str) {
  str = str.trim().replace(',', '.');
  const parts = str.split(':');
  let h = 0, m = 0, rest = '0.0';

  if (parts.length === 3) {
    h = parseInt(parts[0], 10);
    m = parseInt(parts[1], 10);
    rest = parts[2];
  } else if (parts.length === 2) {
    m = parseInt(parts[0], 10);
    rest = parts[1];
  } else {
    rest = parts[0];
  }

  const [sec, mil = '0'] = rest.split('.');
  return (
    h * 3600000 +
    m * 60000 +
    parseInt(sec, 10) * 1000 +
    parseInt(mil.padEnd(3, '0').slice(0, 3), 10)
  );
}

/* ---- SRT Parser ---- */

/**
 * Parse SRT text into an array of cue objects.
 * Each cue: { index: number, start: ms, end: ms, text: string }
 */
export function parseSRT(text) {
  const cues = [];
  // Normalize line endings
  const blocks = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim()
    .split(/\n\s*\n/);

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 2) continue;

    // Find the timestamp line (may or may not have an index line before it)
    let timeLineIdx = 0;
    if (/-->/.test(lines[0])) {
      timeLineIdx = 0;
    } else if (lines.length >= 2 && /-->/.test(lines[1])) {
      timeLineIdx = 1;
    } else {
      continue; // Can't find timestamp
    }

    const timeLine = lines[timeLineIdx];
    const timeParts = timeLine.split('-->');
    if (timeParts.length !== 2) continue;

    const start = parseTimestamp(timeParts[0]);
    // Strip positioning info after the end time (e.g. "X1:100 X2:200")
    const endRaw = timeParts[1].trim().split(/\s+/)[0];
    const end = parseTimestamp(endRaw);

    const textLines = lines.slice(timeLineIdx + 1);
    const text = textLines.join('\n').trim();

    if (text) {
      cues.push({
        index: cues.length + 1,
        start,
        end,
        text,
      });
    }
  }

  return cues;
}

/* ---- VTT Parser ---- */

/**
 * Parse WebVTT text into an array of cue objects.
 * Each cue: { index: number, start: ms, end: ms, text: string }
 */
export function parseVTT(text) {
  const cues = [];
  const normalized = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();

  // Remove WEBVTT header and any metadata/style blocks
  let body = normalized;
  const headerEnd = body.indexOf('\n\n');
  if (headerEnd !== -1) {
    body = body.slice(headerEnd + 2);
  }

  // Remove STYLE and NOTE blocks
  body = body.replace(/^(STYLE|NOTE)\b[\s\S]*?(?=\n\n|$)/gm, '');

  const blocks = body.trim().split(/\n\s*\n/);

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 1) continue;

    // Find the line with "-->"
    let timeLineIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (/-->/.test(lines[i])) {
        timeLineIdx = i;
        break;
      }
    }
    if (timeLineIdx === -1) continue;

    const timeLine = lines[timeLineIdx];
    const timeParts = timeLine.split('-->');
    if (timeParts.length !== 2) continue;

    const start = parseTimestamp(timeParts[0]);
    // VTT can have position/alignment after end time
    const endRaw = timeParts[1].trim().split(/\s+/)[0];
    const end = parseTimestamp(endRaw);

    const textLines = lines.slice(timeLineIdx + 1);
    const cueText = textLines.join('\n').trim();

    if (cueText) {
      cues.push({
        index: cues.length + 1,
        start,
        end,
        text: cueText,
      });
    }
  }

  return cues;
}

/* ---- Auto-detect format and parse ---- */

/**
 * Detect format from filename or content and parse.
 * Returns { format: 'srt'|'vtt', cues: [...] }
 */
export function parseSubtitle(text, filename = '') {
  const ext = filename.split('.').pop().toLowerCase();
  if (ext === 'vtt' || text.trim().startsWith('WEBVTT')) {
    return { format: 'vtt', cues: parseVTT(text) };
  }
  return { format: 'srt', cues: parseSRT(text) };
}

/* ---- Serializers ---- */

/**
 * Serialize cues array to SRT string.
 */
export function serializeToSRT(cues) {
  return cues
    .map((cue, i) => {
      const idx = i + 1;
      const start = msToSrtTime(cue.start);
      const end = msToSrtTime(cue.end);
      return `${idx}\n${start} --> ${end}\n${cue.text}`;
    })
    .join('\n\n') + '\n';
}

/**
 * Serialize cues array to VTT string.
 */
export function serializeToVTT(cues) {
  const header = 'WEBVTT\n\n';
  const body = cues
    .map((cue, i) => {
      const idx = i + 1;
      const start = msToVttTime(cue.start);
      const end = msToVttTime(cue.end);
      return `${idx}\n${start} --> ${end}\n${cue.text}`;
    })
    .join('\n\n') + '\n';
  return header + body;
}
