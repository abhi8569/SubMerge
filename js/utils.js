/* ============================================================
   SubtitleMerge — Utilities
   Language detection, auto-pairing, helpers
   ============================================================ */

/**
 * ISO 639-1/2 code → human-readable name.
 * Covers the most common subtitle languages.
 */
export const LANG_MAP = {
  af: 'Afrikaans', am: 'Amharic', ar: 'Arabic', az: 'Azerbaijani',
  be: 'Belarusian', bg: 'Bulgarian', bn: 'Bengali', bs: 'Bosnian',
  ca: 'Catalan', cs: 'Czech', cy: 'Welsh', da: 'Danish',
  de: 'German', el: 'Greek', en: 'English', eng: 'English',
  es: 'Spanish', et: 'Estonian', eu: 'Basque', fa: 'Persian',
  fi: 'Finnish', fil: 'Filipino', fr: 'French', fre: 'French',
  ga: 'Irish', gl: 'Galician', gu: 'Gujarati', ha: 'Hausa',
  he: 'Hebrew', hi: 'Hindi', hr: 'Croatian', hu: 'Hungarian',
  hy: 'Armenian', id: 'Indonesian', is: 'Icelandic', it: 'Italian',
  ja: 'Japanese', jpn: 'Japanese', jv: 'Javanese', ka: 'Georgian',
  kk: 'Kazakh', km: 'Khmer', kn: 'Kannada', ko: 'Korean',
  kor: 'Korean', ku: 'Kurdish', ky: 'Kyrgyz', la: 'Latin',
  lb: 'Luxembourgish', lo: 'Lao', lt: 'Lithuanian', lv: 'Latvian',
  mg: 'Malagasy', mk: 'Macedonian', ml: 'Malayalam', mn: 'Mongolian',
  mr: 'Marathi', ms: 'Malay', mt: 'Maltese', my: 'Burmese',
  nb: 'Norwegian Bokmål', ne: 'Nepali', nl: 'Dutch', no: 'Norwegian',
  or: 'Odia', pa: 'Punjabi', pl: 'Polish', por: 'Portuguese',
  ps: 'Pashto', pt: 'Portuguese', 'pt-br': 'Portuguese (Brazil)',
  ro: 'Romanian', ru: 'Russian', rw: 'Kinyarwanda', sd: 'Sindhi',
  si: 'Sinhala', sk: 'Slovak', sl: 'Slovenian', so: 'Somali',
  sq: 'Albanian', sr: 'Serbian', su: 'Sundanese', sv: 'Swedish',
  sw: 'Swahili', ta: 'Tamil', te: 'Telugu', tg: 'Tajik',
  th: 'Thai', tk: 'Turkmen', tl: 'Tagalog', tr: 'Turkish',
  uk: 'Ukrainian', ur: 'Urdu', uz: 'Uzbek', vi: 'Vietnamese',
  xh: 'Xhosa', yo: 'Yoruba', 'zh-hk': 'Cantonese',
  zh: 'Chinese', 'zh-cn': 'Chinese (Simplified)', 'zh-tw': 'Chinese (Traditional)',
  zu: 'Zulu',
  /* Full-word aliases */
  english: 'English', german: 'German', french: 'French', spanish: 'Spanish',
  italian: 'Italian', portuguese: 'Portuguese', russian: 'Russian',
  japanese: 'Japanese', korean: 'Korean', chinese: 'Chinese',
  arabic: 'Arabic', hindi: 'Hindi', turkish: 'Turkish', dutch: 'Dutch',
  polish: 'Polish', swedish: 'Swedish', norwegian: 'Norwegian',
  danish: 'Danish', finnish: 'Finnish', czech: 'Czech', greek: 'Greek',
  hungarian: 'Hungarian', romanian: 'Romanian', thai: 'Thai',
  vietnamese: 'Vietnamese', indonesian: 'Indonesian', malay: 'Malay',
  tamil: 'Tamil', telugu: 'Telugu', bengali: 'Bengali',
};

