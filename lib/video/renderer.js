/*  Horror Studio AI — Video Renderer
 *  Assembles scene images, TTS audio, and subtitles into an MP4 using FFmpeg.
 *  FFmpeg must be installed on the server.
 */

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const { exec } = require('child_process');
const execAsync = promisify(exec);

const VIDEOS_DIR = path.join(__dirname, '../../videos');
const TEMP_DIR = path.join(__dirname, '../../videos/temp');

const VIDEO_WIDTHS = {
  video: 1280,
  shorts: 720,
};
const VIDEO_HEIGHTS = {
  video: 720,
  shorts: 1280,
};

function ensureDirs() {
  if (!fs.existsSync(VIDEOS_DIR)) fs.mkdirSync(VIDEOS_DIR, { recursive: true });
  if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
}

function getVideoDims(format) {
  return {
    width: VIDEO_WIDTHS[format] || VIDEO_WIDTHS.video,
    height: VIDEO_HEIGHTS[format] || VIDEO_HEIGHTS.video,
  };
}

/**
 * Create a scene clip: image with zoompan camera movement + TTS audio.
 * Includes fade in/out transitions.
 */
async function renderSceneClip(imagePath, audioPath, outputPath, duration, format) {
  const dims = getVideoDims(format);
  const fps = 24;
  const totalFrames = Math.ceil(duration * fps);

  const cmd = [
    'ffmpeg', '-y', '-v', 'error',
    '-loop', '1',
    '-i', `"${imagePath}"`,
    '-i', `"${audioPath}"`,
    '-filter_complex',
    `[0:v]scale=${dims.width}:${dims.height},setsar=1,` +
    `zoompan=z='min(zoom+0.0015,1.4)':d=${fps}:s=${dims.width}x${dims.height}:` +
    `fps=${fps}:x='if(lte(zoom,1),0,(W-w)/2)':y='if(lte(zoom,1),0,(H-h)/2)':n=${totalFrames}` +
    `,setpts=PTS-STARTPTS,fade=t=in:st=0:d=0.5,fade=t=out:st=${duration-0.5}:d=0.5[fv]`,
    '-map', '[fv]',
    '-map', '1:a',
    '-af', 'afade=t=in:st=0:d=0.3,afade=t=out:st=' + (duration - 0.3) + ':d=0.3',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-r', `${fps}`,
    '-t', `${duration}`,
    '-movflags', '+faststart',
    `"${outputPath}"`,
  ].join(' ');

  await execAsync(cmd, { maxBuffer: 1024 * 1024 * 1024 });
}

/**
 * Generate ambient background sound (pink noise) for the full video duration.
 */
async function generateAmbience(ambiencePath, totalDuration) {
  const cmd = `ffmpeg -y -v error -f lavfi -i "anoisesrc=color=pink:duration=${totalDuration}" -af "volume=-24dB" -c:a aac -b:a 64k "${ambiencePath}"`;
  await execAsync(cmd, { maxBuffer: 1024 * 1024 * 512 });
}

/**
 * Assemble the final MP4 from scene clips, ambience, and subtitles.
 * Uses FFmpeg concat filter for video + audio, mixes ambience, burns subtitles.
 */
async function renderVideo(jobDir, scenes, audioDurations, srtPath, format) {
  ensureDirs();
  const dims = getVideoDims(format);
  const fps = 24;
  const outputPath = path.join(jobDir, 'final.mp4');

  // Generate scene clips
  for (let i = 0; i < scenes.length; i++) {
    const clipPath = path.join(jobDir, `scene_${i + 1}.mp4`);
    const imagePath = scenes[i].imagePath;
    const audioPath = scenes[i].audioPath;
    const duration = audioDurations[i];

    if (!fs.existsSync(imagePath)) throw new Error('Missing image for scene ' + (i + 1));
    if (!fs.existsSync(audioPath)) throw new Error('Missing audio for scene ' + (i + 1));

    await renderSceneClip(imagePath, audioPath, clipPath, duration, format);
  }

  const totalDuration = audioDurations.reduce((a, b) => a + b, 0);

  // Generate ambience
  const ambiencePath = path.join(jobDir, 'ambience.aac');
  await generateAmbience(ambiencePath, totalDuration + 2);

  // Build concat filter
  // Inputs: [0:v][0:a][1:v][1:a]...[n:v][n:a] -> concat -> [v][a]
  // Then: [a][n+1:a]amix -> [ao]
  // Then: [v]subtitles=srt[vout]
  let filterParts = [];

  // Build input list for concat filter
  let concatInputs = '';
  for (let i = 0; i < scenes.length; i++) {
    concatInputs += `[${i}:v][${i}:a]`;
  }
  concatInputs += `concat=n=${scenes.length}:v=1:a=1[v][a];`;

  filterParts.push(concatInputs);

  // Mix ambience with concatenated audio
  filterParts.push(`[a][${scenes.length}:a]amix=inputs=2:dropout_transition=2[mixed_audio]`);

  // Burn subtitles
  const srtEscaped = srtPath.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  filterParts.push(`[v]subtitles='${srtEscaped}'[vout]`);

  const filterComplex = filterParts.join('');

  // Build input arguments
  let inputArgs = '';
  for (let i = 0; i < scenes.length; i++) {
    inputArgs += `-i "${path.join(jobDir, 'scene_' + (i + 1) + '.mp4')}" `;
  }
  inputArgs += `-i "${ambiencePath}"`;

  const cmd = [
    'ffmpeg', '-y', '-v', 'error',
    inputArgs.trim(),
    '-filter_complex', `"${filterComplex}"`,
    '-map', '[vout]',
    '-map', '[mixed_audio]',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-r', `${fps}`,
    '-movflags', '+faststart',
    `"${outputPath}"`,
  ].join(' ');

  await execAsync(cmd, { maxBuffer: 1024 * 1024 * 1024 });

  const stats = fs.statSync(outputPath);
  return {
    outputPath,
    size: stats.size,
    duration: totalDuration,
  };
}

