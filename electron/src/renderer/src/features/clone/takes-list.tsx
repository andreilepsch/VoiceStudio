import { ChevronRightIcon, Trash2Icon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ProfileAvatar } from '@/components/profile-avatar';
import { SaveAudioButton } from '@/components/save-audio-button';
import { WaveformPlayer } from '@/components/waveform-player';
import { useDeleteHistoryItem, useHistory } from '@/hooks/use-history';
import { useProfiles } from '@/hooks/use-profiles';
import { audioUrl } from '@/lib/api/client';
import type { HistoryItem } from '@/lib/api/types';
import { activePlaybackSource, stopActivePlayback } from '@/lib/audio/playback';
import { cn } from '@/lib/utils';
import { ConfirmDialog } from './confirm-dialog';
import { displayTitle, formatRelative } from './format';

export type TakeMode = 'clone' | 'design';

/** Older backends stored only the first 200 characters of a take's script. */
const LEGACY_TEXT_LIMIT = 200;

function stampOf(item: HistoryItem): number {
  const raw = item.created_at;
  if (typeof raw === 'number') return raw;
  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? 0 : parsed / 1000;
}

function matchesMode(item: HistoryItem, mode: TakeMode): boolean {
  return mode === 'design' ? item.mode === 'design' : !item.mode || item.mode === 'clone';
}

export function normalizeScript(text: string | null | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}

export interface TakeGroup {
  /** Normalized script shared by every take in the group. */
  key: string;
  /** Best full text to show for the group. */
  text: string;
  /** Newest first. */
  items: HistoryItem[];
  /** Take id → position in generation order within this text (#1 = first). */
  numbers: Map<string, number>;
  isCurrent: boolean;
  latestStamp: number;
}

/**
 * Every saved take for this workspace grouped by its exact script. Each group
 * numbers its takes in generation order, so "#2" means the second render of
 * that text. The group matching the script in the editor comes first.
 */
export function useTakeGroups(mode: TakeMode, currentText?: string) {
  const history = useHistory();
  return useMemo(() => {
    const items = (history.data ?? [])
      .filter((item) => item.audio_path && matchesMode(item, mode))
      .sort((a, b) => stampOf(a) - stampOf(b)); // oldest first while grouping
    const current = normalizeScript(currentText);
    const groups = new Map<string, TakeGroup>();
    const ensure = (key: string, text: string) => {
      let group = groups.get(key);
      if (!group) {
        group = {
          key,
          text,
          items: [],
          numbers: new Map(),
          isCurrent: Boolean(current) && key === current,
          latestStamp: 0,
        };
        groups.set(key, group);
      }
      return group;
    };
    const fullKeys = new Set(
      items
        .filter((item) => (item.text ?? '').length !== LEGACY_TEXT_LIMIT)
        .map((item) => normalizeScript(item.text)),
    );
    if (current) fullKeys.add(current);
    for (const item of items) {
      let key = normalizeScript(item.text);
      if ((item.text ?? '').length === LEGACY_TEXT_LIMIT) {
        // A legacy row only kept a prefix: attach it to the full script it starts.
        const owners = [...fullKeys].filter((full) => full !== key && full.startsWith(key));
        const owner = owners.includes(current) ? current : owners.length === 1 ? owners[0] : null;
        if (owner) key = owner;
      }
      const group = ensure(key, key === current && currentText ? currentText.trim() : item.text);
      if (group.text.length < (item.text ?? '').length) group.text = item.text;
      group.items.push(item);
      group.numbers.set(item.id, group.items.length);
      group.latestStamp = Math.max(group.latestStamp, stampOf(item));
    }
    const ordered = [...groups.values()]
      .map((group) => ({ ...group, items: [...group.items].reverse() }))
      .sort((a, b) =>
        a.isCurrent !== b.isCurrent ? (a.isCurrent ? -1 : 1) : b.latestStamp - a.latestStamp,
      );
    const byTake = new Map<string, TakeGroup>();
    for (const group of ordered) for (const item of group.items) byTake.set(item.id, group);
    return { groups: ordered, byTake, isPending: history.isPending };
  }, [history.data, history.isPending, mode, currentText]);
}

/** Delete a take (row + WAV) after confirmation; stops it first if it is playing. */
export function useDeleteTake(onDeleted?: (id: string) => void) {
  const { t } = useTranslation();
  const deleteItem = useDeleteHistoryItem();
  const [pending, setPending] = useState<string | null>(null);
  const dialog = (
    <ConfirmDialog
      open={pending !== null}
      onOpenChange={(open) => {
        if (!open) setPending(null);
      }}
      title={t('clone.history_delete')}
      description={t('clone.take_delete_confirm')}
      confirmLabel={t('common.delete')}
      destructive
      onConfirm={async () => {
        const id = pending;
        setPending(null);
        if (!id) return;
        const source = activePlaybackSource();
        if (source === 'take-' + id || (onDeleted && source === 'output')) stopActivePlayback();
        await deleteItem.mutateAsync(id).catch(() => {});
        onDeleted?.(id);
      }}
    />
  );
  return { requestDelete: setPending, dialog };
}

