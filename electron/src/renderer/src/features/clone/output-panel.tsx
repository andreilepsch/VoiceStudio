import { AudioLinesIcon, XIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { SaveAudioButton } from '@/components/save-audio-button';
import { WaveformPlayer } from '@/components/waveform-player';
import { audioUrl } from '@/lib/api/client';
import { clearLatestOutput, useLatestOutput } from '@/lib/store/output';
import { activePlaybackSource, stopActivePlayback } from '@/lib/audio/playback';
import { formatSeconds } from './format';
import { AudioQuality } from './audio-quality';
import { AudioFileDetails } from './audio-file-details';
import { SectionLabel } from './section-label';
import { useCloneSetting } from '@/lib/store/clone-settings';
import {
  DeleteTakeButton,
  TakeVoice,
  TakesList,
  useDeleteTake,
  useTakeGroups,
  type TakeMode,
} from './takes-list';

export function OutputPanel({ mode = 'clone' }: { mode?: TakeMode }) {
  const { t } = useTranslation();
  const { result, objectUrl, text } = useLatestOutput();
  const editorText = useCloneSetting('text');
  const currentText = mode === 'clone' ? editorText : undefined;
  const takes = useTakeGroups(mode, currentText);
  const latestDelete = useDeleteTake((id) => {
    if (id === result?.id) clearLatestOutput();
  });
  const hasLatest = Boolean(result && objectUrl);
  const hasOthers = takes.groups.some((group) =>
    group.items.some((item) => item.id !== result?.id),
  );
  if (!hasLatest && !hasOthers) return null;
  if (!result || !objectUrl) {
    return (
      <section
        aria-label={t('clone.history_title')}
        className="w-full shrink-0 border-t border-border/60 bg-muted/15 px-6 py-3"
      >
        <TakesList mode={mode} currentText={currentText} />
      </section>
    );
  }
  const latestId = result.id;
  const latestGroup = latestId ? takes.byTake.get(latestId) : undefined;
  const latestNumber = latestId ? latestGroup?.numbers.get(latestId) : undefined;
  const latestItem = latestGroup?.items.find((item) => item.id === latestId);

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');

  return (
    <section
      aria-label={t('clone.output_title')}
      className="w-full shrink-0 border-t border-border/60 bg-muted/15 px-6 py-3"
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <SectionLabel>
            <AudioLinesIcon aria-hidden="true" />
            {t('clone.output_title')}
            {latestNumber ? (
              <span className="font-mono text-muted-foreground tabular-nums">#{latestNumber}</span>
            ) : null}
            {latestItem ? <TakeVoice item={latestItem} className="ml-2" /> : null}
          </SectionLabel>
          <div className="flex items-center gap-1">
            <SaveAudioButton
              url={result.audioPath ? audioUrl(result.audioPath) : undefined}
              suggestedName={`voicestudio-${latestNumber ? `${latestNumber}-` : ''}${result.id ?? stamp}.wav`}
            />
            {latestId ? (
              <DeleteTakeButton onClick={() => latestDelete.requestDelete(latestId)} />
            ) : null}
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t('common.close')}
              title={t('common.close')}
              onClick={() => {
                if (activePlaybackSource() === 'output') stopActivePlayback();
                clearLatestOutput();
              }}
            >
              <XIcon />
            </Button>
          </div>
        </div>
        {result && objectUrl ? (
          <>
            <WaveformPlayer key={`player-${objectUrl}`} src={objectUrl} source="output" height={36} />
            <AudioFileDetails blob={result.blob} />
            {result.audioPath && <AudioQuality key={`quality-${objectUrl}`} audioPath={result.audioPath} />}
            <div className="flex flex-wrap items-start justify-between gap-3">
              <p
                className="line-clamp-2 min-w-40 flex-1 text-sm text-muted-foreground"
                title={text}
              >
                {text}
              </p>
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {t('clone.output_meta', {
                  duration: formatSeconds(result.durationSeconds),
                  gen: formatSeconds(result.genTimeSeconds),
                })}
              </span>
            </div>
            <TakesList mode={mode} excludeId={result.id} currentText={currentText} />
          </>
        ) : (
          <div className="flex min-h-24 items-center justify-center rounded-lg border border-dashed text-[length:var(--text-label)] text-muted-foreground">
            {t('clone.output_empty')}
          </div>
        )}
      </div>
      {latestDelete.dialog}
    </section>
  );
}
