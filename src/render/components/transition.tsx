import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';

export type TransitionType = 'fade' | 'cut' | 'dissolve' | 'slide-left' | 'slide-right';

const TRANSITION_FRAMES = 12; // ~0.4s at 30fps

export interface TransitionProps {
  type: TransitionType;
  durationFrames: number;
  children: React.ReactNode;
  isLast?: boolean;
}

export const Transition: React.FC<TransitionProps> = ({
  type,
  durationFrames,
  children,
  isLast = false,
}) => {
  const frame = useCurrentFrame();

  if (type === 'cut') {
    return <AbsoluteFill>{children}</AbsoluteFill>;
  }

  if (type === 'slide-left' || type === 'slide-right') {
    const direction = type === 'slide-left' ? -1 : 1;

    // Slide in from right/left
    const slideIn = interpolate(frame, [0, TRANSITION_FRAMES], [direction * 100, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });

    // Slide out (skip for last scene)
    const slideOut = isLast
      ? 0
      : interpolate(
          frame,
          [durationFrames - TRANSITION_FRAMES, durationFrames],
          [0, -direction * 100],
          {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          },
        );

    const translateX = frame < TRANSITION_FRAMES ? slideIn : slideOut;

    return (
      <AbsoluteFill style={{ transform: `translateX(${translateX}%)` }}>
        {children}
      </AbsoluteFill>
    );
  }

  // Fade / dissolve
  const fadeIn = interpolate(frame, [0, TRANSITION_FRAMES], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const fadeOut = isLast
    ? 1
    : interpolate(
        frame,
        [durationFrames - TRANSITION_FRAMES, durationFrames],
        [1, 0],
        {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        },
      );

  const opacity = Math.min(fadeIn, fadeOut);

  return (
    <AbsoluteFill style={{ opacity }}>
      {children}
    </AbsoluteFill>
  );
};
