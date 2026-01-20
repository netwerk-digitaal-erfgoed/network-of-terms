import { DataFactory, Writer, Store } from 'n3';
import type { Observation, MonitorConfig } from '@lde/sparql-monitor';
import {
  sosa,
  http,
  ldes,
  tree,
  not,
  rdf,
  xsd,
  dcterms,
  prefixes,
} from './vocabulary.js';

const { namedNode, literal, blankNode } = DataFactory;

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
  const monitorsByIdentifier = new Map(
    monitors.map((m) => [m.identifier, m]),
  );

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

export class LdesSerializer {
  constructor(private readonly config: SerializerConfig) {}

  /**
   * Serialize the LDES stream metadata and members.
   */
  async serializeStream(observations: EnrichedObservation[]): Promise<string> {
    const store = new Store();

    const streamUri = namedNode(`${this.config.baseUrl}`);
    const viewUri = namedNode(`${this.config.baseUrl}#LatestVersionSubset`);

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
      namedNode(not.monitoredEndpoint.value),
    );

    // View metadata (Latest Version Subset)
    store.addQuad(viewUri, rdf.type, tree.Collection);
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

    return this.writeStore(store);
  }

  /**
   * Serialize a single observation.
   */
  async serializeObservation(observation: EnrichedObservation): Promise<string> {
    const store = new Store();
    const observationUri = namedNode(
      `${this.config.baseUrl}/observations/${observation.id}`,
    );

    this.addObservationTriples(store, observation, observationUri);

    return this.writeStore(store);
  }

  /**
   * Serialize just the latest statuses (for GraphQL/API use).
   */
  async serializeLatestStatuses(
    observations: EnrichedObservation[],
  ): Promise<string> {
    return this.serializeStream(observations);
  }

  private addObservationTriples(
    store: Store,
    observation: EnrichedObservation,
    observationUri: ReturnType<typeof namedNode>,
  ): void {
    const endpointUri = namedNode(observation.endpointUrl);
    const resultNode = blankNode();

    // Observation type and properties
    store.addQuad(observationUri, rdf.type, sosa.Observation);
    store.addQuad(observationUri, sosa.hasFeatureOfInterest, endpointUri);
    store.addQuad(
      observationUri,
      sosa.observedProperty,
      not.endpointAvailability,
    );
    store.addQuad(
      observationUri,
      sosa.resultTime,
      literal(observation.observedAt.toISOString(), xsd.dateTime),
    );
    store.addQuad(observationUri, sosa.hasResult, resultNode);

    // Version tracking
    store.addQuad(observationUri, not.monitoredEndpoint, endpointUri);
    store.addQuad(observationUri, dcterms.isVersionOf, endpointUri);

    // Result details
    store.addQuad(resultNode, rdf.type, not.EndpointCheckResult);
    store.addQuad(
      resultNode,
      not.isAvailable,
      literal(observation.success.toString(), xsd.boolean),
    );

    store.addQuad(
      resultNode,
      not.responseTimeMs,
      literal(observation.responseTimeMs.toString(), xsd.integer),
    );

    if (observation.errorMessage) {
      store.addQuad(
        resultNode,
        not.errorMessage,
        literal(observation.errorMessage),
      );
    }

    // Dataset IRI
    store.addQuad(observationUri, not.datasetIri, namedNode(observation.datasetIri));
  }

  private writeStore(store: Store): Promise<string> {
    return new Promise((resolve, reject) => {
      const writer = new Writer({ prefixes });
      for (const quad of store) {
        writer.addQuad(quad);
      }
      writer.end((error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      });
    });
  }

  /**
   * Get JSON-LD context for the LDES.
   */
  getJsonLdContext(): object {
    return {
      '@context': {
        sosa: sosa.namespace,
        http: http.namespace,
        ldes: ldes.namespace,
        tree: tree.namespace,
        not: not.namespace,
        xsd: xsd.namespace,
        dcterms: dcterms.namespace,
        Observation: 'sosa:Observation',
        hasFeatureOfInterest: { '@id': 'sosa:hasFeatureOfInterest', '@type': '@id' },
        resultTime: { '@id': 'sosa:resultTime', '@type': 'xsd:dateTime' },
        hasResult: 'sosa:hasResult',
        observedProperty: { '@id': 'sosa:observedProperty', '@type': '@id' },
        statusCodeValue: { '@id': 'http:statusCodeValue', '@type': 'xsd:integer' },
        responseTimeMs: { '@id': 'not:responseTimeMs', '@type': 'xsd:integer' },
        isAvailable: { '@id': 'not:isAvailable', '@type': 'xsd:boolean' },
        errorMessage: 'not:errorMessage',
        member: { '@id': 'tree:member', '@type': '@id' },
        EventStream: 'ldes:EventStream',
        isVersionOf: { '@id': 'dcterms:isVersionOf', '@type': '@id' },
      },
    };
  }
}
