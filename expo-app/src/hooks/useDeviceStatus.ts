import { useCallback, useState } from 'react';
import { fetchDevices } from '@/api/client';
import { API_URL, DEVICE_ID, GROUP_NAME } from '@/constants/config';
import { saveDeviceToCache } from '@/db/devices';
import { addJournalEntry } from '@/db/journal';
import type { Device } from '@/types';

type DeviceStatus = 'online' | 'offline';

export function useDeviceStatus({
  setBackend,
  refreshJournal,
}: {
  setBackend: (online: boolean) => void;
  refreshJournal: () => Promise<void>;
}) {
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus>('offline');

  const hydrateDeviceStatus = useCallback((cached: DeviceStatus | null) => {
    if (cached) setDeviceStatus(cached);
  }, []);

  const loadDevices = useCallback(
    async (request?: Promise<Device[]>) => {
      try {
        const devices = await (request ?? fetchDevices(API_URL));
        const device = devices.find((item) => item.id === DEVICE_ID);
        if (device) {
          setDeviceStatus(device.status);
          await saveDeviceToCache(device);
        }
        setBackend(true);
      } catch {
        setBackend(false);
      }
    },
    [setBackend],
  );

  const handleDeviceStatus = useCallback(
    async (status: DeviceStatus) => {
      setDeviceStatus(status);
      await saveDeviceToCache({ id: DEVICE_ID, group: GROUP_NAME, status });
      await addJournalEntry(
        'device_status',
        DEVICE_ID,
        `Capteur ${status === 'online' ? 'en ligne' : 'hors ligne'}`,
      );
      await refreshJournal();
    },
    [refreshJournal],
  );

  return { deviceStatus, hydrateDeviceStatus, loadDevices, handleDeviceStatus };
}
