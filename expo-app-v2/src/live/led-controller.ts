import * as Sentry from '@sentry/react-native';

import { postCommand } from '@/api/client';
import {
  ALERT_AUTOMATION_RECENCY_SECONDS,
  API_URL,
  DEVICE_ID,
  LED_BLINK_INTERVAL_MS,
} from '@/constants/config';
import { useLiveStore } from '@/stores/live-store';
import type { AlertEvent } from '@/types';

let blinkTimer: ReturnType<typeof setInterval> | null = null;
let inFlight = false;
let latestTarget: boolean | null = null;
let latestReason = '';
let requestSeq = 0;
let lastSent: boolean | null = null;

function createCommandId(): string {
  return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function describeError(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

function isRecentAlert(alert: AlertEvent): boolean {
  // A missing timestamp counts as live: the backend includes it for every
  // alert it raises, so this is only a fallback for defensive frames.
  if (alert.ts == null) return true;
  const now = Math.floor(Date.now() / 1000);
  return now - alert.ts <= ALERT_AUTOMATION_RECENCY_SECONDS;
}

function unacknowledgedAlerts(
  alerts: Record<string, AlertEvent>,
  acknowledged: Record<string, boolean>,
): AlertEvent[] {
  return Object.keys(alerts)
    .filter((kind) => !acknowledged[kind])
    .map((kind) => alerts[kind]);
}

function hasUnacknowledgedAlert(
  alerts: Record<string, AlertEvent>,
  acknowledged: Record<string, boolean>,
): boolean {
  return Object.keys(alerts).some((kind) => !acknowledged[kind]);
}

function hasRecentUnacknowledgedAlert(
  alerts: Record<string, AlertEvent>,
  acknowledged: Record<string, boolean>,
): boolean {
  return unacknowledgedAlerts(alerts, acknowledged).some(isRecentAlert);
}

function revertLed(message: string, reason: string): void {
  const previous = lastSent ?? false;
  const state = useLiveStore.getState();

  state.setLedState({
    ledOn: previous,
    ledPending: false,
    ledManualHold: false,
  });

  // A failed manual ON during an alert must not leave the night light dark:
  // fall back to the alert blink.
  if (hasRecentUnacknowledgedAlert(state.activeAlerts, state.acknowledgedAlerts)) {
    startBlinking();
  }

  Sentry.logger.warn('LED command failed', {
    deviceId: DEVICE_ID,
    reason,
    message,
  });
}

async function pump(): Promise<void> {
  if (inFlight) return;
  inFlight = true;

  try {
    while (latestTarget !== null) {
      const target = latestTarget;
      latestTarget = null;
      const request = ++requestSeq;

      try {
        const { sent } = await postCommand(API_URL, DEVICE_ID, {
          id: createCommandId(),
          led: target,
        });

        // A newer request replaced this one while it was in flight.
        if (request !== requestSeq) continue;

        if (sent) {
          lastSent = target;
          useLiveStore.getState().setLedState({ ledPending: false });
        } else {
          revertLed('Command was not published by the API', latestReason);
        }
      } catch (error) {
        if (request !== requestSeq) continue;
        revertLed(describeError(error), latestReason);
      }
    }
  } finally {
    inFlight = false;
  }
}

/** Queue a desired LED state. Latest request wins if commands overlap. */
export function requestLed(target: boolean, reason: string): void {
  const store = useLiveStore.getState();

  if (store.ledOn === target && !store.ledPending) return;

  store.setLedState({ ledOn: target, ledPending: true });
  latestTarget = target;
  latestReason = reason;
  void pump();
}

function startBlinking(): void {
  if (blinkTimer !== null) return;

  const store = useLiveStore.getState();
  if (store.ledManualHold) return;

  blinkTimer = setInterval(() => {
    const current = useLiveStore.getState();
    if (current.ledManualHold) {
      stopBlinking();
      return;
    }
    void requestLed(!current.ledOn, 'alert-blink');
  }, LED_BLINK_INTERVAL_MS);

  // Make the alert visible immediately instead of waiting a full interval.
  if (!store.ledOn) {
    void requestLed(true, 'alert-blink');
  }
}

function stopBlinking(): void {
  if (blinkTimer !== null) {
    clearInterval(blinkTimer);
    blinkTimer = null;
  }
}

/**
 * Manual toggle from the UI. An active alert overrides a manual OFF, while a
 * manual ON during an alert holds and is not turned off when the alert clears.
 */
export function requestManualLed(target: boolean): void {
  const store = useLiveStore.getState();
  const anyAlertActive = hasUnacknowledgedAlert(
    store.activeAlerts,
    store.acknowledgedAlerts,
  );
  const recentAlertActive = hasRecentUnacknowledgedAlert(
    store.activeAlerts,
    store.acknowledgedAlerts,
  );

  if (target) {
    if (anyAlertActive) {
      store.setLedState({ ledManualHold: true });
      stopBlinking();
    }
    void requestLed(true, 'manual');
    return;
  }

  store.setLedState({ ledManualHold: false });

  if (recentAlertActive) {
    // The alert blink takes over; do not send the transient manual OFF.
    startBlinking();
    return;
  }

  void requestLed(false, 'manual');
}

/**
 * Reconcile the LED with alert transitions. Called by the connection layer
 * after the store's alert map changes.
 */
export function syncLedFromAlerts(
  previous: Record<string, AlertEvent>,
  next: Record<string, AlertEvent>,
): void {
  const store = useLiveStore.getState();
  const unacknowledgedNext = Object.keys(next).filter(
    (kind) => !store.acknowledgedAlerts[kind],
  );
  const unacknowledgedPrevious = Object.keys(previous).filter(
    (kind) => !store.acknowledgedAlerts[kind],
  );
  const addedKinds = unacknowledgedNext.filter((kind) => !(kind in previous));
  const hasRecentAlert = addedKinds.some((kind) => isRecentAlert(next[kind]));
  const hasAnyAlert = unacknowledgedNext.length > 0;
  const hadAnyAlert = unacknowledgedPrevious.length > 0;

  if (hasAnyAlert && hasRecentAlert && !store.ledManualHold) {
    startBlinking();
  } else if (store.ledManualHold) {
    stopBlinking();
  }

  if (!hasAnyAlert) {
    // A snapshot/clear with no alert transition must not touch a manual LED.
    if (!hadAnyAlert) return;

    stopBlinking();

    const current = useLiveStore.getState();
    if (current.ledManualHold) {
      // The manual ON survives this alert, but the override episode is over.
      current.setLedState({ ledManualHold: false });
    } else {
      void requestLed(false, 'alert-cleared');
    }
  }
}

/** Acknowledge every active alert: stop blinking and turn the LED off. */
export function acknowledgeAlert(): void {
  const store = useLiveStore.getState();
  store.acknowledgeAlerts();
  stopBlinking();
  store.setLedState({ ledManualHold: false });
  void requestLed(false, 'acknowledge');
}

/** Cancel blink timers and ignore any in-flight command after logout. */
export function resetLedController(): void {
  stopBlinking();
  requestSeq += 1;
  latestTarget = null;
  lastSent = null;
}
