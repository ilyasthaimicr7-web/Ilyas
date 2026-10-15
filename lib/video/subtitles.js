/*  Horror Studio AI — Subtitle Generator
 *  Generates SRT subtitle files synchronized with TTS audio durations.
 */

function formatSrtTime(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return hrs.toString().padStart(2, '0') + ':' +
    mins.toString().padStart(2, '0') + ':' +
    secs.toString().padStart(2, '0') + ',' +
    ms.toString().padStart(3, '0');
}

function generateSrt(scenes, audioDurations) {
  const lines = [];
  let index = 1;
  let currentTime = 0;

  scenes.forEach((scene, i) => {
    const duration = audioDurations[i] || scene.duration || 10;
    const start = currentTime;
    const end = currentTime + duration;

    // Split narration into subtitle-sized chunks (max 2 lines)
    const chunks = splitTextForSubtitles(scene.narration);

    chunks.forEach((chunk) => {
      const chunkDuration = duration / chunks.length;
      lines.push(String(index));
      lines.push(formatSrtTime(start + (index - 1) * chunkDuration / chunks.length) + ' --> ' + formatSrtTime(start + index * chunkDuration / chunks.length));
      lines.push(chunk);
      lines.push('');
      index++;
    });

    currentTime = end;
  });

  return lines.join('\n').trim();
}

function splitTextForSubtitles(text, maxLineLength) {
  maxLineLength = maxLineLength || 42;
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const chunks = [];
  let currentChunk = '';

  sentences.forEach((sentence) => {
    const trimmed = sentence.trim() + '.';
    if ((currentChunk + ' ' + trimmed).length <= maxLineLength * 2) {
      currentChunk = currentChunk ? currentChunk + ' ' + trimmed : trimmed;
    } else {
      if (currentChunk) chunks.push(currentChunk);
      currentChunk = trimmed;
    }
  });

  if (currentChunk) chunks.push(currentChunk);
  return chunks.length > 0 ? chunks : [text];
}

module.exports = { generateSrt, formatSrtTime };
