import { mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const defaultRoot = resolve(process.env.LOCALAPPDATA ?? process.cwd(), 'SovetOnline')
export const dataRoot = resolve(process.env.SOVET_ONLINE_DATA_DIR ?? defaultRoot)
export const backupRoot = join(dataRoot, 'backups')
export const secretsRoot = join(dataRoot, 'secrets')
export const postgresRoot = join(dataRoot, 'PostgreSQL17')
export const postgresBin = join(postgresRoot, 'pgsql', 'bin')
export const postgresData = join(dataRoot, 'postgres-data')
export const postgresLog = join(dataRoot, 'logs', 'postgresql.log')
export const databaseConfigPath = join(secretsRoot, 'database.json')

for (const directory of [backupRoot, secretsRoot, join(dataRoot, 'logs')]) {
  mkdirSync(directory, { recursive: true })
}
