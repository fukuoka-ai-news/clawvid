export interface SceneProps {
  id: string;
  type: 'image' | 'video' | 'talking_head';
  src: string;
  startFrame: number;
  durationFrames: number;
  /** Actual video clip duration in frames (for loop calculation) */
  clipDurationFrames?: number;
  effects: string[];
  transition?: 'fade' | 'cut' | 'dissolve' | 'slide-left' | 'slide-right';
  textOverlay?: {
    text: string;
    style?: string;
    position?: 'top' | 'center' | 'bottom';
  };
}

export interface SubtitleEntry {
  text: string;
  startFrame: number;
  endFrame: number;
  style?: 'hook' | 'cta' | 'default';
}

export interface TemplateStyle {
  name: string;
  colorFilter?: string;
  overlayColor?: string;
  overlayOpacity?: number;
  defaultEffects?: string[];
}

export interface MetadataProps {
  /** Date in MM/DD format */
  date?: string;
  /** Day of week in Japanese (e.g. 木曜日) */
  dayOfWeek?: string;
  /** City/ward/municipality name (e.g. 中央区) */
  location?: string;
}

export interface WatermarkConfig {
  text: string;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  opacity?: number;
}

export interface EndCardConfig {
  enabled: boolean;
  durationFrames: number;
  followText?: string;
  likeText?: string;
  channelHandle?: string;
}

export interface CompositionProps {
  scenes: SceneProps[];
  audioUrl: string;
  subtitles: SubtitleEntry[];
  template?: TemplateStyle;
  fps?: number;
  metadata?: MetadataProps;
  watermark?: WatermarkConfig;
  endCard?: EndCardConfig;
}
