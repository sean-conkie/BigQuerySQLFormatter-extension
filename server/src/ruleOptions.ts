export type OptionValue = string | number | boolean | readonly string[];

export type OptionDefinition<T extends OptionValue = OptionValue> =
  | {
      type: 'string' | 'number' | 'integer' | 'boolean';
      enum?: readonly T[];
      default: T;
    }
  | {
      type: 'array';
      items: { readonly type: 'string' };
      default: T & readonly string[];
    };

export const stringListOption = {
  type: 'array',
  items: { type: 'string' },
  default: [],
} as const satisfies OptionDefinition<readonly string[]>;

export type OptionDefinitions = Readonly<Record<string, OptionDefinition>>;
export type CapitalisationPolicy = 'lower' | 'upper' | 'consistent';
export type IdentifierPolicy = 'none' | 'aliases' | 'column_aliases' | 'table_aliases' | 'all';
export const identifierPolicyOption = {
  type: 'string',
  enum: ['none', 'aliases', 'column_aliases', 'table_aliases', 'all'],
  default: 'all',
} as const satisfies OptionDefinition<IdentifierPolicy>;

export const keywordIdentifierOptions = {
  unquoted_identifiers_policy: {
    ...identifierPolicyOption,
    enum: ['aliases', 'column_aliases', 'table_aliases', 'all'],
    default: 'aliases',
  },
  quoted_identifiers_policy: { ...identifierPolicyOption, default: 'none' },
  ignore_words: stringListOption,
} as const;

export const specialCharacterOptions = {
  quoted_identifiers_policy: identifierPolicyOption,
  allow_space_in_identifier: { type: 'boolean', default: false },
  additional_allowed_characters: stringListOption,
  ignore_words: stringListOption,
} as const satisfies OptionDefinitions;

export const quotingOptions = {
  check_table_paths: { type: 'boolean', default: false },
  ignore_words: stringListOption,
} as const satisfies OptionDefinitions;

export const qualificationOptions = {
  ignore_words: stringListOption,
  subqueries_ignore_external_references: { type: 'boolean', default: false },
} as const satisfies OptionDefinitions;

export const consistencyOptions = {
  single_table_references: {
    type: 'string',
    enum: ['consistent', 'qualified', 'unqualified'],
    default: 'consistent',
  },
} as const satisfies OptionDefinitions;

export const capitalisationOptions = {
  capitalisation_policy: {
    type: 'string',
    enum: ['lower', 'upper', 'consistent'],
    default: 'lower',
  } satisfies OptionDefinition<CapitalisationPolicy>,
} as const;

export const joinOrderOptions = {
  preferred_first_table_in_join_clause: {
    type: 'string',
    enum: ['earlier', 'later'],
    default: 'earlier',
  },
} as const satisfies OptionDefinitions;

export const ruleOptionSchemas: Readonly<Record<string, OptionDefinitions>> = {
  CP01: capitalisationOptions,
  CP02: capitalisationOptions,
  CP03: capitalisationOptions,
  CP04: capitalisationOptions,
  CP05: capitalisationOptions,
  RF02: qualificationOptions,
  RF03: consistencyOptions,
  RF04: keywordIdentifierOptions,
  RF05: specialCharacterOptions,
  RF06: quotingOptions,
  ST09: joinOrderOptions,
};

export function isValidOption<T extends OptionValue>(definition: OptionDefinition<T>, value: unknown): value is T {
  if (definition.type === 'array') {
    return Array.isArray(value) && value.every((item) => typeof item === 'string');
  }
  const validType =
    definition.type === 'integer'
      ? typeof value === 'number' && Number.isInteger(value)
      : typeof value === definition.type && (typeof value !== 'number' || Number.isFinite(value));
  return validType && (!definition.enum || definition.enum.some((allowed) => allowed === value));
}

export function optionDefaults(definitions: OptionDefinitions): Record<string, OptionValue> {
  return Object.fromEntries(
    Object.entries(definitions).map(([name, definition]) => [
      name,
      Array.isArray(definition.default) ? [...definition.default] : definition.default,
    ]),
  );
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
