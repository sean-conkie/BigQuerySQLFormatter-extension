import type { _Connection } from 'vscode-languageserver/node';
import { readFile } from 'node:fs/promises';
import { dirname, join, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseRuleOptions, type OptionValue } from './ruleOptions';

export const ruleGroups = [
  'aliasing',
  'ambiguous',
  'capitalisation',
  'convention',
  'layout',
  'references',
  'structure',
] as const;
export type RuleGroup = (typeof ruleGroups)[number];
export type RuleCode = `${'AL' | 'AM' | 'CP' | 'CV' | 'LT' | 'RF' | 'ST'}${number}`;
export type Severity = 'error' | 'warning' | 'information' | 'hint' | 'off';
export interface RuleConfiguration {
  enabled?: boolean;
  severity?: Severity;
  options?: Record<string, OptionValue>;
}
export type RulesSettings = Partial<Record<RuleCode, RuleConfiguration>> & {
  exclude?: string[];
  groups?: Partial<Record<RuleGroup, boolean>>;
};

/**
 * Interface representing the settings for the server.
 */
export interface ServerSettings {
  maxNumberOfProblems: number;
  rules?: RulesSettings;
}

/**
 * Default server settings.
 *
 * @constant
 * @type {ServerSettings}
 * @property {number} maxNumberOfProblems - The maximum number of problems allowed.
 */
export const defaultSettings: ServerSettings = { maxNumberOfProblems: 100 };

/**
 * A map that holds document settings for the server.
 * The key is a string representing the document URI.
 * The value is a Thenable that resolves to the server settings for the document.
 */
export const documentSettings: Map<string, Thenable<ServerSettings>> = new Map();

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseSettings(
  value: unknown,
  reportOptionError: (message: string) => void = (message) => {
    throw new Error(message);
  },
): Partial<ServerSettings> {
  if (!isObject(value)) throw new Error('Configuration must be an object');
  const { maxNumberOfProblems, rules } = value;
  if (
    maxNumberOfProblems !== undefined &&
    (typeof maxNumberOfProblems !== 'number' || !Number.isInteger(maxNumberOfProblems) || maxNumberOfProblems < 0)
  ) {
    throw new Error('maxNumberOfProblems must be a non-negative integer');
  }
  const result: Partial<ServerSettings> = {};
  if (typeof maxNumberOfProblems === 'number') result.maxNumberOfProblems = maxNumberOfProblems;
  if (rules === undefined) return result;
  if (!isObject(rules)) throw new Error('rules must be an object');
  const parsed: RulesSettings = {};
  for (const [key, setting] of Object.entries(rules)) {
    if (key === 'exclude') {
      if (
        !Array.isArray(setting) ||
        !setting.every((code) => typeof code === 'string' && /^(AL|AM|CP|CV|LT|RF|ST)\d{2}$/.test(code))
      ) {
        throw new Error('rules.exclude must be an array of uppercase rule codes');
      }
      parsed.exclude = setting;
    } else if (key === 'groups') {
      if (!isObject(setting)) throw new Error('rules.groups must be an object');
      const groups: Partial<Record<RuleGroup, boolean>> = {};
      for (const [group, enabled] of Object.entries(setting)) {
        if (!ruleGroups.some((name) => name === group) || typeof enabled !== 'boolean') {
          throw new Error(`Invalid rule group setting: ${group}`);
        }
        groups[group as RuleGroup] = enabled;
      }
      parsed.groups = groups;
    } else {
      if (!/^(AL|AM|CP|CV|LT|RF|ST)\d{2}$/.test(key) || !isObject(setting)) {
        throw new Error(`Invalid rule setting: ${key}`);
      }
      const config: RuleConfiguration = {};
      for (const [option, optionValue] of Object.entries(setting)) {
        if (option === 'enabled' && typeof optionValue === 'boolean') {
          config.enabled = optionValue;
        } else if (
          option === 'severity' &&
          (optionValue === 'error' ||
            optionValue === 'warning' ||
            optionValue === 'information' ||
            optionValue === 'hint' ||
            optionValue === 'off')
        ) {
          config.severity = optionValue;
        } else if (option === 'options') {
          config.options = parseRuleOptions(key, optionValue, reportOptionError);
        } else {
          throw new Error(`Invalid rules.${key}.${option}`);
        }
      }
      parsed[key as RuleCode] = config;
    }
  }
  result.rules = parsed;
  return result;
}

