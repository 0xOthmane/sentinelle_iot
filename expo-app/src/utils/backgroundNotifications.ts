import * as TaskManager from 'expo-task-manager';

export const BACKGROUND_NOTIFICATION_TASK = 'sentinelle-background-notifications';

if (!TaskManager.isTaskDefined(BACKGROUND_NOTIFICATION_TASK)) {
  TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async ({ data, error }) => {
    if (error) {
      console.warn('[NOTIFICATIONS] Background task failed', error);
      return;
    }
    if (data) {
      console.log('[NOTIFICATIONS] Background notification received');
    }
  });
}
