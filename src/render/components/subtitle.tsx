import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { SubtitleEntry } from '../compositions/types.js';

export interface SubtitleOverlayProps {
  subtitles: SubtitleEntry[];
  position?: 'bottom' | 'center';
  fontFamily?: string;
  fontSize?: number;
  /** Color for highlighted keywords (default: #FFD700 gold) */
  highlightColor?: string;
}

// --- Keyword highlight ---

const HIGHLIGHT_COLOR = '#FFD700';

interface TextSegment {
  text: string;
  highlighted: boolean;
}

/**
 * Parse subtitle text into segments with highlight markers.
 *
 * Two highlight sources (priority order):
 *  1. Manual markup: *keyword* in the text (asterisks stripped for display)
 *  2. Auto-detect: numbers with optional unit (e.g. 2倍, 100万円, 60年)
 *
 * Both can co-exist in a single subtitle string.
 */
function parseHighlights(text: string): TextSegment[] {
  // Step 1: Process manual *keyword* markers
  //   Split by *...* patterns, alternating between normal and marked text.
  const manualParts = text.split(/\*([^*]+)\*/g);
  const intermediate: TextSegment[] = [];
  for (let i = 0; i < manualParts.length; i++) {
    if (manualParts[i] === '') continue;
    // Odd indices are the captured groups inside *...*
    intermediate.push({ text: manualParts[i], highlighted: i % 2 === 1 });
  }

  // Step 2: Auto-detect numbers in non-highlighted segments
  //   Match digits (半角/全角) optionally followed by a CJK unit character
  const NUMBER_PATTERN = /([0-9０-９]+[%％倍万億円年月日時分秒個本件人杯棟台匹頭]?)/g;
  const result: TextSegment[] = [];

  for (const seg of intermediate) {
    if (seg.highlighted) {
      // Already marked — keep as-is
      result.push(seg);
      continue;
    }
    // Split by number pattern, alternating normal / number
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    NUMBER_PATTERN.lastIndex = 0;
    while ((match = NUMBER_PATTERN.exec(seg.text)) !== null) {
      if (match.index > lastIndex) {
        result.push({ text: seg.text.slice(lastIndex, match.index), highlighted: false });
      }
      result.push({ text: match[0], highlighted: true });
      lastIndex = NUMBER_PATTERN.lastIndex;
    }
    if (lastIndex < seg.text.length) {
      result.push({ text: seg.text.slice(lastIndex), highlighted: false });
    }
  }

  return result.length > 0 ? result : [{ text, highlighted: false }];
}

// --- 8-direction outline generator ---

/**
 * Generate 8-directional text-shadow for clean CJK text outline.
 * Unlike WebkitTextStroke, this renders identically across all browsers
 * and avoids the double-render artifact on kanji/katakana.
 */
function outlineShadow(size: number, color: string): string {
  return [
    `${-size}px ${-size}px 0 ${color}`,
    `${size}px ${-size}px 0 ${color}`,
    `${-size}px ${size}px 0 ${color}`,
    `${size}px ${size}px 0 ${color}`,
    `0 ${-size}px 0 ${color}`,
    `0 ${size}px 0 ${color}`,
    `${-size}px 0 0 ${color}`,
    `${size}px 0 0 ${color}`,
  ].join(', ');
}

// --- Component ---

export const SubtitleOverlay: React.FC<SubtitleOverlayProps> = ({
  subtitles,
  position = 'bottom',
  fontFamily = "'Noto Sans JP', 'Hiragino Kaku Gothic StdN', 'Hiragino Sans', sans-serif",
  fontSize = 42,
  highlightColor = HIGHLIGHT_COLOR,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const current = subtitles.find((s) => frame >= s.startFrame && frame <= s.endFrame);

  if (!current) return null;

  const isHook = current.style === 'hook';
  const isCta = current.style === 'cta';
  const isAccented = isHook || isCta;

  // Fixed font size for consistent visual rhythm across all subtitle segments.
  // Text splitting (MAX_CHARS=12 in audio.ts) ensures content fits in one line.
  const effectiveFontSize = isAccented ? fontSize * 1.1 : fontSize;

  const rawText = current.text;

  // Parse highlights (manual *markers* + auto-detected numbers)
  const segments = parseHighlights(rawText);

  // Base text color: hook and CTA use same accent color for consistency.
  const baseColor = isAccented ? '#00FF66' : 'white';

  // Frames since this subtitle started
  const localFrame = frame - current.startFrame;

  // Spring fade-in animation for all subtitles
  const springOpacity = spring({
    frame: localFrame,
    fps,
    config: { damping: 20, stiffness: 300 },
  });

  // Hook/CTA: spring pop-in scale animation
  const popScale = isAccented
    ? spring({ frame: localFrame, fps, config: { damping: 12, stiffness: 200 } })
    : 1;

  // CTA: subtle pulse glow
  const glowIntensity = isCta
    ? interpolate(localFrame % (fps * 0.8), [0, fps * 0.4, fps * 0.8], [0, 8, 0])
    : 0;

  // 8-direction outline + soft drop shadow
  const outlineSize = Math.max(2, Math.round(effectiveFontSize * 0.035));
  const shadowLayers = [
    outlineShadow(outlineSize, 'rgba(0,0,0,0.95)'),
    `0 4px 8px rgba(0,0,0,0.6)`,
    glowIntensity > 0 ? `0 0 ${glowIntensity}px ${highlightColor}` : '',
  ].filter(Boolean).join(', ');

  return (
    <AbsoluteFill
      style={{
        justifyContent: position === 'bottom' ? 'flex-end' : 'center',
        alignItems: 'center',
        paddingBottom: position === 'bottom' ? 80 : 0,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          fontFamily,
          fontSize: effectiveFontSize,
          fontWeight: 900,
          textAlign: 'center',
          whiteSpace: 'pre-wrap',
          wordBreak: 'keep-all',
          textShadow: shadowLayers,
          maxWidth: '95%',
          lineHeight: 1.2,
          opacity: springOpacity,
          transform: `scale(${popScale})`,
          letterSpacing: isAccented ? 4 : 2,
          color: baseColor,
        }}
      >
        {segments.map((seg, i) =>
          seg.highlighted && !isAccented ? (
            <span key={i} style={{ color: highlightColor }}>{seg.text}</span>
          ) : (
            <React.Fragment key={i}>{seg.text}</React.Fragment>
          ),
        )}
      </div>
    </AbsoluteFill>
  );
};
