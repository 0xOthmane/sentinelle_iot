import { useCallback, useState } from 'react';
import { listJournalItems } from '@/db/journal';
import type { JournalItem } from '@/types';
import { log } from '@/utils/logger';

export function useJournal() {
  const [journalItems, setJournalItems] = useState<JournalItem[]>([]);

  const refreshJournal = useCallback(async () => {
    try {
      setJournalItems(await listJournalItems());
    } catch (error) {
      log('cache', 'journal', error);
    }
  }, []);

  return { journalItems, refreshJournal };
}
