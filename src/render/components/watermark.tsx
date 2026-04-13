import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

export interface WatermarkProps {
  text: string;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  opacity?: number;
}

export const Watermark: React.FC<WatermarkProps> = ({
  text,
  position = 'bottom-right',
  opacity = 0.7,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Fade in over first 0.5s
  const fadeIn = interpolate(frame, [0, Math.round(fps * 0.5)], [0, opacity], {
    extrapolateRight: 'clamp',
  });

  const isBottom = position.startsWith('bottom');
  const isRight = position.endsWith('right');

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          [isBottom ? 'bottom' : 'top']: 60,
          [isRight ? 'right' : 'left']: 40,
          opacity: fadeIn,
          fontFamily: "'Hiragino Kaku Gothic StdN', sans-serif",
          fontSize: 28,
          fontWeight: 700,
          color: '#FFFFFF',
          textShadow: '2px 2px 6px rgba(0,0,0,0.6)',
          letterSpacing: 1,
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};
