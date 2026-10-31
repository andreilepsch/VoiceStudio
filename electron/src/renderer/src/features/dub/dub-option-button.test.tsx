import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { DubOptionButton } from './dub-option-button';
import {
  dubSession,
  setDubProduction,
  setDubQuality,
  setDubTranslationOptions,
  useDubSession,
} from './dub-session';

const original = dubSession.state;
afterEach(() => {
  cleanup();
  dubSession.setState(() => original);
});

function Options({ disabled = false }: { disabled?: boolean }) {
  const session = useDubSession();
  return (
    <>
      {['pt-BR', 'pt-PT'].map((dialect) => (
        <DubOptionButton
          key={dialect}
          selected={session.dialect === dialect}
          disabled={disabled}
          onClick={() => setDubTranslationOptions({ dialect })}
        >
          {dialect}
        </DubOptionButton>
      ))}
      {(['fast', 'cinematic'] as const).map((quality) => (
        <DubOptionButton
          key={quality}
          selected={session.quality === quality}
          onClick={() => setDubQuality(quality)}
        >
          {quality}
        </DubOptionButton>
      ))}
      {(['concise', 'smart_fit'] as const).map((timingStrategy) => (
        <DubOptionButton
          key={timingStrategy}
          selected={session.timingStrategy === timingStrategy}
          onClick={() => setDubProduction({ timingStrategy })}
        >
          {timingStrategy}
        </DubOptionButton>
      ))}
    </>
  );
}

function expectSelected(name: string, selected: boolean) {
  const button = screen.getByRole('button', { name });
  expect(button).toHaveAttribute('aria-pressed', String(selected));
  expect(button).toHaveAttribute('data-variant', selected ? 'default' : 'ghost');
  expect(button.querySelector('[data-slot="selection-indicator"]')).toHaveClass(
    selected ? 'visible' : 'invisible',
  );
}

it('shows the current dialect, quality and timing selection after each change and remount', () => {
  dubSession.setState((state) => ({
    ...state,
    phase: 'editing',
    recovery: null,
    dialect: 'pt-BR',
    quality: 'fast',
    timingStrategy: 'concise',
  }));
  const view = render(<Options />);
  expectSelected('pt-BR', true);
  expectSelected('pt-PT', false);
  fireEvent.click(screen.getByRole('button', { name: 'pt-PT' }));
  expectSelected('pt-BR', false);
  expectSelected('pt-PT', true);
  fireEvent.click(screen.getByRole('button', { name: 'cinematic' }));
  expectSelected('fast', false);
  expectSelected('cinematic', true);
  fireEvent.click(screen.getByRole('button', { name: 'smart_fit' }));
  expectSelected('concise', false);
  expectSelected('smart_fit', true);
  // Clicking a selected choice must not clear a required selection.
  fireEvent.click(screen.getByRole('button', { name: 'pt-PT' }));
  view.unmount();
  render(<Options />);
  expectSelected('pt-PT', true);
  expectSelected('cinematic', true);
  expectSelected('smart_fit', true);
});

it('preserves a disabled selection without allowing another choice', () => {
  dubSession.setState((state) => ({
    ...state,
    phase: 'editing',
    recovery: null,
    dialect: 'pt-BR',
  }));
  render(<Options disabled />);
  const portugal = screen.getByRole('button', { name: 'pt-PT' });
  expect(portugal).toBeDisabled();
  fireEvent.click(portugal);
  expect(dubSession.state.dialect).toBe('pt-BR');
  expectSelected('pt-BR', true);
});
