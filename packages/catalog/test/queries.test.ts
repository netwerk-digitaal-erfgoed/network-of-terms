import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { Parser } from 'sparqljs';

const queriesPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../catalog/queries',
);

const queryFiles = ['lookup', 'search'].flatMap((kind) =>
  fs
    .readdirSync(`${queriesPath}/${kind}`)
    .filter((name) => name.endsWith('.rq'))
    .map((name) => `${kind}/${name}`),
);

describe.each(queryFiles)('%s', (file) => {
  const path = `${queriesPath}/${file}`;

  /**
   * A byte order mark is invisible in an editor and in a diff, but it is part of the query text we
   * send: PoolParty answers a query that starts with one with an HTTP 400, which fails the whole
   * GraphQL lookup rather than that one source. The IED lookup query carried one for two years.
   */
  it('starts with the query itself, not a byte order mark', () => {
    const firstBytes = fs.readFileSync(path).subarray(0, 3);

    expect([...firstBytes]).not.toEqual([0xef, 0xbb, 0xbf]);
  });

  /**
   * The query service fills in `?uris` by string replacement, so a lookup query needs exactly one:
   * a second would be left as an unbound variable, and `VALUES ?uri { ?uris }` then joins against
   * every term the source holds rather than failing.
   */
  it.runIf(file.startsWith('lookup/'))('names ?uris exactly once', () => {
    const occurrences = fs.readFileSync(path, 'utf8').match(/\?uris\b/g) ?? [];

    expect(occurrences).toHaveLength(1);
  });

  /**
   * Catches a prefix a query uses but never declares. Four queries carried one until the
   * declarations were added, in the change that made lookups batch; this only keeps them from
   * coming back. The failure is easy to miss because an endpoint that predefines the prefix
   * answers anyway, so such a query works until it is pointed at one that does not - which is how
   * Bibliotheken.nl and Muziekweb came to reject every lookup with ‘Undefined prefix’.
   */
  it('is a valid SPARQL query', () => {
    // The placeholders the query service fills in; only these two sit where SPARQL wants a term
    // rather than a variable, so the rest parse as they are.
    const query = fs
      .readFileSync(path, 'utf8')
      .replaceAll('?uris', '<https://example.com/term>')
      .replaceAll('?genres', '<https://example.com/genre>');

    expect(() => new Parser().parse(query)).not.toThrow();
  });
});
