/**
 * Runtime type validation helpers for system_config values
 * Prevents runtime errors from unexpected database types
 */

export interface SystemConfig {
  key: string;
  value: unknown;
  description: string | null;
  updated_at: string;
}

/**
 * Get string config with runtime type validation
 * @param configs - Array of system configs
 * @param key - Config key to lookup
 * @param defaultValue - Fallback value if not found or invalid type
 * @returns String value or default
 */
export function getStringConfig(
  configs: SystemConfig[],
  key: string,
  defaultValue: string
): string {
  const config = configs.find(c => c.key === key);
  if (!config) {
    console.warn(`Config key "${key}" not found in database, using default: ${defaultValue}`);
    return defaultValue;
  }
  if (typeof config.value === 'string') {
    return config.value;
  }
  console.warn(
    `Config "${key}" has invalid type: ${typeof config.value}, expected string. Using default: ${defaultValue}`
  );
  return defaultValue;
}

/**
 * Get number config with runtime type validation
 * @param configs - Array of system configs
 * @param key - Config key to lookup
 * @param defaultValue - Fallback value if not found or invalid type
 * @returns Number value or default
 */
export function getNumberConfig(
  configs: SystemConfig[],
  key: string,
  defaultValue: number
): number {
  const config = configs.find(c => c.key === key);
  if (!config) {
    console.warn(`Config key "${key}" not found in database, using default: ${defaultValue}`);
    return defaultValue;
  }
  if (typeof config.value === 'number') {
    return config.value;
  }
  console.warn(
    `Config "${key}" has invalid type: ${typeof config.value}, expected number. Using default: ${defaultValue}`
  );
  return defaultValue;
}

/**
 * Get boolean config with runtime type validation
 * @param configs - Array of system configs
 * @param key - Config key to lookup
 * @param defaultValue - Fallback value if not found or invalid type
 * @returns Boolean value or default
 */
export function getBooleanConfig(
  configs: SystemConfig[],
  key: string,
  defaultValue: boolean
): boolean {
  const config = configs.find(c => c.key === key);
  if (!config) {
    console.warn(`Config key "${key}" not found in database, using default: ${defaultValue}`);
    return defaultValue;
  }
  if (typeof config.value === 'boolean') {
    return config.value;
  }
  console.warn(
    `Config "${key}" has invalid type: ${typeof config.value}, expected boolean. Using default: ${defaultValue}`
  );
  return defaultValue;
}
