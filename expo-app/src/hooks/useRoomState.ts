import { useMemo } from 'react';
import type { AlertEvent, RoomState, Thresholds } from '@/types';
import { describeAlert } from '@/utils/format';

export function useRoomState(
  activeAlert: AlertEvent | null,
  temperature: number | null,
  humidity: number | null,
  thresholds: Thresholds,
): RoomState {
  return useMemo<RoomState>(() => {
    if (activeAlert) {
      return {
        kind: 'alert',
        title: 'Alerte',
        text: describeAlert(activeAlert),
      };
    }

    if (temperature == null || humidity == null) {
      return {
        kind: 'neutral',
        title: 'En attente',
        text: 'Aucune mesure disponible',
      };
    }

    const tempOut =
      temperature < thresholds.tMin || temperature > thresholds.tMax;

    const humOut =
      (thresholds.hMin != null && humidity < thresholds.hMin) ||
      (thresholds.hMax != null && humidity > thresholds.hMax);

    if (tempOut || humOut) {
      return {
        kind: 'warning',
        title: 'À surveiller',
        text: `Hors seuil — alerte après ${thresholds.holdMinutes} min`,
      };
    }

    return {
      kind: 'good',
      title: 'Tout va bien',
      text: 'Conditions dans la plage définie',
    };
  }, [activeAlert, temperature, humidity, thresholds]);
}
