import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { DubExportPanel } from './dub-export-panel';
import { dubSession, useDubSession } from './dub-session';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const original = dubSession.state;
afterEach(() => {
  cleanup();
  dubSession.setState(() => original);
});

function Panel() {
  return <DubExportPanel session={useDubSession()} disabled={false} />;
}

function mount(tracks: string[] = []) {
  dubSession.setState((state) => ({
    ...state,
    jobId: 'export-test',
    inputType: 'audio',
    phase: 'editing',
    recovery: null,
    segments: [],
    tracks,
    exportOptions: { format: 'mp3', bitrate: '192' },
  }));
  render(<Panel />);
  fireEvent.click(screen.getByText('exportModal.export_options'));
}

it('explains missing generated audio instead of presenting an empty language selector', () => {
  mount();
  expect(screen.getByText('exportModal.generate_before_export')).toBeVisible();
  expect(screen.queryByText('exportModal.languages')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'exportModal.export' })).toBeDisabled();
});

it('shows selected format, language and bitrate and enables export only when a track exists', () => {
  mount(['pt', 'es']);
  for (const name of ['exportModal.mp3_compressed', 'PT', '192 kbps']) {
    expect(screen.getByRole('button', { name })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name })).toHaveAttribute('data-variant', 'default');
  }
  fireEvent.click(screen.getByRole('button', { name: '128 kbps' }));
  expect(screen.getByRole('button', { name: '128 kbps' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('button', { name: '192 kbps' })).toHaveAttribute('aria-pressed', 'false');
  fireEvent.click(screen.getByRole('button', { name: 'ES' }));
  expect(screen.getByRole('button', { name: 'ES' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('button', { name: 'PT' })).toHaveAttribute('aria-pressed', 'false');
  fireEvent.click(screen.getByRole('button', { name: 'exportModal.wav_lossless' }));
  expect(dubSession.state.exportOptions).toMatchObject({
    format: 'wav',
    track: 'es',
    bitrate: '128',
  });
  expect(screen.getByRole('button', { name: 'exportModal.export' })).toBeEnabled();
});
