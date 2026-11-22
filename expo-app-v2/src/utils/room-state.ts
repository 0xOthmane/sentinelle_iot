import type {
  AlertEvent,
  LiveConnectionState,
  LiveDeviceStatus,
  RoomState,
  Thresholds,
} from '@/types';

export function formatAlertKind(kind: string): string {
  if (kind === 'tMax') return 'Température trop élevée';
  if (kind === 'tMin') return 'Température trop basse';
  if (kind === 'hMax') return 'Humidité trop élevée';
  if (kind === 'hMin') return 'Humidité trop basse';
  return kind;
}

export function describeAlert(alert: AlertEvent): string {
  const kind = formatAlertKind(alert.kind);

  if (alert.value == null || alert.threshold == null) {
    return `${kind} hors seuil`;
  }

  return `${kind} : ${alert.value.toFixed(1)} (seuil ${alert.threshold})`;
}

/** The alert shown in the UI: the most recent unacknowledged one. */
export function latestAlert(
  alerts: Record<string, AlertEvent>,
  acknowledgedAlerts: Record<string, boolean>,
): AlertEvent | null {
  let latest: AlertEvent | null = null;

  for (const kind of Object.keys(alerts)) {
    if (acknowledgedAlerts[kind]) continue;
    const alert = alerts[kind];
    if (!latest || (alert.ts ?? 0) >= (latest.ts ?? 0)) latest = alert;
  }

  return latest;
}

export function deriveRoomState({
  alerts,
  acknowledgedAlerts,
  temperature,
  humidity,
  thresholds,
  configured,
  thresholdsReady,
}: {
  alerts: Record<string, AlertEvent>;
  acknowledgedAlerts: Record<string, boolean>;
  temperature: number | null;
  humidity: number | null;
  thresholds: Thresholds;
  configured: boolean;
  thresholdsReady: boolean;
}): RoomState {
  const alert = latestAlert(alerts, acknowledgedAlerts);
  if (alert) {
    return { kind: 'alert', title: 'Alerte', text: describeAlert(alert) };
  }

  // Acknowledged alerts remain active server-side, but the app no longer
  // treats them as an active alarm.
  if (Object.keys(alerts).length > 0) {
    return {
      kind: 'calm',
      title: 'Alerte acquittée',
      text: 'La surveillance continue.',
    };
  }

  if (!thresholdsReady) {
    return {
      kind: 'calm',
      title: 'En attente',
      text: 'Chargement des seuils de confort…',
    };
  }

  // The backend raises no alerts until thresholds are stored; showing a
  // warning against defaults would claim surveillance that is not running.
  if (!configured) {
    return {
      kind: 'calm',
      title: 'Seuils à définir',
      text: 'Renseigne les seuils pour activer la surveillance.',
    };
  }

  if (temperature == null || humidity == null) {
    return {
      kind: 'calm',
      title: 'En attente',
      text: 'Aucune mesure disponible pour le moment.',
    };
  }

  const temperatureOut =
    temperature < thresholds.tMin || temperature > thresholds.tMax;
  const humidityOut =
    (thresholds.hMin != null && humidity < thresholds.hMin) ||
    (thresholds.hMax != null && humidity > thresholds.hMax);

  if (temperatureOut || humidityOut) {
    return {
      kind: 'warning',
      title: 'À surveiller',
      text: `Hors seuil — alerte après ${thresholds.holdSeconds} s`,
    };
  }

  return {
    kind: 'good',
    title: 'Tout va bien',
    text: 'La chambre est calme et confortable.',
  };
}

export function connectionLabel(
  connection: LiveConnectionState,
  deviceStatus: LiveDeviceStatus,
): string {
  if (connection === 'open') {
    if (deviceStatus === 'online') return 'En direct';
    if (deviceStatus === 'offline') return 'Capteur hors ligne';
    return 'Connecté';
  }
  if (connection === 'connecting') return 'Connexion…';
  if (connection === 'reconnecting') return 'Reconnexion…';
  return 'Hors ligne';
}

export function isLiveConnected(
  connection: LiveConnectionState,
  deviceStatus: LiveDeviceStatus,
): boolean {
  return connection === 'open' && deviceStatus === 'online';
}
