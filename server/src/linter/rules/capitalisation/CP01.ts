import { CapitalisationRule } from './base';

export class Keywords extends CapitalisationRule {
  readonly name = 'keywords';
  readonly code = 'CP01';
  readonly message = 'Capitalisation of keyword';
  readonly scopes = ['keyword'];
}
