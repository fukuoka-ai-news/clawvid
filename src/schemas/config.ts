import { z } from 'zod';

const resolutionSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

const falModelsSchema = z.object({
  image: z.object({
    default: z.string(),
    premium: z.string(),
    stylized: z.string(),
  }),
  video: z.object({
    default: z.string(),
    fast: z.string(),
    cinematic: z.string(),
  }),
  audio: z.object({
    tts: z.string(),
    transcription: z.string(),
    sound_effects: z.string().optional(),
    music_generation: z.string().optional(),
  }),
  analysis: z.object({
    image: z.string(),
    video: z.string(),
  }).optional(),
});

const templateSchema = z.object({
  image_model: z.string(),
  video_model: z.string(),
  color_mood: z.string(),
  effects: z.array(z.string()),
  voice_style: z.string(),
  voice_pacing: z.number(),
  scenes_per_minute: z.number().int().positive(),
});

const qualityPresetSchema = z.object({
  image_model: z.string(),
  image_size: z.string(),
  video_clips: z.number().int().nonnegative(),
  inference_steps: z.number().int().positive(),
});

const platformSchema = z.object({
  aspect_ratio: z.string(),
  resolution: resolutionSchema,
  max_duration_seconds: z.number().positive(),
  codec: z.string(),
  audio_codec: z.string(),
  bitrate: z.string(),
  audio_bitrate: z.string(),
});

const watermarkSchema = z.object({
  enabled: z.boolean(),
  text: z.string(),
  position: z.enum(['bottom-right', 'bottom-left', 'top-right', 'top-left']).optional(),
  opacity: z.number().min(0).max(1).optional(),
}).optional();

const endcardSchema = z.object({
  enabled: z.boolean(),
  duration_seconds: z.number().positive().optional(),
  follow_text: z.string().optional(),
  like_text: z.string().optional(),
}).optional();

const brandingSchema = z.object({
  watermark: watermarkSchema,
  endcard: endcardSchema,
}).optional();

const avatarSchema = z.object({
  enabled: z.boolean(),
  reference_image: z.string(),
  talking_head_model: z.string(),
  voice_description: z.string().optional(),
  resolution: z.string().optional(),
}).optional();

export const configSchema = z.object({
  fal: falModelsSchema,
  defaults: z.object({
    aspect_ratio: z.string(),
    resolution: resolutionSchema,
    fps: z.number().int().positive(),
    duration_seconds: z.number().positive(),
    max_video_clips: z.number().int().nonnegative(),
    image_to_video_ratio: z.number().min(0).max(1),
  }),
  templates: z.record(z.string(), templateSchema),
  quality: z.object({
    max_quality: qualityPresetSchema,
    balanced: qualityPresetSchema,
    budget: qualityPresetSchema,
  }),
  platforms: z.record(z.string(), platformSchema),
  output: z.object({
    directory: z.string(),
    format: z.string(),
    codec: z.string(),
    naming: z.string(),
  }),
  avatar: avatarSchema,
  branding: brandingSchema,
  bgm_categories: z.record(z.string(), z.string()).optional(),
});

export type Config = z.infer<typeof configSchema>;
