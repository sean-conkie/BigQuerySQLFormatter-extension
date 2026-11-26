export async function openRuleDocumentation(
  href: unknown,
  openExternal: (href: string) => PromiseLike<boolean>,
): Promise<void> {
  if (typeof href !== 'string' || !href.startsWith('https://bigquerysqlformatter.readthedocs.io/')) {
    throw new Error('Rule documentation must use https://bigquerysqlformatter.readthedocs.io/.');
  }
  if (!(await openExternal(href))) {
    throw new Error('Could not open rule documentation.');
  }
}
