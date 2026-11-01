import { useCallback, useMemo, useRef, useState } from 'react';
import { fetchActiveAlerts } from '@/api/client';
import type { SnapshotAlert } from '@/api/websocket';
import {
  ALERT_AUTOMATION_RECENCY_SECONDS,
  API_URL,
  DEVICE_ID,
} from '@/constants/config';
import { addJournalEntry } from '@/db/journal';
import type { AlertEvent } from '@/types';
import { describeAlert, formatAlertKind } from '@/utils/format';
import { log } from '@/utils/logger';

type AlertMap = ReadonlyMap<string, AlertEvent>;

function toAlertEvent(alert: AlertEvent | SnapshotAlert): AlertEvent {
  return {
    kind: alert.kind,
    value: alert.value,
    threshold: alert.threshold,
    ts: alert.ts,
  };
}

/** The alert shown in the UI: the most recent one still active. */
function pickDisplayed(alerts: AlertMap): AlertEvent | null {
  let latest: AlertEvent | null = null;
  for (const alert of alerts.values()) {
    if (!latest || (alert.ts ?? 0) >= (latest.ts ?? 0)) latest = alert;
  }
  return latest;
}

export function useAlertSync({
  refreshJournal,
  notifyLocal,
  enqueueLedCommand,
  automationLedOff,
}: {
  refreshJournal: () => Promise<void>;
  notifyLocal: (title: string, body: string) => Promise<void>;
  enqueueLedCommand: (
    target: boolean,
    opts: { automatic: boolean; reason: string },
  ) => Promise<void>;
  automationLedOff: (reason: string) => Promise<void>;
}) {
  // Several thresholds can be violated at once (e.g. hot and humid): alerts
  // are tracked per kind so clearing one never hides the others.
  const [activeAlerts, setActiveAlerts] = useState<AlertMap>(new Map());
  const activeAlertsRef = useRef<AlertMap>(new Map());
  // WS onOpen, NetInfo and refreshAll can overlap: never run two HTTP
  // alert syncs concurrently (concurrent journal writes crash expo-sqlite).
  const syncingAlertsRef = useRef(false);

  // Single setter keeps the ref (read by async WS callbacks) in sync.
  const commit = useCallback((next: AlertMap) => {
    activeAlertsRef.current = next;
    setActiveAlerts(next);
  }, []);

  const raise = useCallback(
    async (alert: AlertEvent, suffix: string, source: string | null) => {
      const text = describeAlert(alert);
      await addJournalEntry('alert', DEVICE_ID, `${text}${suffix}`);
      await refreshJournal();
      await notifyLocal('Alerte dans la chambre', text);
      // Only automate recent alerts: a stale alert recovered on reconnect
      // still updates the UI, but must not flip the night light for an
      // hours-old event. Missing ts counts as recent (live-like frame).
      const nowSec = Math.floor(Date.now() / 1000);
      const ageSec = nowSec - (alert.ts ?? nowSec);
      if (ageSec <= ALERT_AUTOMATION_RECENCY_SECONDS) {
        await enqueueLedCommand(true, {
          automatic: true,
          reason: `alerte ${alert.kind}${source ? ` (resync ${source})` : ''}`,
        });
      } else {
        log('ws', `stale alert ${alert.kind}: UI only, no command`);
      }
    },
    [enqueueLedCommand, notifyLocal, refreshJournal],
  );

  const clear = useCallback(
    async (kind: string, suffix: string) => {
      await addJournalEntry(
        'alert_cleared',
        DEVICE_ID,
        `Retour à la normale (${formatAlertKind(kind)})${suffix}`,
      );
      await refreshJournal();
    },
    [refreshJournal],
  );

  // Reconcile server-known active alerts with local state. Used by both the
  // WS snapshot (push) and GET /alerts/active (poll) so a missed "alert" or
  // "alert_cleared" frame is recovered on every reconnect/refresh. Journals,
  // notifies and automates only on per-kind transitions to avoid spam.
  const applySyncedAlerts = useCallback(
    async (alerts: (AlertEvent | SnapshotAlert)[], source: string) => {
      const previous = activeAlertsRef.current;
      const next = new Map<string, AlertEvent>();
      for (const alert of alerts) next.set(alert.kind, toAlertEvent(alert));

      const added = [...next.values()].filter((a) => !previous.has(a.kind));
      const removed = [...previous.keys()].filter((kind) => !next.has(kind));
      commit(next);

      try {
        for (const kind of removed) await clear(kind, ` (resync ${source})`);
        for (const alert of added) {
          await raise(alert, ` (resync ${source})`, source);
        }
        if (removed.length && next.size === 0) {
          await automationLedOff(`retour normale (resync ${source})`);
        }
      } catch (error) {
        log('cache', `alert-sync-${source}`, error);
      }
    },
    [automationLedOff, clear, commit, raise],
  );

  const loadActiveAlerts = useCallback(
    async (request?: Promise<AlertEvent[]>) => {
      if (syncingAlertsRef.current) return;
      syncingAlertsRef.current = true;
      try {
        const alerts = await (request ?? fetchActiveAlerts(API_URL, DEVICE_ID));
        await applySyncedAlerts(alerts, 'http');
      } catch (error) {
        log('net', 'active-alerts', error);
      } finally {
        syncingAlertsRef.current = false;
      }
    },
    [applySyncedAlerts],
  );

  const handleAlert = useCallback(
    async (alertData: AlertEvent) => {
      const previous = activeAlertsRef.current;
      const alreadyActive = previous.has(alertData.kind);
      commit(new Map(previous).set(alertData.kind, toAlertEvent(alertData)));
      if (!alreadyActive) await raise(alertData, '', null);
    },
    [commit, raise],
  );

  const handleAlertCleared = useCallback(
    async (kind: string) => {
      const previous = activeAlertsRef.current;
      if (!previous.has(kind)) return;
      const next = new Map(previous);
      next.delete(kind);
      commit(next);
      await clear(kind, '');
      // The night light stays on while another threshold is still violated.
      if (next.size === 0) await automationLedOff('retour normale');
    },
    [automationLedOff, clear, commit],
  );

  /** Clears in-memory state after the local database was wiped. */
  const resetAlerts = useCallback(() => commit(new Map()), [commit]);

  const activeAlert = useMemo(() => pickDisplayed(activeAlerts), [activeAlerts]);

  return {
    activeAlert,
    applySyncedAlerts,
    loadActiveAlerts,
    handleAlert,
    handleAlertCleared,
    resetAlerts,
  };
}