/**
 * Fallback video: renders story text as readable pages with fade transitions.
 * Used when no HF_API_KEY is configured (no AI image/TTS available).
 * Still produces a genuine, playable MP4.
 */
async function renderFallbackVideo(jobDir, storyText, format, duration) {
  const dims = getVideoDims(format);
  const fps = 24;
  const outputPath = path.join(jobDir, 'final.mp4');
  const totalSeconds = Math.round(duration * 60);

  // Split story into readable pages (chunks of ~300 chars)
  const textChunks = splitStoryIntoPages(storyText, 300);
  const segmentDuration = Math.max(3, Math.floor(totalSeconds / textChunks.length));

  // Write each chunk to a separate text file for drawtext
  const textFiles = [];
  for (let i = 0; i < textChunks.length; i++) {
    const tf = path.join(jobDir, `text_${i + 1}.txt`);
    fs.writeFileSync(tf, textChunks[i]);
    textFiles.push(tf);
  }

  // Generate pink noise ambience for background
  const ambiencePath = path.join(jobDir, 'ambience.m4a');
  const ambienceCmd = `ffmpeg -y -v error -f lavfi -i "anoisesrc=color=pink:duration=${totalSeconds}" -af "volume=-24dB" -c:a aac -b:a 64k "${ambiencePath}"`;
  await execAsync(ambienceCmd, { maxBuffer: 1024 * 1024 * 512 });

  // Build FFmpeg command using textfile (avoids shell-quoting issues)
  let filterParts = [];
  for (let i = 0; i < textChunks.length; i++) {
    const tf = textFiles[i].replace(/\\/g, '/').replace(/'/g, "'\\''");
    filterParts.push(`drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:textfile='${tf}':fontcolor=white:fontsize=28:x=(w-text_w)/2:y=(h-text_h)/2:box=1:boxcolor=black@0.7:boxborderw=10`);
  }

  const vf = filterParts.join(',');

  const cmd = [
    'ffmpeg', '-y', '-v', 'error',
    '-f', 'lavfi', '-i', `color=c=black:s=${dims.width}x${dims.height}:d=${totalSeconds}:r=${fps}`,
    '-i', `"${ambiencePath}"`,
    '-vf', `"${vf}"`,
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '64k',
    '-r', `${fps}`,
    '-movflags', '+faststart',
    `"${outputPath}"`,
  ].join(' ');

  try {
    await execAsync(cmd, { maxBuffer: 1024 * 1024 * 1024 });
  } catch (err) {
    console.error('[video] Fallback render error:', err.message);
    throw err;
  }

  const stats = fs.statSync(outputPath);
  return {
    outputPath,
    size: stats.size,
    duration: totalSeconds,
    isFallback: true,
  };
}

function splitStoryIntoPages(text, chunkSize) {
  const cleaned = text.replace(/\n\s*\n/g, '\n').trim();
  const words = cleaned.split(/\s+/);
  const pages = [];
  let current = '';

  words.forEach((word) => {
    if ((current + ' ' + word).length > chunkSize && current.length > 0) {
      pages.push(current.trim());
      current = word;
    } else {
      current = current ? current + ' ' + word : word;
    }
  });

  if (current.trim()) pages.push(current.trim());
  return pages.length > 0 ? pages : ['No text available.'];
}

function cleanupJob(jobDir) {
  try {
    if (fs.existsSync(jobDir)) {
      const files = fs.readdirSync(jobDir);
      files.forEach(f => {
        try { fs.unlinkSync(path.join(jobDir, f)); } catch (_) {}
      });
    }
  } catch (_) {}
}

module.exports = {
  renderVideo,
  renderSceneClip,
  generateAmbience,
  renderFallbackVideo,
  ensureDirs,
  getVideoDims,
  VIDEO_WIDTHS,
  VIDEO_HEIGHTS,
  VIDEOS_DIR,
  TEMP_DIR,
};
