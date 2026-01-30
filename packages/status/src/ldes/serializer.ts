import { DataFactory, Store } from 'n3';
import type { Observation, MonitorConfig } from '@lde/sparql-monitor';
import { rdfSerializer } from 'rdf-serialize';
import { Readable } from 'stream';
import { sosa, ldes, tree, status, rdf, xsd } from './vocabulary.js';

const { namedNode, literal, blankNode } = DataFactory;

/**
 * Remove credentials (username and password) from a URL string.
 */
function stripCredentials(urlString: string): string {
  const url = new URL(urlString);
  url.username = '';
  url.password = '';
  return url.toString();
}

export interface SerializerConfig {
  baseUrl: string;
}

/** Observation enriched with endpoint URL and dataset IRI from catalog */
export interface EnrichedObservation extends Observation {
  endpointUrl: string;
  datasetIri: string;
}

/**
 * Enrich observations with endpoint URL from monitor configs.
 * The monitor identifier is the dataset IRI.
 */
export function enrichObservations(
  observations: Map<string, Observation>,
  monitors: MonitorConfig[],
): EnrichedObservation[] {
  const monitorsByIdentifier = new Map(monitors.map((m) => [m.identifier, m]));

  const enriched: EnrichedObservation[] = [];

  for (const observation of observations.values()) {
    const monitor = monitorsByIdentifier.get(observation.monitor);

    if (monitor) {
      enriched.push({
        ...observation,
        endpointUrl: monitor.endpointUrl.toString(),
        datasetIri: observation.monitor, // monitor identifier is the dataset IRI
      });
    }
  }

  return enriched;
}

/**
 * Get available content types from rdf-serialize.
 */
export async function getAvailableContentTypes(): Promise<string[]> {
  return rdfSerializer.getContentTypes();
}

export class LdesSerializer {
  constructor(private readonly config: SerializerConfig) {}

  /**
   * Serialize just the LDES stream metadata (links to view).
   * Served at /
   */
  serializeStreamMetadata(contentType: string): NodeJS.ReadableStream {
    const store = new Store();

    const streamUri = namedNode(`${this.config.baseUrl}`);
    const viewUri = namedNode(`${this.config.baseUrl}/observations/latest`);

    // Stream metadata
    store.addQuad(streamUri, rdf.type, ldes.EventStream);
    store.addQuad(streamUri, tree.view, viewUri);
    store.addQuad(
      streamUri,
      ldes.timestampPath,
      namedNode(sosa.resultTime.value),
    );
    store.addQuad(
      streamUri,
      ldes.versionOfPath,
      namedNode(status.monitoredEndpoint.value),
    );

    return rdfSerializer.serialize(Readable.from(store), { contentType });
  }

  /**
   * Serialize the view with all observation members.
   * Served at /observations/latest
   */
  serializeLatestView(
    observations: EnrichedObservation[],
    contentType: string,
  ): NodeJS.ReadableStream {
    const store = new Store();

    const streamUri = namedNode(`${this.config.baseUrl}`);
    const viewUri = namedNode(`${this.config.baseUrl}/observations/latest`);

    // View metadata (Latest Version Subset)
    store.addQuad(viewUri, rdf.type, tree.Node);
    store.addQuad(viewUri, rdf.type, ldes.LatestVersionSubset);

    // Add members
    for (const observation of observations) {
      const memberUri = namedNode(
        `${this.config.baseUrl}/observations/${observation.id}`,
      );
      store.addQuad(streamUri, tree.member, memberUri);

      // Add observation triples
      this.addObservationTriples(store, observation, memberUri);
    }

    return rdfSerializer.serialize(Readable.from(store), { contentType });
  }

  /**
   * Serialize a single observation.
   */
  serializeObservation(
    observation: EnrichedObservation,
    contentType: string,
  ): NodeJS.ReadableStream {
    const store = new Store();
    const observationUri = namedNode(
      `${this.config.baseUrl}/observations/${observation.id}`,
    );

    this.addObservationTriples(store, observation, observationUri);

    return rdfSerializer.serialize(Readable.from(store), { contentType });
  }

  private addObservationTriples(
    store: Store,
    observation: EnrichedObservation,
    observationUri: ReturnType<typeof namedNode>,
  ): void {
    const datasetUri = namedNode(observation.datasetIri);
    const endpointUri = namedNode(stripCredentials(observation.endpointUrl));
    const resultNode = blankNode();

    // Observation type and properties
    store.addQuad(observationUri, rdf.type, sosa.Observation);
    store.addQuad(observationUri, sosa.hasFeatureOfInterest, datasetUri);
    store.addQuad(
      observationUri,
      sosa.observedProperty,
      status.endpointAvailability,
    );
    store.addQuad(
      observationUri,
      sosa.resultTime,
      literal(observation.observedAt.toISOString(), xsd.dateTime),
    );
    store.addQuad(observationUri, sosa.hasResult, resultNode);

    // Version tracking (endpoint URL for LDES versioning)
    store.addQuad(observationUri, status.monitoredEndpoint, endpointUri);

    // Result details
    store.addQuad(resultNode, rdf.type, status.EndpointCheckResult);
    store.addQuad(
      resultNode,
      status.isAvailable,
      literal(observation.success.toString(), xsd.boolean),
    );

    store.addQuad(
      resultNode,
      status.responseTimeMs,
      literal(observation.responseTimeMs.toString(), xsd.integer),
    );

    if (observation.errorMessage) {
      store.addQuad(
        resultNode,
        status.errorMessage,
        literal(observation.errorMessage),
      );
    }
  }
}
