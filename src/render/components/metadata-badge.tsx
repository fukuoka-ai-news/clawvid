import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';

export interface MetadataOverlayProps {
  /** Date string in MM/DD format */
  date?: string;
  /** Day of week in Japanese (e.g. 木曜日) */
  dayOfWeek?: string;
  /** City/ward name (e.g. 福岡市中央区) */
  location?: string;
}

export const MetadataOverlay: React.FC<MetadataOverlayProps> = ({
  date,
  dayOfWeek,
  location,
}) => {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();

  if (!date && !location) return null;

  // Slide-in animation from the left
  const slideIn = spring({
    frame,
    fps,
    from: -80,
    to: 0,
    config: { damping: 15, stiffness: 120 },
  });

  const opacity = interpolate(frame, [0, 8], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // Position: pushed down to roughly 18% of viewport height (lower than before)
  const topPosition = Math.round(height * 0.18);

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          top: topPosition,
          left: 48 + slideIn,
          opacity,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: 18,
        }}
      >
        {/* Date circle badge — enlarged so MM/DD fits comfortably */}
        {date && (
          <div
            style={{
              width: 200,
              height: 200,
              borderRadius: '50%',
              backgroundColor: '#E53935',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 6px 16px rgba(0,0,0,0.35)',
              padding: 8,
              boxSizing: 'border-box',
            }}
          >
            <span
              style={{
                fontFamily: "'Hiragino Kaku Gothic StdN', sans-serif",
                fontWeight: 900,
                fontSize: 54,
                color: '#FFFFFF',
                lineHeight: 1.0,
                letterSpacing: -2,
              }}
            >
              {date}
            </span>
            {dayOfWeek && (
              <span
                style={{
                  fontFamily: "'Hiragino Kaku Gothic StdN', sans-serif",
                  fontWeight: 900,
                  fontSize: 36,
                  color: '#FFFFFF',
                  lineHeight: 1.1,
                  marginTop: 4,
                }}
              >
                {dayOfWeek}
              </span>
            )}
          </div>
        )}

        {/* Location label — white rectangular badge with black text */}
        {location && (
          <div
            style={{
              backgroundColor: '#FFFFFF',
              paddingTop: 12,
              paddingBottom: 12,
              paddingLeft: 24,
              paddingRight: 24,
              borderRadius: 6,
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            }}
          >
            <span
              style={{
                fontFamily: "'Hiragino Kaku Gothic StdN', sans-serif",
                fontWeight: 900,
                fontSize: 44,
                color: '#000000',
                lineHeight: 1.1,
                letterSpacing: -1,
              }}
            >
              {location}
            </span>
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
