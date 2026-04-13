import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

export interface EndCardProps {
  followText?: string;
  likeText?: string;
  channelHandle?: string;
}

export const EndCard: React.FC<EndCardProps> = ({
  followText = 'フォローよろしくね！',
  likeText = 'いいね♡',
  channelHandle = '@fukuoka_ai_news',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Background fade in
  const bgOpacity = interpolate(frame, [0, 10], [0, 0.85], {
    extrapolateRight: 'clamp',
  });

  // Channel handle slides up
  const handleY = spring({
    frame: Math.max(0, frame - 5),
    fps,
    from: 60,
    to: 0,
    config: { damping: 14, stiffness: 120 },
  });
  const handleOpacity = interpolate(frame, [5, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Follow button pops in
  const followScale = spring({
    frame: Math.max(0, frame - 15),
    fps,
    from: 0,
    to: 1,
    config: { damping: 10, stiffness: 200 },
  });

  // Like button pops in
  const likeScale = spring({
    frame: Math.max(0, frame - 22),
    fps,
    from: 0,
    to: 1,
    config: { damping: 10, stiffness: 200 },
  });

  // Pulse animation for follow button
  const pulse = interpolate(
    (frame - 20) % 30,
    [0, 15, 30],
    [1, 1.05, 1],
  );

  return (
    <AbsoluteFill>
      {/* Dark overlay background */}
      <AbsoluteFill
        style={{
          backgroundColor: `rgba(0, 0, 0, ${bgOpacity})`,
        }}
      />

      {/* Content container */}
      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          gap: 36,
          flexDirection: 'column',
        }}
      >
        {/* Channel handle */}
        <div
          style={{
            opacity: handleOpacity,
            transform: `translateY(${handleY}px)`,
            fontFamily: "'Hiragino Kaku Gothic StdN', sans-serif",
            fontSize: 48,
            fontWeight: 900,
            color: '#FFFFFF',
            textShadow: '0 2px 8px rgba(0,0,0,0.5)',
            letterSpacing: 2,
          }}
        >
          {channelHandle}
        </div>

        {/* Follow button */}
        <div
          style={{
            transform: `scale(${followScale * pulse})`,
            backgroundColor: '#FF2D55',
            paddingTop: 20,
            paddingBottom: 20,
            paddingLeft: 60,
            paddingRight: 60,
            borderRadius: 50,
            boxShadow: '0 4px 20px rgba(255,45,85,0.5)',
          }}
        >
          <span
            style={{
              fontFamily: "'Hiragino Kaku Gothic StdN', sans-serif",
              fontSize: 44,
              fontWeight: 900,
              color: '#FFFFFF',
              letterSpacing: 3,
            }}
          >
            {followText}
          </span>
        </div>

        {/* Like button — same pill style as follow */}
        <div
          style={{
            transform: `scale(${likeScale * pulse})`,
            backgroundColor: '#FF6B8A',
            paddingTop: 16,
            paddingBottom: 16,
            paddingLeft: 50,
            paddingRight: 50,
            borderRadius: 50,
            boxShadow: '0 4px 20px rgba(255,107,138,0.5)',
          }}
        >
          <span
            style={{
              fontFamily: "'Hiragino Kaku Gothic StdN', sans-serif",
              fontSize: 38,
              fontWeight: 900,
              color: '#FFFFFF',
              letterSpacing: 3,
            }}
          >
            {likeText}
          </span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
