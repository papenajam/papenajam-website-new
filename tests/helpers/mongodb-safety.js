import { randomBytes } from 'node:crypto';

export const CONTRACT_DB_PREFIX = 'pa_penajam_contract_test_';
export const DESTRUCTIVE_OPT_IN_ENV = 'MONGODB_CONTRACT_ALLOW_DESTRUCTIVE';

const SAFE_DATABASE_NAME = /^pa_penajam_contract_test_[1-9]\d*_[1-9]\d{12}_[0-9a-f]{8}$/;
const UNSAFE_DATABASE_NAMES = new Set([
  'admin',
  'config',
  'local',
  'pa_penajam',
  'pa_penajam_contract',
  'production',
  'prod',
  'test',
]);

export function generateContractDatabaseName({
  pid = process.pid,
  now = Date.now(),
  random = randomBytes(4).toString('hex'),
} = {}) {
  return `${CONTRACT_DB_PREFIX}${pid}_${now}_${random}`;
}

export function validateContractDatabaseSafety({ dbName, destructiveOptIn } = {}) {
  const normalizedName = typeof dbName === 'string' ? dbName.trim() : '';
  const optIn = typeof destructiveOptIn === 'string' ? destructiveOptIn.trim().toLowerCase() : '';

  if (optIn !== 'true') {
    throw new Error(
      `Refusing destructive MongoDB contract test: set ${DESTRUCTIVE_OPT_IN_ENV}=true only for a disposable test database.`,
    );
  }
  if (!normalizedName || UNSAFE_DATABASE_NAMES.has(normalizedName.toLowerCase()) || !SAFE_DATABASE_NAME.test(normalizedName)) {
    throw new Error(
      `Refusing destructive MongoDB contract test: database name must match ${CONTRACT_DB_PREFIX}<pid>_<13-digit-timestamp>_<8-hex-random>.`,
    );
  }

  return normalizedName;
}

export function resolveContractDatabaseSafety({ dbName, destructiveOptIn } = {}) {
  const resolvedName = dbName || generateContractDatabaseName();
  return validateContractDatabaseSafety({
    dbName: resolvedName,
    destructiveOptIn,
  });
}
