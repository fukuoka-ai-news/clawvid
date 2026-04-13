import { falRequest, downloadFile } from './client.js';
import type { TTSConfig } from '../schemas/workflow.js';
import type { FalQwenTTSOutput } from './types.js';
import { createLogger } from '../utils/logger.js';
import { writeFile } from 'node:fs/promises';

const log = createLogger('fal-audio');

interface FalTranscriptionOutput {
  text: string;
  chunks?: Array<{
    text: string;
    timestamp: [number, number];
  }>;
}

const VOICEVOX_BASE_URL = process.env.VOICEVOX_URL ?? 'http://localhost:50021';

interface VoicevoxMora {
  text: string;
  consonant?: string;
  consonant_length?: number;
  vowel: string;
  vowel_length: number;
  pitch: number;
}

interface VoicevoxAccentPhrase {
  moras: VoicevoxMora[];
  accent: number;
  pause_mora?: VoicevoxMora | null;
}

interface VoicevoxAudioQuery {
  accent_phrases: VoicevoxAccentPhrase[];
  speedScale: number;
  prePhonemeLength: number;
  postPhonemeLength: number;
  [key: string]: unknown;
}

export interface VoicevoxWordTiming {
  text: string;
  start: number;
  end: number;
}

/**
 * Extract word-level timing from VOICEVOX audio_query response.
 * Groups accent phrases by pause_mora boundaries, then maps to original text
 * segments split by punctuation. This avoids katakana mora text leaking into subtitles.
 */
function extractVoicevoxTimings(
  query: VoicevoxAudioQuery,
  originalText: string,
): VoicevoxWordTiming[] {
  let currentTime = query.prePhonemeLength;

  // 1. Calculate timing for each accent phrase and group by pause_mora boundaries
  //    pause_mora typically corresponds to punctuation (、。！？) in the original text
  const pauseGroups: Array<{ start: number; end: number }> = [];
  let groupStart = currentTime;

  for (const phrase of query.accent_phrases) {
    for (const mora of phrase.moras) {
      currentTime += (mora.consonant_length ?? 0) + mora.vowel_length;
    }

    if (phrase.pause_mora) {
      currentTime += (phrase.pause_mora.consonant_length ?? 0) + phrase.pause_mora.vowel_length;
      pauseGroups.push({ start: groupStart, end: currentTime });
      groupStart = currentTime;
    }
  }
  // Last group (no trailing pause_mora)
  if (groupStart < currentTime) {
    pauseGroups.push({ start: groupStart, end: currentTime });
  }

  // 2. Split original text by punctuation into display segments
  //    Split after each 、。！？ but keep punctuation attached to preceding text
  const textSegments = originalText
    .split(/(?<=[。、！？])/g)
    .map(s => s.trim())
    .filter(s => s.length > 0 && !/^[。、！？]+$/.test(s));

  const timings: VoicevoxWordTiming[] = [];

  if (pauseGroups.length === textSegments.length) {
    // Perfect alignment — use precise VOICEVOX timing per segment
    for (let i = 0; i < textSegments.length; i++) {
      timings.push({
        text: textSegments[i],
        start: pauseGroups[i].start,
        end: pauseGroups[i].end,
      });
    }
  } else if (pauseGroups.length > textSegments.length && textSegments.length > 0) {
    // More pause groups than text segments — merge pause groups proportionally
    const ratio = pauseGroups.length / textSegments.length;
    for (let i = 0; i < textSegments.length; i++) {
      const startIdx = Math.floor(i * ratio);
      const endIdx = Math.min(Math.floor((i + 1) * ratio) - 1, pauseGroups.length - 1);
      timings.push({
        text: textSegments[i],
        start: pauseGroups[startIdx].start,
        end: pauseGroups[endIdx].end,
      });
    }
  } else {
    // Fallback: distribute timing proportionally by character count
    const totalSpeechDuration = currentTime - query.prePhonemeLength;
    const charCounts = textSegments.map(s => s.replace(/[。、！？]/g, '').length);
    const totalChars = charCounts.reduce((a, b) => a + b, 0);
    let t = query.prePhonemeLength;

    for (let i = 0; i < textSegments.length; i++) {
      const proportion = totalChars > 0 ? charCounts[i] / totalChars : 1 / textSegments.length;
      const segDuration = totalSpeechDuration * proportion;
      timings.push({
        text: textSegments[i],
        start: t,
        end: t + segDuration,
      });
      t += segDuration;
    }
  }

  // 4. Split long segments so each subtitle fits on a single line.
  //    At fixed fontSize=76 on 1080px (95% container = 1026px), ~12 CJK chars fit.
  const MAX_CHARS = 12;
  const splitTimings = splitLongTimings(timings, MAX_CHARS);

  // 5. Merge very short segments (< 5 chars) with the next segment
  //    to avoid isolated fragments like "担当。" appearing alone.
  const MIN_CHARS = 5;
  const merged = mergeShortSegments(splitTimings, MIN_CHARS, MAX_CHARS);

  log.info('Extracted VOICEVOX word timings', {
    phrases: merged.length,
    pauseGroups: pauseGroups.length,
    textSegments: textSegments.length,
    aligned: pauseGroups.length === textSegments.length,
  });
  return merged;
}

