import 'vitest';

declare module 'vitest' {
  interface Matchers {
    toConform(): unknown;
  }
}
