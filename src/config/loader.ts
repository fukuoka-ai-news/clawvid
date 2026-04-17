import fsExtra from 'fs-extra';
const { readJson, pathExists } = fsExtra;
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { configSchema, type Config } from '../schemas/config.js';
import { preferencesSchema, type Preferences } from '../schemas/preferences.js';
import { defaults } from './defaults.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('config');

export interface AppConfig extends Config {
  preferences?: Preferences;
  /** Absolute path where config was loaded from (used to resolve avatar reference image, etc.) */
  _configRoot?: string;
}

/**
 * Returns the clawvid install root (where this package lives), resolved from
 * the module's own location. Stable regardless of process.cwd().
 */
export function getClawvidRoot(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  // dist/config/loader.js → ../../ = repo root
  return resolve(__dirname, '../..');
}

export async function loadConfig(rootDir?: string): Promise<AppConfig> {
  const cwdRoot = rootDir ?? process.cwd();
  const clawvidRoot = getClawvidRoot();

  // Search order: explicit rootDir / cwd → clawvid install root
  const searchRoots = [cwdRoot, clawvidRoot].filter((p, i, arr) => arr.indexOf(p) === i);

  let rawConfig: unknown;
  let loadedRoot: string | undefined;
  let prefsPath: string | undefined;

  for (const root of searchRoots) {
    const candidate = join(root, 'config.json');
    if (await pathExists(candidate)) {
      rawConfig = await readJson(candidate);
      loadedRoot = root;
      prefsPath = join(root, 'preferences.json');
      log.info('Loaded config.json', { from: candidate });
      break;
    }
  }

  if (!rawConfig) {
    log.warn('config.json not found in any search root, using defaults', { searchRoots });
    rawConfig = defaults;
    loadedRoot = clawvidRoot;
    prefsPath = join(clawvidRoot, 'preferences.json');
  }

  const config = configSchema.parse(rawConfig);

  let preferences: Preferences | undefined;
  if (prefsPath && await pathExists(prefsPath)) {
    const rawPrefs = await readJson(prefsPath);
    preferences = preferencesSchema.parse(rawPrefs);
    log.info('Loaded preferences.json');
  }

  return { ...config, preferences, _configRoot: loadedRoot };
}

export function resolveModelId(config: AppConfig, category: 'image' | 'video', alias: string): string {
  const models = category === 'image' ? config.fal.image : config.fal.video;
  const resolved = (models as Record<string, string>)[alias];
  if (!resolved) throw new Error(`Unknown ${category} model alias: ${alias}`);
  return resolved;
}
