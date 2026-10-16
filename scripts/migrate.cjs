const { loadEnvFile } = require('node:process');
const { readFileSync, readdirSync } = require('node:fs');
const { resolve } = require('node:path');
const { createHash } = require('node:crypto');
const { Client } = require('pg');

const root = resolve(__dirname, '..');
try {
  loadEnvFile(resolve(root, '.env'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

async function main() {
  const command = process.argv[2] || 'up';
  if (!['up', 'down', 'status'].includes(command)) {
    throw new Error('Usage: node scripts/migrate.cjs [up|down|status]');
  }
  for (const key of ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD']) {
    if (
      process.env[key] === undefined ||
      (key !== 'DB_PASSWORD' && !process.env[key])
    ) {
      throw new Error(`Missing ${key}`);
    }
  }
  const migrations = readdirSync(resolve(root, 'database'))
    .filter((name) => /^\d+[-_].+\.sql$/.test(name))
    .sort()
    .map((name) => {
      const sql = readFileSync(resolve(root, 'database', name), 'utf8');
      return {
        name,
        sql,
        checksum: createHash('sha256').update(sql).digest('hex'),
      };
    });
  const client = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectionTimeoutMillis: 10000,
  });
  await client.connect();
  try {
    // The session lock serializes migration commands across backend instances.
    await client.query('SELECT pg_advisory_lock(728194025)');
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      checksum TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    const { rows: applied } = await client.query(
      'SELECT name, checksum FROM schema_migrations ORDER BY name',
    );
    for (let index = 0; index < applied.length; index++) {
      const migration = migrations[index];
      if (!migration || migration.name !== applied[index].name) {
        throw new Error(
          'Migration history differs from local files. Restore missing files and append new migrations in order.',
        );
      }
      if (migration.checksum !== applied[index].checksum) {
        throw new Error(`Applied migration was modified: ${migration.name}`);
      }
    }
    if (command === 'status') {
      for (const [index, migration] of migrations.entries()) {
        console.log(
          `${index < applied.length ? 'applied' : 'pending'}  ${migration.name}`,
        );
      }
      return;
    }
    const pending =
      command === 'up'
        ? migrations.slice(applied.length)
        : applied.length
          ? [migrations[applied.length - 1]]
          : [];
    for (const migration of pending) {
      const sql =
        command === 'up'
          ? migration.sql
          : readFileSync(
              resolve(root, 'database', 'rollback', migration.name),
              'utf8',
            );
      await client.query('BEGIN');
      try {
        await client.query(sql);
        if (command === 'up') {
          await client.query(
            'INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)',
            [migration.name, migration.checksum],
          );
        } else {
          await client.query('DELETE FROM schema_migrations WHERE name = $1', [
            migration.name,
          ]);
        }
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
      console.log(
        `${command === 'up' ? 'Applied' : 'Rolled back'} ${migration.name}`,
      );
    }
    if (!pending.length) console.log('No migrations to run.');
  } finally {
    // Closing the connection releases the advisory lock, including on failure.
    await client.end();
  }
}

main().catch((error) => {
  console.error(`Migration failed: ${error.message}`);
  process.exitCode = 1;
});
