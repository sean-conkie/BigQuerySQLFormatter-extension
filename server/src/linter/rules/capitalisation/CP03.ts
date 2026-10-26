import { CapitalisationRule } from './base';

export class Functions extends CapitalisationRule {
  readonly name = 'functions';
  readonly code = 'CP03';
  readonly message = 'Capitalisation of function name';
  readonly scopes = ['support.function', 'meta.function.sql'];
}
