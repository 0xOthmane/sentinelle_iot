import { useCallback, useMemo, useRef, useState, type RefObject } from 'react';
import { fetchHistory, fetchLiveMeasurements } from '@/api/client';
import { API_URL, DEVICE_ID } from '@/constants/config';
import {
  loadCachedLive,
  loadCachedRange,
  saveMeasurementsToCache,
} from '@/db/measurements';
import type { HistoryRange, Measurement } from '@/types';
import { computeHistoryStats } from '@/utils/format';
import { log } from '@/utils/logger';

const LIVE_WINDOW_SECONDS = 600;

export function useMeasurements({
  networkRef,
  setBackend,
}: {
  networkRef: RefObject<boolean>;
  setBackend: (online: boolean) => void;
}) {
  const [temperature, setTemperature] = useState<number | null>(null);
  const [humidity, setHumidity] = useState<number | null>(null);
  const [liveMeasurements, setLiveMeasurements] = useState<Measurement[]>([]);
  const [liveLoading, setLiveLoading] = useState(true);

  const [historyMeasurements, setHistoryMeasurements] = useState<
    Measurement[]
  >([]);
  const [historyRange, setHistoryRange] = useState<HistoryRange>('1h');
  const [historyLoading, setHistoryLoading] = useState(false);
  // Updated synchronously by changeHistoryRange so in-flight loads can tell
  // whether their range is still the selected one.
  const historyRangeRef = useRef<HistoryRange>('1h');
  const latestMeasurementTsRef = useRef<number | null>(null);

  const showLive = useCallback((rows: Measurement[]) => {
    setLiveMeasurements(rows);
    if (rows.length) {
      const last = rows[rows.length - 1];
      latestMeasurementTsRef.current = last.ts;
      setTemperature(last.t);
      setHumidity(last.h);
    }
  }, []);

  const hydrateMeasurements = useCallback(
    (live: Measurement[], history: Measurement[]) => {
      if (live.length) showLive(live);
      if (history.length) setHistoryMeasurements(history);
      setLiveLoading(false);
    },
    [showLive],
  );

  const loadLiveMeasurements = useCallback(
    async (request?: Promise<Measurement[]>) => {
      try {
        const data = await (request ??
          fetchLiveMeasurements(API_URL, DEVICE_ID, LIVE_WINDOW_SECONDS));
        showLive(data);
        setBackend(true);
        await saveMeasurementsToCache(DEVICE_ID, data).catch((error) =>
          log('cache', 'measurements-save', error),
        );
      } catch {
        setBackend(false);
        try {
          const rows = await loadCachedLive(DEVICE_ID, LIVE_WINDOW_SECONDS);
          if (rows.length) showLive(rows);
        } catch (error) {
          log('cache', 'measurements', error);
        }
      } finally {
        setLiveLoading(false);
      }
    },
    [setBackend, showLive],
  );

  const loadCachedHistory = useCallback(async (range: HistoryRange) => {
    try {
      const rows = await loadCachedRange(DEVICE_ID, range);
      if (rows.length) setHistoryMeasurements(rows);
    } catch (error) {
      log('cache', 'history', error);
    }
  }, []);

  const loadHistory = useCallback(
    async (range?: HistoryRange, request?: Promise<Measurement[]>) => {
      const target = range ?? historyRangeRef.current;
      setHistoryLoading(true);
      try {
        const data = await (request ?? fetchHistory(API_URL, DEVICE_ID, target));
        // A range switch while this request was in flight wins.
        if (target === historyRangeRef.current) setHistoryMeasurements(data);
      } catch {
        if (target === historyRangeRef.current) await loadCachedHistory(target);
      } finally {
        setHistoryLoading(false);
      }
    },
    [loadCachedHistory],
  );

  const changeHistoryRange = useCallback(
    (range: HistoryRange) => {
      historyRangeRef.current = range;
      setHistoryRange(range);
      if (networkRef.current) {
        void loadHistory(range);
      } else {
        void loadCachedHistory(range);
      }
    },
    [loadCachedHistory, loadHistory, networkRef],
  );

  const handleMeasurement = useCallback(async (m: Measurement) => {
    if (
      latestMeasurementTsRef.current !== null &&
      m.ts <= latestMeasurementTsRef.current
    ) {
      return;
    }
    latestMeasurementTsRef.current = m.ts;
    setTemperature(m.t);
    setHumidity(m.h);
    setLiveMeasurements((previous) => {
      const minTs = Math.floor(Date.now() / 1000) - LIVE_WINDOW_SECONDS;
      return [...previous, m]
        .filter((item) => item.ts >= minTs)
        .sort((a, b) => a.ts - b.ts);
    });
    await saveMeasurementsToCache(DEVICE_ID, [m]);
  }, []);

  const historyStats = useMemo(
    () => computeHistoryStats(historyMeasurements),
    [historyMeasurements],
  );

  const lastMeasurement =
    liveMeasurements.length > 0
      ? liveMeasurements[liveMeasurements.length - 1]
      : null;

  return {
    temperature,
    humidity,
    liveMeasurements,
    lastMeasurement,
    liveLoading,
    historyMeasurements,
    historyStats,
    historyRange,
    historyLoading,
    historyRangeRef,
    hydrateMeasurements,
    loadLiveMeasurements,
    loadHistory,
    loadCachedHistory,
    changeHistoryRange,
    handleMeasurement,
  };
}
