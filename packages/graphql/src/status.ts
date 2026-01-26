import { Parser, Store } from 'n3';
import type { FastifyBaseLogger } from 'fastify';

export interface SourceStatus {
  isAvailable: boolean;
  lastChecked: string;
}

const SOSA_RESULT_TIME = 'http://www.w3.org/ns/sosa/resultTime';
const SOSA_HAS_RESULT = 'http://www.w3.org/ns/sosa/hasResult';
const SOSA_HAS_FEATURE_OF_INTEREST =
  'http://www.w3.org/ns/sosa/hasFeatureOfInterest';
const STATUS_IS_AVAILABLE = 'https://nde.nl/ns/status#isAvailable';

export class StatusClient {
  private cache: Map<string, SourceStatus> = new Map();
  private lastRefresh = 0;
  private refreshPromise: Promise<void> | null = null;
  private readonly maxAgeMs: number;

  constructor(
    private readonly statusServiceUrl: string,
    private readonly logger?: FastifyBaseLogger,
    maxAgeMs = 60000,
  ) {
    this.maxAgeMs = maxAgeMs;
  }

  getStatus(datasetIri: string): SourceStatus | null {
    // Trigger async refresh if stale (doesn't block)
    if (this.isStale()) {
      this.refreshInBackground();
    }
    return this.cache.get(datasetIri) ?? null;
  }

  private isStale(): boolean {
    return Date.now() - this.lastRefresh > this.maxAgeMs;
  }

  private refreshInBackground(): void {
    // Avoid concurrent refreshes
    if (this.refreshPromise) return;

    this.refreshPromise = this.refresh().finally(() => {
      this.refreshPromise = null;
    });
  }

  private async refresh(): Promise<void> {
    try {
      const url = `${this.statusServiceUrl}/observations/latest`;
      const response = await fetch(url, {
        headers: { Accept: 'text/turtle' },
      });

      if (!response.ok) {
        this.logger?.warn(
          `Status service returned ${response.status}: ${response.statusText}`,
        );
        return;
      }

      const turtle = await response.text();
      this.parseAndUpdateCache(turtle);
      this.lastRefresh = Date.now();
    } catch (error) {
      this.logger?.warn({ err: error }, 'Failed to fetch status from service');
    }
  }

  private parseAndUpdateCache(turtle: string): void {
    const parser = new Parser();
    const store = new Store();

    try {
      const quads = parser.parse(turtle);
      store.addQuads(quads);
    } catch (error) {
      this.logger?.warn({ err: error }, 'Failed to parse status Turtle');
      return;
    }

    const newCache = new Map<string, SourceStatus>();

    // Find all observations by their feature of interest (the dataset IRI)
    const featureQuads = store.getQuads(
      null,
      SOSA_HAS_FEATURE_OF_INTEREST,
      null,
      null,
    );

    for (const featureQuad of featureQuads) {
      const observationUri = featureQuad.subject.value;
      const datasetIri = featureQuad.object.value;

      // Get resultTime
      const resultTimeQuads = store.getQuads(
        observationUri,
        SOSA_RESULT_TIME,
        null,
        null,
      );
      const lastChecked = resultTimeQuads[0]?.object.value ?? '';

      // Get hasResult to find the result blank node
      const hasResultQuads = store.getQuads(
        observationUri,
        SOSA_HAS_RESULT,
        null,
        null,
      );
      const resultNode = hasResultQuads[0]?.object;

      // Get isAvailable from result
      let isAvailable = false;
      if (resultNode) {
        const isAvailableQuads = store.getQuads(
          resultNode,
          STATUS_IS_AVAILABLE,
          null,
          null,
        );
        const isAvailableValue = isAvailableQuads[0]?.object.value;
        isAvailable = isAvailableValue === 'true';
      }

      newCache.set(datasetIri, { isAvailable, lastChecked });
    }

    this.cache = newCache;
    this.logger?.debug(`Updated status cache with ${newCache.size} entries`);
  }
}
