import {
  useCallback,
  useRef,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from 'react';
import { Alert } from 'react-native';
import { fetchThresholds, HttpError, putThresholds } from '@/api/client';
import {
  API_URL,
  DEFAULT_THRESHOLDS,
  DEVICE_ID,
  defaultThresholdForm,
} from '@/constants/config';
import { addJournalEntry } from '@/db/journal';
import {
  loadCachedThresholds,
  loadDirtyThresholds,
  saveThresholdsToCache,
} from '@/db/thresholdsCache';
import type { ThresholdForm, Thresholds } from '@/types';
import { log } from '@/utils/logger';
import { parseThresholdForm, thresholdsToForm } from '@/utils/thresholds';

export function useThresholds({
  networkRef,
  backendRef,
  refreshJournal,
}: {
  networkRef: RefObject<boolean>;
  backendRef: RefObject<boolean>;
  refreshJournal: () => Promise<void>;
}) {
  const [thresholds, setThresholds] = useState<Thresholds>({
    ...DEFAULT_THRESHOLDS,
  });
  const [thresholdForm, setThresholdForm] = useState<ThresholdForm>(
    defaultThresholdForm,
  );
  const [thresholdDirty, setThresholdDirty] = useState(false);
  const [thresholdLoading, setThresholdLoading] = useState(false);
  // WS onOpen and NetInfo reconnect both trigger a replay: without this the
  // same PUT and journal entry would run twice.
  const syncingRef = useRef(false);
  // True while the user has unsaved edits in the Settings form: background
  // refreshes then update the applied thresholds but leave the form alone.
  const formEditedRef = useRef(false);

  const applyThresholds = useCallback(
    (value: Thresholds, dirty: boolean, opts?: { resetForm?: boolean }) => {
      setThresholds(value);
      if (opts?.resetForm) formEditedRef.current = false;
      if (!formEditedRef.current) setThresholdForm(thresholdsToForm(value));
      setThresholdDirty(dirty);
    },
    [],
  );

  const editThresholdForm = useCallback<
    Dispatch<SetStateAction<ThresholdForm>>
  >((update) => {
    formEditedRef.current = true;
    setThresholdForm(update);
  }, []);

  // A 400 means the server will never accept these values: drop the pending
  // edit and fall back to the server copy instead of re-sending it forever.
  const discardRejectedThresholds = useCallback(
    async (rejected: Thresholds) => {
      try {
        const { value } = await fetchThresholds(API_URL, DEVICE_ID);
        applyThresholds(value, false, { resetForm: true });
        await saveThresholdsToCache(DEVICE_ID, value, false);
      } catch {
        await saveThresholdsToCache(DEVICE_ID, rejected, false);
        setThresholdDirty(false);
      }
      await addJournalEntry(
        'thresholds',
        DEVICE_ID,
        'Seuils refusés par le serveur — valeurs non appliquées',
      );
      await refreshJournal();
    },
    [applyThresholds, refreshJournal],
  );

  const syncDirtyThresholds = useCallback(
    async (journalMessage = 'Seuils hors ligne rejoués et confirmés') => {
      if (syncingRef.current) return;
      syncingRef.current = true;
      let dirty: Thresholds | null = null;
      try {
        dirty = await loadDirtyThresholds(DEVICE_ID);
        if (!dirty) return;
        const saved = await putThresholds(API_URL, DEVICE_ID, dirty);
        applyThresholds(saved, false);
        await saveThresholdsToCache(DEVICE_ID, saved, false);
        await addJournalEntry('thresholds', DEVICE_ID, journalMessage);
        await refreshJournal();
      } catch (error) {
        // 404 = sensor not known by the API yet: keep it pending, it will
        // succeed once the sensor has published once.
        if (dirty && error instanceof HttpError && error.status === 400) {
          await discardRejectedThresholds(dirty).catch((e) =>
            log('thresholds', 'discard', e),
          );
        } else {
          log('thresholds', 'replay', error);
        }
      } finally {
        syncingRef.current = false;
      }
    },
    [applyThresholds, discardRejectedThresholds, refreshJournal],
  );

  const loadThresholds = useCallback(async () => {
    setThresholdLoading(true);
    try {
      // Unsynced local edits win over the server copy until they are replayed.
      let dirty: Thresholds | null = null;
      try {
        dirty = await loadDirtyThresholds(DEVICE_ID);
      } catch (error) {
        log('cache', 'thresholds-dirty', error);
      }
      if (dirty) {
        applyThresholds(dirty, true);
        return;
      }

      const { value, configured } = await fetchThresholds(API_URL, DEVICE_ID);
      if (configured) {
        applyThresholds(value, false);
        await saveThresholdsToCache(DEVICE_ID, value, false);
        return;
      }

      // Server has no thresholds, so it raises no alerts: queue the app
      // defaults as a pending edit and push them so the UI never shows
      // limits the backend isn't enforcing.
      applyThresholds(value, true);
      await saveThresholdsToCache(DEVICE_ID, value, true);
      await syncDirtyThresholds('Seuils par défaut envoyés au serveur');
    } catch (error) {
      log('net', 'thresholds', error);
      try {
        const cached = await loadCachedThresholds(DEVICE_ID);
        if (cached) applyThresholds(cached.value, cached.dirty);
      } catch (cacheError) {
        log('cache', 'thresholds', cacheError);
      }
    } finally {
      setThresholdLoading(false);
    }
  }, [applyThresholds, syncDirtyThresholds]);

  const saveThresholdSettings = useCallback(async () => {
    const parsed = parseThresholdForm(thresholdForm);
    if ('error' in parsed) {
      Alert.alert(parsed.error.title, parsed.error.message);
      return;
    }
    const value = parsed.value;
    setThresholds(value);

    if (!networkRef.current || !backendRef.current) {
      try {
        await saveThresholdsToCache(DEVICE_ID, value, true);
        setThresholdDirty(true);
        await addJournalEntry(
          'thresholds',
          DEVICE_ID,
          'Seuils modifiés hors ligne — synchronisation en attente',
        );
        await refreshJournal();
      } catch (error) {
        log('cache', 'thresholds-offline', error);
      }
      Alert.alert(
        'Enregistré hors ligne',
        'Les seuils seront envoyés automatiquement au retour du réseau.',
      );
      return;
    }

    setThresholdLoading(true);
    try {
      const saved = await putThresholds(API_URL, DEVICE_ID, value);
      applyThresholds(saved, false);
      await saveThresholdsToCache(DEVICE_ID, saved, false);
      await addJournalEntry(
        'thresholds',
        DEVICE_ID,
        `Seuils synchronisés — délai ${saved.holdMinutes} min`,
      );
      await refreshJournal();
      Alert.alert('Enregistré', 'Les seuils ont été mis à jour.');
    } catch {
      try {
        await saveThresholdsToCache(DEVICE_ID, value, true);
      } catch (error) {
        log('cache', 'thresholds-fallback', error);
      }
      setThresholdDirty(true);
      Alert.alert(
        'Connexion perdue',
        'Les seuils sont conservés localement.',
      );
    } finally {
      setThresholdLoading(false);
    }
  }, [
    thresholdForm,
    networkRef,
    backendRef,
    applyThresholds,
    refreshJournal,
  ]);

  return {
    thresholds,
    thresholdForm,
    setThresholdForm,
    thresholdDirty,
    thresholdLoading,
    applyThresholds,
    loadThresholds,
    syncDirtyThresholds,
    saveThresholdSettings,
  };
}
