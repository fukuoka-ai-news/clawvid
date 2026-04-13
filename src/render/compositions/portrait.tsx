import { AbsoluteFill, Audio, Sequence, useCurrentFrame } from 'remotion';
import type { CompositionProps } from './types.js';
import { SceneRenderer } from './scene-renderer.js';
import { SubtitleOverlay } from '../components/subtitle.js';
import { MetadataOverlay } from '../components/metadata-badge.js';
import { Watermark } from '../components/watermark.js';
import { EndCard } from '../components/endcard.js';
import { PortraitFrame } from '../layouts/portrait-frame.js';

export const PortraitVideo: React.FC<CompositionProps> = ({
  scenes,
  audioUrl,
  subtitles,
  template,
  metadata,
  watermark,
  endCard,
}) => {
  // Calculate total scene duration for endcard placement
  const lastScene = scenes[scenes.length - 1];
  const scenesEndFrame = lastScene
    ? lastScene.startFrame + lastScene.durationFrames
    : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: 'black' }}>
      <PortraitFrame>
        {/* Scene sequences — each scene plays at its designated time */}
        {scenes.map((scene, index) => (
          <Sequence
            key={scene.id}
            from={scene.startFrame}
            durationInFrames={scene.durationFrames}
            name={scene.id}
          >
            <SceneRenderer scene={scene} template={template} isLast={index === scenes.length - 1} />
          </Sequence>
        ))}

        {/* End card overlay after all scenes */}
        {endCard?.enabled && (
          <Sequence
            from={scenesEndFrame}
            durationInFrames={endCard.durationFrames}
            name="endcard"
          >
            <EndCard
              followText={endCard.followText}
              likeText={endCard.likeText}
              channelHandle={endCard.channelHandle}
            />
          </Sequence>
        )}
      </PortraitFrame>

      {/* Audio track */}
      {audioUrl && (
        <Audio src={audioUrl} volume={1} />
      )}

      {/* Metadata overlay — only during explain scenes (not hook/cta/endcard) */}
      {metadata && scenes.length >= 3 && (() => {
        const explainStart = scenes[1].startFrame;
        const explainEnd = scenes[scenes.length - 1].startFrame;
        const explainDuration = explainEnd - explainStart;
        return explainDuration > 0 ? (
          <Sequence from={explainStart} durationInFrames={explainDuration} name="metadata">
            <MetadataOverlay
              date={metadata.date}
              dayOfWeek={metadata.dayOfWeek}
              location={metadata.location}
            />
          </Sequence>
        ) : null;
      })()}

      {/* Subtitle overlay — centered, fixed 76px for consistent single-line display */}
      {subtitles.length > 0 && (
        <SubtitleOverlay
          subtitles={subtitles}
          position="center"
          fontSize={76}
        />
      )}

      {/* Watermark — channel handle */}
      {watermark && (
        <Watermark
          text={watermark.text}
          position={watermark.position}
          opacity={watermark.opacity}
        />
      )}
    </AbsoluteFill>
  );
};
