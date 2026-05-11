/**
 * Extract a printable message from an unknown thrown value.
 * Use this in every catch block to avoid "[object Object]" or "undefined"
 * outputs when the thrown value is not an Error instance.
 * @param err Unknown caught value (Error, string, number, custom throwable, ...)
 * @returns The Error.message if err instanceof Error, otherwise String(err)
 */
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
