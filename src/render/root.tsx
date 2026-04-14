import { Composition, Still, registerRoot } from 'remotion';
import { LandscapeVideo } from './compositions/landscape.js';
import { PortraitVideo } from './compositions/portrait.js';
import { ThumbnailStill } from './components/thumbnail-still.js';
import type { CompositionProps } from './compositions/types.js';
import type { ThumbnailStillProps } from './components/thumbnail-still.js';

const DEFAULT_FPS = 30;
const DEFAULT_DURATION_FRAMES = 1800; // 60s fallback

function calculateDuration({ props }: { props: CompositionProps }) {
  const scenes = props.scenes ?? [];
  if (scenes.length === 0) {
    return { durationInFrames: DEFAULT_DURATION_FRAMES };
  }
  const lastFrame = Math.max(
    ...scenes.map((s) => s.startFrame + s.durationFrames),
  );
  // Add endcard duration if enabled
  const endCardFrames = props.endCard?.enabled ? props.endCard.durationFrames : 0;
  const total = lastFrame + endCardFrames;
  return { durationInFrames: total > 0 ? total : DEFAULT_DURATION_FRAMES };
}

const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="LandscapeVideo"
        component={LandscapeVideo as unknown as React.FC<Record<string, unknown>>}
        durationInFrames={DEFAULT_DURATION_FRAMES}
        fps={DEFAULT_FPS}
        width={1920}
        height={1080}
        defaultProps={{
          scenes: [],
          audioUrl: '',
          subtitles: [],
        }}
        calculateMetadata={calculateDuration as never}
      />
      <Composition
        id="PortraitVideo"
        component={PortraitVideo as unknown as React.FC<Record<string, unknown>>}
        durationInFrames={DEFAULT_DURATION_FRAMES}
        fps={DEFAULT_FPS}
        width={1080}
        height={1920}
        defaultProps={{
          scenes: [],
          audioUrl: '',
          subtitles: [],
        }}
        calculateMetadata={calculateDuration as never}
      />
      <Still
        id="Thumbnail"
        component={ThumbnailStill as unknown as React.FC<Record<string, unknown>>}
        width={1080}
        height={1920}
        defaultProps={{
          headline: '',
          thumbnailTitle: '',
          date: '',
          dayOfWeek: '',
          slotLabel: '朝のニュース',
          backgroundImage: '',
        } satisfies ThumbnailStillProps}
      />
    </>
  );
};

registerRoot(RemotionRoot);
