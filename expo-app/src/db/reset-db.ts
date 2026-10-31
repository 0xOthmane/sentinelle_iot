import { getDatabase } from './database';

const TABLES = [
  'measurements_cache',
  'devices_cache',
  'command_queue',
  'journal',
  'thresholds_cache',
  'app_settings',
];

export async function resetDatabase() {
  try {
    const db = await getDatabase();

    // sqlite_sequence only exists once a row was inserted into a table that
    // uses AUTOINCREMENT; deleting it unconditionally would abort the wipe.
    const hasSequence = await db.getFirstAsync<{ name: string }>(
      `SELECT name FROM sqlite_master
       WHERE type = 'table' AND name = 'sqlite_sequence'`,
    );

    await db.withTransactionAsync(async () => {
      for (const table of TABLES) {
        await db.execAsync(`DELETE FROM ${table}`);
      }
      if (hasSequence) {
        await db.execAsync('DELETE FROM sqlite_sequence');
      }
    });

    await db.execAsync('VACUUM');

    console.log('✅ Database reset successfully');
  } catch (error) {
    console.error('❌ Failed to reset database:', error);
    throw error;
  }
}
