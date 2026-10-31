import { CheckIcon, LoaderCircleIcon, PlayIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { hasCompleteTranslation } from '@shared/utils/multiLang';
import type { DubSession } from './dub-session';

export function dubWorkflowStep(session: DubSession, targets: string[]) {
  if (!session.jobId || !session.segments.length) return 0;
  if (!targets.length) return 1;
  if (targets.every((code) => session.tracks.includes(code))) return 3;
  if (
    !targets.every(
      (code) => code === session.sourceLang || hasCompleteTranslation(session.segments, code),
    )
  )
    return 1;
  return 2;
}

const labels = ['dub.upload_transcribe', 'dub.translate', 'dub.generate_dub', 'exportModal.export'];

export function DubWorkflowGuide({
  step,
  actionLabel,
  busy,
  disabled,
  status,
  detail,
  onContinue,
}: {
  step: number;
  actionLabel: string;
  busy: boolean;
  disabled: boolean;
  status?: string;
  detail?: string;
  onContinue: () => void;
}) {
  const { t } = useTranslation();
  return (
    <section
      aria-label={t('dub.next_step')}
      className="space-y-3 rounded-xl border border-primary/35 bg-primary/5 p-3"
    >
      <h2 className="text-sm font-semibold">{t('dub.next_step')}</h2>
      <p className="text-xs leading-5 text-muted-foreground">{t('dub.workflow_hint')}</p>
      <ol className="space-y-1.5">
        {labels.map((label, index) => (
          <li
            key={label}
            aria-current={index === step ? 'step' : undefined}
            className={cn(
              'flex items-center gap-2 rounded-md px-2 py-1.5 text-xs',
              index === step
                ? 'bg-primary/15 font-semibold text-foreground'
                : 'text-muted-foreground',
            )}
          >
            <span
              aria-hidden="true"
              className="flex size-5 shrink-0 items-center justify-center rounded-full border border-current"
            >
              {index < step ? <CheckIcon className="size-3" /> : index + 1}
            </span>
            {t(label)}
          </li>
        ))}
      </ol>
      {detail && <p className="text-xs leading-5 text-muted-foreground">{detail}</p>}
      <Button
        className="h-auto min-h-9 w-full whitespace-normal py-2"
        disabled={disabled || busy}
        onClick={onContinue}
      >
        {busy ? (
          <LoaderCircleIcon className="animate-spin motion-reduce:animate-none" />
        ) : (
          <PlayIcon />
        )}
        {busy && status ? status : actionLabel}
      </Button>
      {busy && status && (
        <p role="status" className="text-xs text-muted-foreground">
          {status}
        </p>
      )}
    </section>
  );
}