/**
 * Split timing segments whose text exceeds maxChars into smaller pieces,
 * breaking at natural Japanese particle boundaries (は、が、を、に、で、の、と、も、から、etc.)
 */
function splitLongTimings(
  timings: VoicevoxWordTiming[],
  maxChars: number,
): VoicevoxWordTiming[] {
  const result: VoicevoxWordTiming[] = [];

  for (const seg of timings) {
    const cleanText = seg.text.replace(/[。、！？]/g, '');
    if (cleanText.length <= maxChars) {
      result.push(seg);
      continue;
    }

    // Find natural split points: after particles and conjunctions
    const splitPoints = findJapaneseSplitPoints(seg.text, maxChars);
    const totalDuration = seg.end - seg.start;
    const totalChars = seg.text.length;

    let prevIdx = 0;
    for (const splitIdx of splitPoints) {
      const partText = seg.text.slice(prevIdx, splitIdx);
      const startRatio = prevIdx / totalChars;
      const endRatio = splitIdx / totalChars;
      result.push({
        text: partText,
        start: seg.start + totalDuration * startRatio,
        end: seg.start + totalDuration * endRatio,
      });
      prevIdx = splitIdx;
    }
    // Remaining text
    if (prevIdx < seg.text.length) {
      const startRatio = prevIdx / totalChars;
      result.push({
        text: seg.text.slice(prevIdx),
        start: seg.start + totalDuration * startRatio,
        end: seg.end,
      });
    }
  }

  return result;
}

/**
 * Merge very short subtitle segments with adjacent ones to avoid
 * isolated fragments like "担当。" appearing alone on screen.
 * Short segments are merged forward (with next) if combined fits;
 * otherwise merged backward (with previous).
 */
function mergeShortSegments(
  timings: VoicevoxWordTiming[],
  minChars: number,
  maxChars: number,
): VoicevoxWordTiming[] {
  if (timings.length <= 1) return timings;

  const result: VoicevoxWordTiming[] = [];

  for (let i = 0; i < timings.length; i++) {
    const seg = timings[i];
    const cleanLen = seg.text.replace(/[。、！？]/g, '').length;

    if (cleanLen >= minChars) {
      result.push(seg);
      continue;
    }

    // Try merge with next segment
    const next = timings[i + 1];
    if (next) {
      const combinedText = seg.text + next.text;
      const combinedClean = combinedText.replace(/[。、！？]/g, '').length;
      if (combinedClean <= maxChars) {
        result.push({
          text: combinedText,
          start: seg.start,
          end: next.end,
        });
        i++; // skip next
        continue;
      }
    }

    // Try merge with previous segment
    if (result.length > 0) {
      const prev = result[result.length - 1];
      const combinedText = prev.text + seg.text;
      const combinedClean = combinedText.replace(/[。、！？]/g, '').length;
      if (combinedClean <= maxChars) {
        result[result.length - 1] = {
          text: combinedText,
          start: prev.start,
          end: seg.end,
        };
        continue;
      }
    }

    // Can't merge — keep as-is
    result.push(seg);
  }

  return result;
}

/**
 * Find split points in Japanese text using a scoring system based on
 * Japanese typography rules (禁則処理). Avoids breaking inside katakana words,
 * after っ, before small kana, etc.
 * Returns array of character indices where text should be split.
 */