export function mergeSettings(base: ServerSettings, overrides: Partial<ServerSettings>): ServerSettings {
  const result = { ...base, ...overrides };
  if (!base.rules && !overrides.rules) return result;
  result.rules = { ...base.rules, ...overrides.rules };
  for (const key of Object.keys(overrides.rules ?? {})) {
    if (/^(AL|AM|CP|CV|LT|RF|ST)\d{2}$/.test(key)) {
      const code = key as RuleCode;
      result.rules[code] = { ...base.rules?.[code], ...overrides.rules?.[code] };
      if (base.rules?.[code]?.options || overrides.rules?.[code]?.options) {
        result.rules[code].options = { ...base.rules?.[code]?.options, ...overrides.rules?.[code]?.options };
      }
    }
  }
  if (base.rules?.groups || overrides.rules?.groups) {
    result.rules.groups = { ...base.rules?.groups, ...overrides.rules?.groups };
  }
  return result;
}

export function isRuleEnabled(settings: ServerSettings, code: string, group: string, defaultEnabled = true): boolean {
  const rules = settings.rules;
  const config = rules?.[code as RuleCode];
  return (
    rules?.groups?.[group as RuleGroup] !== false &&
    !rules?.exclude?.includes(code) &&
    (config?.enabled ?? defaultEnabled) &&
    config?.severity !== 'off'
  );
}

export async function getProjectSettings(
  resource: string,
  workspaceUris: readonly string[],
  reportOptionError?: (message: string) => void,
): Promise<Partial<ServerSettings>> {
  if (!resource.startsWith('file:')) return {};
  let directory = dirname(fileURLToPath(resource));
  const roots = workspaceUris.filter((uri) => uri.startsWith('file:')).map((uri) => fileURLToPath(uri));
  const root =
    roots
      .filter((candidate) => {
        const path = relative(candidate, directory);
        return path === '' || (path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path));
      })
      .sort((a, b) => b.length - a.length)[0] ?? directory;
  while (true) {
    const configPath = join(directory, '.bqsqlformatter.json');
    let content: string;
    try {
      content = await readFile(configPath, 'utf8');
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
      if (directory === root) return {};
      directory = dirname(directory);
      continue;
    }
    try {
      const value: unknown = JSON.parse(content);
      if (isObject(value)) {
        const blocked = Object.keys(value).filter(
          (key) => key === 'bigquery' || key.startsWith('bigquery.') || key.startsWith('bigquerySQLFormatter.bigquery'),
        );
        if (blocked.length > 0) {
          const message = `Ignored BigQuery settings in ${configPath}: use VS Code settings, workspace trust and consent instead.`;
          if (reportOptionError) reportOptionError(message);
          else throw new Error(message);
          for (const key of blocked) delete value[key];
        }
      }
      if (
        !isObject(value) ||
        Object.keys(value).some((key) => !['rules', 'maxNumberOfProblems', '$schema'].includes(key))
      ) {
        throw new Error('Expected an object containing rules and/or maxNumberOfProblems');
      }
      return parseSettings(value, (message) => {
        if (reportOptionError) reportOptionError(`Invalid ${configPath}: ${message}`);
        else throw new Error(message);
      });
    } catch (error) {
      throw new Error(`Invalid ${configPath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

/**
 * Retrieves the document-specific settings for the given resource.
 *
 * @param resource - The URI of the resource for which settings are being requested.
 * @param connection - The connection to the client.
 * @param globalSettings - The global settings to use if the client does not support configuration capabilities.
 * @param hasConfigurationCapability - A boolean indicating if the client supports configuration capabilities.
 * @returns A promise that resolves to the server settings for the given resource.
 */
export function getDocumentSettings(
  resource: string,
  connection: _Connection,
  globalSettings: ServerSettings,
  hasConfigurationCapability: boolean,
  workspaceUris: readonly string[] = [],
  reportOptionError?: (message: string) => void,
): Thenable<ServerSettings> {
  let result = documentSettings.get(resource);
  if (!result) {
    result = (async () => {
      const settings = hasConfigurationCapability
        ? mergeSettings(
            defaultSettings,
            parseSettings(
              (await connection.workspace.getConfiguration({
                scopeUri: resource,
                section: 'bigquerySQLFormatter',
              })) ?? {},
              reportOptionError,
            ),
          )
        : globalSettings;
      return mergeSettings(settings, await getProjectSettings(resource, workspaceUris, reportOptionError));
    })();
    documentSettings.set(resource, result);
  }
  return result;
}
