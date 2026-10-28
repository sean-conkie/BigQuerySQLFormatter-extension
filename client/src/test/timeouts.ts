export function timeoutFromEnvironment(name: string, fallback: number): number {
  const value = process.env[name];
  if (value === undefined) return fallback;
  const timeout = Number(value);
  if (!Number.isSafeInteger(timeout) || timeout <= 0 || timeout > 2147483647) {
    throw new Error(`${name} must be a positive integer no greater than 2147483647, got ${JSON.stringify(value)}`);
  }
  return timeout;
}

export const coldStartTimeout = timeoutFromEnvironment('BQSQL_TEST_COLD_START_TIMEOUT_MS', 60000);
export const phaseTimeout = timeoutFromEnvironment('BQSQL_TEST_TIMEOUT_MS', 15000);
export const testTimeout = Math.max(100000, coldStartTimeout + phaseTimeout + 25000);
