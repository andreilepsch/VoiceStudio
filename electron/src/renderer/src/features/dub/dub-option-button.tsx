import type { ComponentProps } from 'react';
import { CheckIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

type DubOptionButtonProps = Omit<ComponentProps<typeof Button>, 'variant' | 'aria-pressed'> & {
  selected: boolean;
};

export function DubOptionButton({ selected, children, ...props }: DubOptionButtonProps) {
  return (
    <Button {...props} aria-pressed={selected} variant={selected ? 'default' : 'ghost'}>
      <CheckIcon
        aria-hidden="true"
        data-slot="selection-indicator"
        className={selected ? 'visible size-3.5' : 'invisible size-3.5'}
      />
      {children}
    </Button>
  );
}
