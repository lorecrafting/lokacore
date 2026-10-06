import type { SQLiteDatabase } from 'expo-sqlite';
import type { Db } from '../authority/local-story/store.ts';

/** Keep growing query results out of Expo's fixed synchronous worker response buffer. */
export function webDb(db: SQLiteDatabase): Db {
  return {
    execSync: (sql) => db.execSync(sql),
    runSync: (sql, ...params) => db.runSync(sql, ...params),
    getFirstSync: (sql, ...params) => db.getFirstSync(sql, ...params),
    getAllSync<T>(sql: string, ...params: (string | number | null)[]): T[] {
      if (!/^\s*SELECT\b/i.test(sql)) return db.getAllSync<T>(sql, ...params);
      const rows: T[] = [];
      // ponytail: each 64-row page must still fit Expo's fixed worker response buffer.
      for (let offset = 0; ; offset += 64) {
        const page = db.getAllSync<T>(
          `SELECT * FROM (${sql}) LIMIT 64 OFFSET ${offset}`,
          ...params,
        );
        rows.push(...page);
        if (page.length < 64) return rows;
      }
    },
    isInTransactionSync: () => db.isInTransactionSync(),
  };
}
