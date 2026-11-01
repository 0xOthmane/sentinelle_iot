import * as Crypto from 'expo-crypto';
import { useCallback, useRef, useState, type RefObject } from 'react';
import { HttpError, postCommand } from '@/api/client';
import { API_URL, DEVICE_ID } from '@/constants/config';
import {
  addCommand,
  incrementCommandAttempts,
  pruneCommands,
  takeLatestPendingCommand,
  updateCommandStatus,
  type QueuedCommand,
} from '@/db/commands';
import { addJournalEntry } from '@/db/journal';
import { log } from '@/utils/logger';

type LedCommandOptions = { automatic: boolean; reason: string };

export function useCommandQueue({
  networkRef,
  refreshJournal,
}: {
  networkRef: RefObject<boolean>;
  refreshJournal: () => Promise<void>;
}) {
  const [ledOn, setLedOn] = useState(false);
  // True until the newest command has been accepted by the API.
  const [ledPending, setLedPending] = useState(false);

  // Mirrors ledOn for WS/journal callbacks (which close over stale state);
  // every setLedOn call below updates it alongside the state.
  const ledOnRef = useRef(false);
  // True when the last LED change came from alert automation (not the user).
  // Auto-OFF on clear only runs while this is set, so a manual ON is never
  // overridden.
  const autoLedRef = useRef(false);
  // Only the newest command may clear the pending indicator.
  const latestIdRef = useRef<string | null>(null);
  const isFlushingRef = useRef(false);
  const flushAgainRef = useRef(false);

  /** Restores LED state from the newest persisted command (newest first). */
  const hydrateCommands = useCallback((commands: QueuedCommand[]) => {
    if (!commands.length) return;
    const last = commands[0];
    latestIdRef.current = last.id;
    ledOnRef.current = last.led;
    setLedOn(last.led);
    setLedPending(last.status === 'pending');
  }, []);

  /**
   * Delivery is confirmed when the API accepted the command and published
   * it to MQTT (`202 { sent: true }`); the firmware sends no ack. Returns
   * false when the command must stay pending for a later retry.
   */
  const sendCommand = useCallback(
    async (command: QueuedCommand): Promise<boolean> => {
      const isLatest = () => latestIdRef.current === command.id;
      try {
        await incrementCommandAttempts(command.id);
        const { sent } = await postCommand(API_URL, command.device, {
          id: command.id,
          led: command.led,
        });
        if (!sent) {
          // API reachable but its MQTT link is down: retry on reconnect.
          log('net', `command ${command.id} not published (broker down)`);
          return false;
        }
        await updateCommandStatus(command.id, 'acked');
        if (isLatest()) setLedPending(false);
        return true;
      } catch (error) {
        if (error instanceof HttpError && error.isClientError) {
          // Rejected (e.g. unknown device): retrying cannot succeed.
          await updateCommandStatus(command.id, 'failed');
          if (isLatest()) setLedPending(false);
          await addJournalEntry(
            'command',
            DEVICE_ID,
            `Commande refusée par le serveur (${error.status})`,
          );
          await refreshJournal();
          return true;
        }
        log('net', `command ${command.id}`, error);
        return false;
      }
    },
    [refreshJournal],
  );

  // Sends the newest pending command (older ones are superseded). Calls made
  // while a flush runs are coalesced into one more pass, so a command queued
  // during an in-flight send is never left behind.
  const flushCommandQueue = useCallback(async () => {
    if (!networkRef.current) return;
    if (isFlushingRef.current) {
      flushAgainRef.current = true;
      return;
    }
    isFlushingRef.current = true;
    try {
      do {
        flushAgainRef.current = false;
        const command = await takeLatestPendingCommand();
        if (!command) break;
        const done = await sendCommand(command);
        if (!done) break;
      } while (flushAgainRef.current && networkRef.current);
      await pruneCommands();
    } catch (error) {
      log('cache', 'commands', error);
    } finally {
      isFlushingRef.current = false;
    }
  }, [networkRef, sendCommand]);

  // Shared enqueue flow for manual toggles and alert automation: persist to
  // the offline queue, journal the intent, and send immediately when online
  // (otherwise flushCommandQueue sends the latest one on reconnect).
  const enqueueLedCommand = useCallback(
    async (target: boolean, opts: LedCommandOptions): Promise<void> => {
      if (ledOnRef.current === target) {
        log('ws', `led already ${target ? 'ON' : 'OFF'} (${opts.reason})`);
        return;
      }

      const command: QueuedCommand = {
        id: `c-${Crypto.randomUUID()}`,
        device: DEVICE_ID,
        led: target,
        status: 'pending',
        attempts: 0,
        createdAt: Math.floor(Date.now() / 1000),
      };

      ledOnRef.current = target;
      latestIdRef.current = command.id;
      setLedOn(target);
      setLedPending(true);
      autoLedRef.current = opts.automatic && target;

      try {
        await addCommand(command);
        await addJournalEntry(
          'command',
          DEVICE_ID,
          `Veilleuse ${target ? 'ON' : 'OFF'} — ${opts.automatic ? `auto (${opts.reason})` : 'manuel'}`,
        );
        await refreshJournal();
      } catch (error) {
        log('cache', 'command-queue', error);
      }

      // Single send path: the flush picks this (newest) command, so it is
      // never posted twice by an enqueue and a concurrent reconnect replay.
      await flushCommandQueue();
    },
    [flushCommandQueue, refreshJournal],
  );

  // Turn the night light back off only if automation turned it on: a manual
  // ON by the user must never be overridden by a clearing alert.
  const automationLedOff = useCallback(
    async (reason: string): Promise<void> => {
      if (!autoLedRef.current) return;
      autoLedRef.current = false;
      await enqueueLedCommand(false, { automatic: true, reason });
    },
    [enqueueLedCommand],
  );

  const toggleLed = useCallback(async () => {
    autoLedRef.current = false;
    await enqueueLedCommand(!ledOnRef.current, {
      automatic: false,
      reason: 'manual',
    });
  }, [enqueueLedCommand]);

  const handleCommandAcked = useCallback(
    async (id: string) => {
      await updateCommandStatus(id, 'acked');
      if (latestIdRef.current === id) setLedPending(false);
      await addJournalEntry(
        'command',
        DEVICE_ID,
        `Commande ${id} confirmée — acked`,
      );
      await refreshJournal();
    },
    [refreshJournal],
  );

  /** Clears in-memory state after the local database was wiped. */
  const resetCommands = useCallback(() => {
    latestIdRef.current = null;
    autoLedRef.current = false;
    ledOnRef.current = false;
    setLedOn(false);
    setLedPending(false);
  }, []);

  return {
    ledOn,
    ledPending,
    hydrateCommands,
    flushCommandQueue,
    enqueueLedCommand,
    automationLedOff,
    toggleLed,
    handleCommandAcked,
    resetCommands,
  };
}
