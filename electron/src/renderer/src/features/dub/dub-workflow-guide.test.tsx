import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { dubWorkflowStep, DubWorkflowGuide } from './dub-workflow-guide';
import { dubSession } from './dub-session';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
afterEach(cleanup);

it('guides an uploaded file through transcription, translation, generation and export', () => {
  const state = { ...dubSession.state, jobId: 'job', sourceLang: 'en', tracks: [], segments: [] };
  expect(dubWorkflowStep(state, ['pt'])).toBe(0);
  const transcribed = {
    ...state,
    segments: [{ id: '1', start: 0, end: 1, text: 'Hello', text_original: 'Hello' }],
  };
  expect(dubWorkflowStep(transcribed, ['pt'])).toBe(1);
  expect(dubWorkflowStep(transcribed, [])).toBe(1);
  const translated = {
    ...transcribed,
    segments: [{ ...transcribed.segments[0], translations: { pt: 'Olá' } }],
  };
  expect(dubWorkflowStep(translated, ['pt'])).toBe(2);
  expect(dubWorkflowStep({ ...translated, tracks: ['pt'] }, ['pt'])).toBe(3);
  // An older language track does not make the new target exportable.
  expect(dubWorkflowStep({ ...translated, tracks: ['es'] }, ['pt'])).toBe(2);
  expect(dubWorkflowStep(translated, ['pt', 'fr'])).toBe(1);
  expect(dubWorkflowStep(transcribed, ['en'])).toBe(2);
});

it('makes the next action explicit and prevents duplicate clicks during processing', () => {
  const onContinue = vi.fn();
  const view = render(
    <DubWorkflowGuide
      step={0}
      actionLabel="Transcribe"
      busy={false}
      disabled={false}
      onContinue={onContinue}
    />,
  );
  expect(screen.getByText('dub.upload_transcribe').closest('li')).toHaveAttribute(
    'aria-current',
    'step',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Transcribe' }));
  expect(onContinue).toHaveBeenCalledOnce();
  view.rerender(
    <DubWorkflowGuide
      step={0}
      actionLabel="Transcribe"
      busy
      disabled={false}
      status="Transcribing…"
      onContinue={onContinue}
    />,
  );
  expect(screen.getByRole('status')).toHaveTextContent('Transcribing…');
  fireEvent.click(screen.getByRole('button', { name: 'Transcribing…' }));
  expect(onContinue).toHaveBeenCalledOnce();
});
