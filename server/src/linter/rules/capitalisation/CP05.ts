import { CapitalisationRule } from './base';

export class Types extends CapitalisationRule {
  readonly name = 'types';
  readonly code = 'CP05';
  readonly message = 'Capitalisation of data type';
  readonly scopes = ['storage.type.sql'];
}
