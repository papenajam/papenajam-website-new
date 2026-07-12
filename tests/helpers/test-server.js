import { spawn } from 'node:child_process';
import { once } from 'node:events';
import net from 'node:net';

import { resolveContractDatabaseSafety } from './mongodb-safety.js';

const DEFAULT_HOST = '127.0.0.1';
const START_TIMEOUT_MS = 120_000;

function getMongoUri() {
  return process.env.MONGODB_URI || process.env.MONGO_URL || '';
}

async function reservePort(host = DEFAULT_HOST) {
  const server = net.createServer();
  server.unref();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, host, resolve);
  });
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : null;
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  if (!port) throw new Error('Unable to reserve a port for the contract test server');
  return port;
}

async function waitForServer(url, child, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastError;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Contract test server exited before becoming ready (exit ${child.exitCode})`);
    }
    try {
      const response = await fetch(`${url}/api/__contract_ready__`);
      if (response.status === 404) {
        const body = await response.json().catch(() => null);
        if (body?.error === 'Route tidak ditemukan') return;
      }
      const body = await response.text().catch(() => '');
      lastError = new Error(`Readiness probe returned ${response.status}: ${body}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }

  throw new Error(`Timed out waiting for contract test server: ${lastError?.message || 'unknown error'}`);
}

export async function startTestServer(options = {}) {
  const mongoUri = options.mongoUri || getMongoUri();
  if (!mongoUri) {
    throw new Error('MONGODB_URI is required to start the MongoDB contract test server');
  }

  const dbName = resolveContractDatabaseSafety({
    dbName: options.dbName || process.env.MONGODB_DB_NAME,
    destructiveOptIn: options.destructiveOptIn ?? process.env.MONGODB_CONTRACT_ALLOW_DESTRUCTIVE,
  });
  const host = options.host || DEFAULT_HOST;
  const port = options.port || await reservePort(host);
  const baseUrl = `http://${host}:${port}`;
  const parsedMongoUri = new URL(mongoUri);
  if (!['mongodb:', 'mongodb+srv:'].includes(parsedMongoUri.protocol)) {
    throw new Error('MONGODB_URI must use the mongodb:// or mongodb+srv:// scheme');
  }

  const child = spawn(
    process.execPath,
    ['node_modules/next/dist/bin/next', 'dev', '--hostname', host, '--port', String(port)],
    {
      cwd: options.cwd || process.cwd(),
      env: {
        ...process.env,
        MONGO_URL: mongoUri,
        DB_NAME: dbName,
        JWT_SECRET: options.jwtSecret || process.env.JWT_SECRET || 'contract-test-secret',
        NEXT_TELEMETRY_DISABLED: '1',
      },
      stdio: options.stdio || 'inherit',
    },
  );

  try {
    await waitForServer(baseUrl, child, options.timeoutMs || START_TIMEOUT_MS);
  } catch (error) {
    child.kill('SIGTERM');
    throw error;
  }

  return {
    baseUrl,
    dbName,
    process: child,
    async stop() {
      if (child.exitCode !== null) return;
      const exited = once(child, 'exit');
      child.kill('SIGTERM');
      let forceTimer;
      const forceKill = new Promise(resolve => {
        forceTimer = setTimeout(() => {
          if (child.exitCode === null) child.kill('SIGKILL');
          resolve('forced');
        }, 5_000);
      });
      const result = await Promise.race([exited.then(() => 'exited'), forceKill]);
      clearTimeout(forceTimer);
      if (result === 'forced' && child.exitCode === null) await exited;
    },
  };
}
