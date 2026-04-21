/* ============================================================
   SubtitleMerge — Merge Engine
   Matches cues by time overlap and merges dual-language tracks
   ============================================================ */

/**
 * Compute overlap in ms between two time ranges.
 */
function overlap(s1, e1, s2, e2) {
  const start = Math.max(s1, s2);
  const end = Math.min(e1, e2);
  return Math.max(0, end - start);
}

/**
 * Apply a millisecond offset to all cues (returns new array).
 */
export function applyCueOffset(cues, offsetMs) {
  if (offsetMs === 0) return cues;
  return cues.map(c => ({
    ...c,
    start: Math.max(0, c.start + offsetMs),
    end: Math.max(0, c.end + offsetMs),
  }));
}

/**
 * Merge two subtitle cue arrays into a single dual-language track.
 *
 * @param {Array} topCues    — Primary language cues (displayed first)
 * @param {Array} bottomCues — Secondary language cues (displayed second)
 * @param {Object} options
 * @param {string} options.separator — Text between top & bottom lines (default: "\n")
 * @param {boolean} options.topItalic — Wrap top text in <i> tags
 * @param {boolean} options.bottomItalic — Wrap bottom text in <i> tags
 * @returns {Array} merged cues sorted by start time
 */
export function mergeCues(topCues, bottomCues, options = {}) {
  const {
    separator = '\n',
    topItalic = false,
    bottomItalic = false,
  } = options;

  const merged = [];
  const consumed = new Set(); // indices of consumed bottom cues

  // For each top cue, find best-matching bottom cue by overlap
  for (const topCue of topCues) {
    let bestIdx = -1;
    let bestOverlap = 0;

    for (let i = 0; i < bottomCues.length; i++) {
      if (consumed.has(i)) continue;

      const ov = overlap(topCue.start, topCue.end, bottomCues[i].start, bottomCues[i].end);
      if (ov > bestOverlap) {
        bestOverlap = ov;
        bestIdx = i;
      }
    }

    // Require at least 100ms overlap or 20% of shorter cue to count as a match
    const minDuration = Math.min(
      topCue.end - topCue.start,
      bestIdx >= 0 ? bottomCues[bestIdx].end - bottomCues[bestIdx].start : Infinity
    );
    const threshold = Math.min(100, minDuration * 0.2);

    if (bestIdx >= 0 && bestOverlap >= threshold) {
      const botCue = bottomCues[bestIdx];
      consumed.add(bestIdx);

      const topText = topItalic ? `<i>${topCue.text}</i>` : topCue.text;
      const botText = bottomItalic ? `<i>${botCue.text}</i>` : botCue.text;

      // Use the top (primary) cue's timing as anchor to prevent
      // extended durations that cause adjacent cues to overlap
      merged.push({
        start: topCue.start,
        end: topCue.end,
        text: `${topText}${separator}${botText}`,
      });
    } else {
      // No match — keep top cue as-is
      const topText = topItalic ? `<i>${topCue.text}</i>` : topCue.text;
      merged.push({
        start: topCue.start,
        end: topCue.end,
        text: topText,
      });
    }
  }

  // Append unconsumed bottom cues
  for (let i = 0; i < bottomCues.length; i++) {
    if (consumed.has(i)) continue;
    const botText = bottomItalic ? `<i>${bottomCues[i].text}</i>` : bottomCues[i].text;
    merged.push({
      start: bottomCues[i].start,
      end: bottomCues[i].end,
      text: botText,
    });
  }

  // Sort by start time, then by end time for ties
  merged.sort((a, b) => a.start - b.start || a.end - b.end);

  // Post-process: resolve overlapping cues so they don't stack on screen.
  // If cue N's end extends past cue N+1's start, clamp it.
  for (let i = 0; i < merged.length - 1; i++) {
    if (merged[i].end > merged[i + 1].start) {
      merged[i].end = merged[i + 1].start - 1;
    }
  }

  // Re-index
  merged.forEach((c, i) => (c.index = i + 1));

  return merged;
}