function findJapaneseSplitPoints(text: string, maxChars: number): number[] {
  const points: number[] = [];
  let lastSplit = 0;

  while (text.length - lastSplit > maxChars) {
    const target = lastSplit + maxChars;
    const searchStart = Math.max(lastSplit + 2, target - 3);
    const searchEnd = Math.min(text.length - 2, target + 2);

    let bestPos = target;
    let bestScore = -Infinity;

    for (let i = searchStart; i <= searchEnd; i++) {
      const score = splitScore(text, i);
      if (score > bestScore) {
        bestScore = score;
        bestPos = i;
      }
    }

    points.push(bestPos);
    lastSplit = bestPos;
  }

  return points;
}

/** Score a potential split position (higher = better place to split). */
function splitScore(text: string, pos: number): number {
  if (pos <= 0 || pos >= text.length) return -100;
  const before = text[pos - 1];
  const after = text[pos];
  let score = 0;

  // After punctuation: excellent
  if (/[、。！？]/.test(before)) score += 20;
  // After particle before kanji/katakana/Latin/digit: great
  if ('はがをにでのともへやかけ'.includes(before)) {
    const c = after.charCodeAt(0);
    if (
      (c >= 0x4E00 && c <= 0x9FFF) ||   // CJK kanji
      (c >= 0x30A0 && c <= 0x30FF) ||   // katakana
      (c >= 0x41 && c <= 0x5A) ||        // Latin uppercase A-Z
      (c >= 0x61 && c <= 0x7A) ||        // Latin lowercase a-z
      /[0-9０-９]/.test(after)            // digits
    ) {
      score += 15;
    }
  }
  // Before kanji after hiragana: good phrase boundary
  const bc = before.charCodeAt(0);
  const ac = after.charCodeAt(0);
  if (bc >= 0x3040 && bc <= 0x309F && ac >= 0x4E00 && ac <= 0x9FFF) score += 8;

  // AVOID: inside katakana sequence
  if (bc >= 0x30A0 && bc <= 0x30FF && ac >= 0x30A0 && ac <= 0x30FF) score -= 25;
  if (after === 'ー') score -= 25;
  // AVOID: before small kana
  if ('ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮー'.includes(after)) score -= 25;
  // AVOID: after っ/ッ (gemination)
  if (before === 'っ' || before === 'ッ') score -= 25;
  // AVOID: stranded 1-2 chars
  if (pos <= 2) score -= 20;
  if (text.length - pos <= 2) score -= 20;

  return score;
}

