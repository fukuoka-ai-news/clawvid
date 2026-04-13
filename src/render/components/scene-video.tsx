import { AbsoluteFill, Img, OffthreadVideo, Sequence, useCurrentFrame } from 'remotion';

export interface SceneVideoProps {
  src: string;
  startFrom?: number;
  volume?: number;
  /** Total scene duration in frames */
  durationInFrames?: number;
  /** Actual video clip duration in frames (for loop interval) */
  clipDurationInFrames?: number;
}

export const SceneVideo: React.FC<SceneVideoProps> = ({
  src,
  startFrom = 0,
  volume = 0,
  durationInFrames,
  clipDurationInFrames,
}) => {
  const clipFrames = clipDurationInFrames ?? durationInFrames;
  const needsFreeze = clipFrames && durationInFrames && clipFrames < durationInFrames;

  // When scene is longer than clip, play video once then freeze on last frame.
  // OffthreadVideo with endAt freezes on the last frame when the sequence continues.
  return (
    <AbsoluteFill>
      <OffthreadVideo
        src={src}
        startFrom={startFrom}
        // Freeze on last frame: when current frame exceeds clip duration,
        // Remotion's OffthreadVideo naturally holds the last decoded frame
        endAt={needsFreeze ? clipFrames : undefined}
        volume={volume}
        pauseWhenBuffering
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      />
    </AbsoluteFill>
  );
};
