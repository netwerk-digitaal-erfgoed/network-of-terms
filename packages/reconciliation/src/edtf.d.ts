// The edtf package ships no types; this declares the part the reconciliation service uses.
declare module 'edtf' {
  /**
   * Parse an EDTF string. The result spans the earliest and latest moment the value can mean, in
   * milliseconds since the epoch: `1851` from the first to the last millisecond of that year.
   *
   * @throws Error if the string is not EDTF.
   */
  export default function edtf(value: string): { min: number; max: number };
}