async function generateSpeechVoicevox(
  ttsConfig: TTSConfig,
  text: string,
  outputPath: string,
): Promise<{ url: string; duration?: number; wordTimings?: VoicevoxWordTiming[] }> {
  const speakerId = ttsConfig.voice ?? '13';
  log.info('Generating speech via VOICEVOX', { speakerId, textLength: text.length });

  const encodedText = encodeURIComponent(text);
  const queryResp = await fetch(
    `${VOICEVOX_BASE_URL}/audio_query?speaker=${speakerId}&text=${encodedText}`,
    { method: 'POST' },
  );
  if (!queryResp.ok) {
    throw new Error(`VOICEVOX audio_query failed: ${queryResp.status}`);
  }
  const queryJson = await queryResp.text();
  const query: VoicevoxAudioQuery = JSON.parse(queryJson);

  // Extract word-level timing from mora data
  const wordTimings = extractVoicevoxTimings(query, text);

  if (ttsConfig.speed) {
    query.speedScale = ttsConfig.speed;
  }

  const synthResp = await fetch(
    `${VOICEVOX_BASE_URL}/synthesis?speaker=${speakerId}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(query) },
  );
  if (!synthResp.ok) throw new Error(`VOICEVOX synthesis failed: ${synthResp.status}`);
  const wavData = Buffer.from(await synthResp.arrayBuffer());
  await writeFile(outputPath, wavData);

  // Calculate total duration from timing data
  const totalDuration = query.prePhonemeLength +
    query.accent_phrases.reduce((sum, phrase) => {
      const moraTime = phrase.moras.reduce((ms, m) => ms + (m.consonant_length ?? 0) + m.vowel_length, 0);
      const pauseTime = phrase.pause_mora
        ? (phrase.pause_mora.consonant_length ?? 0) + phrase.pause_mora.vowel_length
        : 0;
      return sum + moraTime + pauseTime;
    }, 0) +
    query.postPhonemeLength;

  log.info('VOICEVOX speech generated', { outputPath, duration: totalDuration, wordTimings: wordTimings.length });
  return { url: outputPath, duration: totalDuration, wordTimings };
}

/**
 * Get word-level timing from VOICEVOX without generating audio.
 * Used for cache-hit scenarios where audio exists but timings weren't stored.
 */
export async function getVoicevoxTimings(
  ttsConfig: TTSConfig,
  text: string,
): Promise<VoicevoxWordTiming[]> {
  const speakerId = ttsConfig.voice ?? '13';
  const encodedText = encodeURIComponent(text);
  const queryResp = await fetch(
    `${VOICEVOX_BASE_URL}/audio_query?speaker=${speakerId}&text=${encodedText}`,
    { method: 'POST' },
  );
  if (!queryResp.ok) {
    throw new Error(`VOICEVOX audio_query failed: ${queryResp.status}`);
  }
  const query: VoicevoxAudioQuery = JSON.parse(await queryResp.text());
  return extractVoicevoxTimings(query, text);
}

/**
 * Strip highlight markers (*keyword*) from text before sending to TTS.
 * The markers are preserved in the subtitle text for rendering.
 */
function stripHighlightMarkers(text: string): string {
  return text.replace(/\*([^*]+)\*/g, '$1');
}

export async function generateSpeech(
  ttsConfig: TTSConfig,
  text: string,
  outputPath: string,
): Promise<{ url: string; duration?: number; wordTimings?: VoicevoxWordTiming[] }> {
  // Strip *highlight* markers before TTS — they are for subtitle rendering only
  const cleanText = stripHighlightMarkers(text);

  log.info('Generating speech', {
    model: ttsConfig.model,
    textLength: cleanText.length,
  });

  if (ttsConfig.model === 'voicevox') {
    return generateSpeechVoicevox(ttsConfig, cleanText, outputPath);
  }

  const isKokoro = ttsConfig.model.includes('kokoro');
  const isVoiceDesign = ttsConfig.model.includes('voice-design');

  let input: Record<string, unknown>;

  if (isKokoro) {
    // kokoro models use "prompt" for text and require "voice"
    input = {
      prompt: cleanText,
      voice: ttsConfig.voice ?? 'jf_alpha',
    };
  } else if (isVoiceDesign) {
    // voice-design models use "prompt" for text
    input = { prompt: cleanText };
    if (ttsConfig.voice_prompt) {
      input.voice_description = ttsConfig.voice_prompt;
    }
  } else {
    // standard models (qwen-3-tts etc.) use "text"
    input = { text: cleanText };
    if (ttsConfig.voice_prompt) {
      input.voice_description = ttsConfig.voice_prompt;
    }
  }

  if (ttsConfig.voice_reference) {
    input.ref_audio_url = ttsConfig.voice_reference;
  }
  // qwen-3-tts requires full language names, not ISO codes
  const LANGUAGE_MAP: Record<string, string> = {
    en: 'English', zh: 'Chinese', es: 'Spanish', fr: 'French',
    de: 'German', it: 'Italian', ja: 'Japanese', ko: 'Korean',
    pt: 'Portuguese', ru: 'Russian',
  };
  if (ttsConfig.language && !isKokoro) {
    input.language = LANGUAGE_MAP[ttsConfig.language] ?? ttsConfig.language;
  }
  if (ttsConfig.temperature !== undefined) {
    input.temperature = ttsConfig.temperature;
  }
  if (ttsConfig.top_k !== undefined) {
    input.top_k = ttsConfig.top_k;
  }
  if (ttsConfig.top_p !== undefined) {
    input.top_p = ttsConfig.top_p;
  }

  const result = await falRequest<FalQwenTTSOutput>(ttsConfig.model, input);

  if (!result.audio?.url) {
    throw new Error('No audio returned from fal.ai');
  }

  await downloadFile(result.audio.url, outputPath);

  return { url: result.audio.url, duration: result.audio.duration };
}

export async function transcribe(
  audioUrl: string,
  model: string = 'fal-ai/whisper',
): Promise<FalTranscriptionOutput> {
  log.info('Transcribing audio', { model });

  const result = await falRequest<FalTranscriptionOutput>(model, {
    audio_url: audioUrl,
    task: 'transcribe',
    chunk_level: 'word',
  });

  return result;
}