/**
 * Regex to capture a language suffix from a subtitle filename.
 * Matches patterns like:
 *   Movie.en.srt  |  Movie.eng.srt  |  Movie_english.srt
 *   Movie.zh-CN.srt  |  Movie.pt-br.vtt
 */
const LANG_SUFFIX_RE = /[._-]([a-z]{2,3}(?:-[a-z]{2,4})?)\.(?:srt|vtt|ass|ssa|sub)$/i;
const FULL_WORD_LANG_RE = /[._-](english|german|french|spanish|italian|portuguese|russian|japanese|korean|chinese|arabic|hindi|turkish|dutch|polish|swedish|norwegian|danish|finnish|czech|greek|hungarian|romanian|thai|vietnamese|indonesian|malay|tamil|telugu|bengali)\.(?:srt|vtt|ass|ssa|sub)$/i;

/**
 * Extract the language code from a filename.
 * Returns { code, label } or null.
 */
export function detectLanguage(filename) {
  // Try full word first (e.g. "_english.srt")
  let m = filename.match(FULL_WORD_LANG_RE);
  if (m) {
    const key = m[1].toLowerCase();
    return { code: key, label: LANG_MAP[key] || key };
  }
  // Then ISO code (e.g. ".en.srt", ".zh-CN.srt")
  m = filename.match(LANG_SUFFIX_RE);
  if (m) {
    const key = m[1].toLowerCase();
    if (LANG_MAP[key]) {
      return { code: key, label: LANG_MAP[key] };
    }
  }
  return null;
}

/**
 * Extract the base name from a subtitle filename (strip language suffix + extension).
 * e.g.  "Movie.S01E03.en.srt" → "Movie.S01E03"
 */
export function baseName(filename) {
  return filename
    .replace(FULL_WORD_LANG_RE, '')
    .replace(LANG_SUFFIX_RE, '')
    .replace(/\.(?:srt|vtt|ass|ssa|sub)$/i, '')
    .replace(/[._-]+$/, '');
}

/**
 * Auto-pair files by base name.
 * Returns an array of { base, files: [FileEntry, FileEntry] }.
 * Each FileEntry = { file: File, lang: { code, label } | null }.
 */
export function autoPairFiles(fileList) {
  const entries = Array.from(fileList).map(file => ({
    file,
    lang: detectLanguage(file.name),
    base: baseName(file.name),
  }));

  // Group by base name
  const groups = {};
  for (const entry of entries) {
    const key = entry.base.toLowerCase();
    if (!groups[key]) groups[key] = [];
    groups[key].push(entry);
  }

  const pairs = [];
  const unpaired = [];

  for (const [base, items] of Object.entries(groups)) {
    if (items.length === 2) {
      pairs.push({
        base: items[0].base,
        top: items[0],
        bottom: items[1],
      });
    } else if (items.length > 2) {
      // For groups larger than 2, pair first two and leave rest unpaired
      pairs.push({
        base: items[0].base,
        top: items[0],
        bottom: items[1],
      });
      unpaired.push(...items.slice(2));
    } else {
      unpaired.push(...items);
    }
  }

  return { pairs, unpaired };
}

/**
 * Read a File as text, returning a Promise<string>.
 */
export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsText(file);
  });
}

/**
 * Format milliseconds as SRT timestamp: HH:MM:SS,mmm
 */
export function msToSrtTime(ms) {
  const sign = ms < 0 ? '-' : '';
  ms = Math.abs(ms);
  const h = String(Math.floor(ms / 3600000)).padStart(2, '0');
  const m = String(Math.floor((ms % 3600000) / 60000)).padStart(2, '0');
  const s = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0');
  const mil = String(ms % 1000).padStart(3, '0');
  return `${sign}${h}:${m}:${s},${mil}`;
}

/**
 * Format milliseconds as VTT timestamp: HH:MM:SS.mmm
 */
export function msToVttTime(ms) {
  return msToSrtTime(ms).replace(',', '.');
}

/**
 * Generate a short unique ID.
 */
export function uid() {
  return Math.random().toString(36).slice(2, 10);
}