export function DeleteTakeButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <Button
      variant="ghost"
      size="icon-xs"
      className="text-muted-foreground hover:text-destructive"
      aria-label={t('clone.history_delete')}
      title={t('clone.history_delete')}
      onClick={onClick}
    >
      <Trash2Icon />
    </Button>
  );
}

/** Which voice rendered a take: the saved profile, or a generic clone/design label. */
export function TakeVoice({ item, className }: { item: HistoryItem; className?: string }) {
  const { t } = useTranslation();
  const profiles = useProfiles();
  const voice = item.profile_id
    ? profiles.data?.find((profile) => profile.id === item.profile_id)
    : undefined;
  const name =
    voice?.name ?? t(item.mode === 'design' ? 'projects.designed_voice' : 'projects.cloned_voice');
  return (
    <span
      className={cn('flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground', className)}
      title={t('clone.take_voice', { name })}
    >
      <ProfileAvatar name={name} imageUrl={voice?.image_url} className="size-5 text-[9px]" />
      <span className="truncate">{name}</span>
    </span>
  );
}

function TakeRow({
  item,
  number,
  onDelete,
}: {
  item: HistoryItem;
  number: number | undefined;
  onDelete: () => void;
}) {
  const { i18n } = useTranslation();
  return (
    <li
      className="flex min-w-0 items-center gap-2"
      title={formatRelative(item.created_at, i18n.language)}
    >
      <span className="w-7 shrink-0 text-right font-mono text-xs text-muted-foreground tabular-nums">
        #{number}
      </span>
      <TakeVoice item={item} className="w-36 shrink-0" />
      <WaveformPlayer
        key={'take-player-' + item.id}
        src={audioUrl(item.audio_path)}
        source={'take-' + item.id}
        height={24}
        compact
        className="min-w-0 flex-1"
      />
      <SaveAudioButton
        iconOnly
        url={audioUrl(item.audio_path)}
        suggestedName={`voicestudio-${number ?? ''}-${item.id}.wav`}
      />
      <DeleteTakeButton onClick={onDelete} />
    </li>
  );
}

export function TakesList({
  mode,
  excludeId,
  currentText,
}: {
  mode: TakeMode;
  excludeId?: string | null;
  currentText?: string;
}) {
  const { t } = useTranslation();
  const { groups } = useTakeGroups(mode, currentText);
  const { requestDelete, dialog } = useDeleteTake();
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const visible = groups
    .map((group) => ({ group, rows: group.items.filter((item) => item.id !== excludeId) }))
    .filter(({ rows }) => rows.length > 0);
  if (!visible.length) return dialog;

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-medium text-muted-foreground">{t('clone.takes_by_text')}</p>
      <div className="flex max-h-56 flex-col gap-2 overflow-y-auto pr-1">
        {visible.map(({ group, rows }, index) => {
          const expanded = open[group.key] ?? (group.isCurrent || index === 0);
          return (
            <section
              key={group.key}
              className={cn(
                'rounded-lg border border-border/50 bg-muted/10',
                group.isCurrent && 'border-primary/40',
              )}
            >
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => setOpen((prev) => ({ ...prev, [group.key]: !expanded }))}
                className="flex w-full min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                title={group.text}
              >
                <ChevronRightIcon
                  className={cn(
                    'size-3.5 shrink-0 text-muted-foreground transition-transform',
                    expanded && 'rotate-90',
                  )}
                  aria-hidden="true"
                />
                {group.isCurrent ? (
                  <span className="shrink-0 rounded bg-primary/15 px-1.5 py-0.5 font-medium text-primary">
                    {t('clone.current_text')}
                  </span>
                ) : null}
                <span className="min-w-0 flex-1 truncate text-foreground/80">
                  {displayTitle(group.text)}
                </span>
                <span className="shrink-0 text-muted-foreground tabular-nums">
                  {t('clone.takes_count', { count: group.items.length })}
                </span>
              </button>
              {expanded ? (
                <ul className="flex flex-col gap-1.5 px-2 pb-2">
                  {rows.map((item) => (
                    <TakeRow
                      key={item.id}
                      item={item}
                      number={group.numbers.get(item.id)}
                      onDelete={() => requestDelete(item.id)}
                    />
                  ))}
                </ul>
              ) : null}
            </section>
          );
        })}
      </div>
      {dialog}
    </div>
  );
}
