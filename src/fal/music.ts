import { falRequest, downloadFile } from './client.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('fal-music');

export interface MusicRequest {
  prompt: string;
  duration: number;
}

/**
 * Normalize music response across different fal.ai music models.
 * Different models return audio URLs in different shapes:
 *   - beatoven/music-generation:    { audio: { url }, metadata: { duration } }
 *   - cassetteai/music-generator:   { audio_file: { url } }  (or similar variants)
 *   - fal-ai/stable-audio:          { audio_file: { url } }
 *   - fal-ai/minimax-music:         { audio: { url } }
 *   - fal-ai/ace-step:              { audio: { url, duration } }
 */
function extractAudioUrl(result: unknown): { url: string; duration?: number } | null {
  if (!result || typeof result !== 'object') return null;
  const r = result as Record<string, unknown>;

  const candidates: Array<Record<string, unknown> | undefined> = [
    r.audio as Record<string, unknown> | undefined,
    r.audio_file as Record<string, unknown> | undefined,
    r.output as Record<string, unknown> | undefined,
    r.file as Record<string, unknown> | undefined,
  ];

  for (const c of candidates) {
    if (c && typeof c === 'object' && typeof c.url === 'string') {
      const duration = typeof c.duration === 'number' ? c.duration : undefined;
      return { url: c.url, duration };
    }
  }

  // Fallback: direct url / audio_url fields on the root
  if (typeof r.url === 'string') return { url: r.url };
  if (typeof r.audio_url === 'string') return { url: r.audio_url };

  return null;
}

export async function generateMusic(
  model: string,
  request: MusicRequest,
  outputPath: string,
): Promise<{ url: string; duration: number }> {
  log.info('Generating music', {
    model,
    prompt: request.prompt.slice(0, 80),
    duration: request.duration,
  });

  const input: Record<string, unknown> = {
    prompt: request.prompt,
    duration: request.duration,
  };

  const result = await falRequest<unknown>(model, input);

  const audio = extractAudioUrl(result);
  if (!audio) {
    log.warn('Unrecognized music response shape', {
      model,
      keys: result && typeof result === 'object' ? Object.keys(result as object) : [],
    });
    throw new Error(`No music returned from fal.ai (model: ${model})`);
  }

  await downloadFile(audio.url, outputPath);

  // Metadata duration fallback
  const metaDuration = (result as { metadata?: { duration?: number } }).metadata?.duration;
  const finalDuration = audio.duration ?? metaDuration ?? request.duration;

  return { url: audio.url, duration: finalDuration };
}
