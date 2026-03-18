export function unreachable(x: never): never {
  throw new Error(`Unhandled variant: ${JSON.stringify(x)}`);
}
