import { CapitalisationRule } from './base';

export class Literals extends CapitalisationRule {
  readonly name = 'literals';
  readonly code = 'CP04';
  readonly message = 'Capitalisation of boolean/null literal';
  readonly scopes = ['constant.boolean.sql', 'constant.other.null.sql'];
}
