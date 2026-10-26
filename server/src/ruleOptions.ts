export type OptionValue = string | number | boolean;

export interface OptionDefinition<T extends OptionValue = OptionValue> {
  type: 'string' | 'number' | 'integer' | 'boolean';
  enum?: readonly T[];
  default: T;
}

export type OptionDefinitions = Readonly<Record<string, OptionDefinition>>;
export type CapitalisationPolicy = 'lower' | 'upper' | 'consistent';

export const capitalisationOptions = {
  capitalisation_policy: {
    type: 'string',
    enum: ['lower', 'upper', 'consistent'],
    default: 'lower',
  } satisfies OptionDefinition<CapitalisationPolicy>,
} as const;

export const ruleOptionSchemas: Readonly<Record<string, OptionDefinitions>> = {
  CP01: capitalisationOptions,
  CP02: capitalisationOptions,
  CP04: capitalisationOptions,
};

export function isValidOption<T extends OptionValue>(definition: OptionDefinition<T>, value: unknown): value is T {
  const validType =
    definition.type === 'integer'
      ? typeof value === 'number' && Number.isInteger(value)
      : typeof value === definition.type && (typeof value !== 'number' || Number.isFinite(value));
  return validType && (!definition.enum || definition.enum.some((allowed) => allowed === value));
}

export function optionDefaults(definitions: OptionDefinitions): Record<string, OptionValue> {
  return Object.fromEntries(Object.entries(definitions).map(([name, definition]) => [name, definition.default]));
}

export function resolveOption<T extends OptionValue>(definition: OptionDefinition<T>, value: unknown): T {
  return isValidOption(definition, value) ? value : definition.default;
}

export function parseRuleOptions(
  code: string,
  value: unknown,
  reportError: (message: string) => void,
): Record<string, OptionValue> {
  const definitions = ruleOptionSchemas[code] ?? {};
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    reportError(`Invalid rules.${code}.options: expected an object; using rule option defaults`);
    return optionDefaults(definitions);
  }
  const options: Record<string, OptionValue> = {};
  for (const [name, option] of Object.entries(value)) {
    if (!Object.hasOwn(definitions, name) || !isValidOption(definitions[name], option)) {
      reportError(`Invalid rules.${code}.options.${name}; using rule option defaults`);
      return optionDefaults(definitions);
    }
    options[name] = option;
  }
  return options;
}
