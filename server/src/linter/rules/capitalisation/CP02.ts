import { CapitalisationRule } from './base';

export class Identifiers extends CapitalisationRule {
  readonly name = 'identifiers';
  readonly code = 'CP02';
  readonly message = 'Capitalisation of unquoted identifier';
  readonly scopes = [
    'entity.other.column.sql',
    'entity.name.alias.sql',
    'entity.name.tag',
    'entity.name.object.sql',
    'entity.name.dataset.sql',
  ];
}
