declare namespace jest {
  interface Matchers<R> {
    toConform(): R;
  }
}
