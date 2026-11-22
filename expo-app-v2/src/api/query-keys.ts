export const queryKeys = {
  all: ['api'] as const,
  devices: () => [...queryKeys.all, 'devices'] as const,
  measurements: (deviceId: string) =>
    [...queryKeys.all, 'measurements', deviceId] as const,
  liveMeasurements: (deviceId: string, windowSeconds: number) =>
    [...queryKeys.measurements(deviceId), 'live', windowSeconds] as const,
  history: (deviceId: string, range: string) =>
    [...queryKeys.measurements(deviceId), 'history', range] as const,
  thresholds: (deviceId: string) =>
    [...queryKeys.all, 'thresholds', deviceId] as const,
  activeAlerts: (deviceId: string) =>
    [...queryKeys.all, 'alerts', 'active', deviceId] as const,
  wsTicket: () => [...queryKeys.all, 'ws-ticket'] as const,
};