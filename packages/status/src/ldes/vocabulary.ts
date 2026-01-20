import { DataFactory } from 'n3';

const { namedNode } = DataFactory;

export const sosa = {
  prefix: 'sosa',
  namespace: 'http://www.w3.org/ns/sosa/',
  Observation: namedNode('http://www.w3.org/ns/sosa/Observation'),
  hasFeatureOfInterest: namedNode(
    'http://www.w3.org/ns/sosa/hasFeatureOfInterest',
  ),
  resultTime: namedNode('http://www.w3.org/ns/sosa/resultTime'),
  hasResult: namedNode('http://www.w3.org/ns/sosa/hasResult'),
  observedProperty: namedNode('http://www.w3.org/ns/sosa/observedProperty'),
};

export const http = {
  prefix: 'http',
  namespace: 'http://www.w3.org/2011/http#',
  statusCodeValue: namedNode('http://www.w3.org/2011/http#statusCodeValue'),
};

export const ldes = {
  prefix: 'ldes',
  namespace: 'https://w3id.org/ldes#',
  EventStream: namedNode('https://w3id.org/ldes#EventStream'),
  LatestVersionSubset: namedNode('https://w3id.org/ldes#LatestVersionSubset'),
  versionOfPath: namedNode('https://w3id.org/ldes#versionOfPath'),
  timestampPath: namedNode('https://w3id.org/ldes#timestampPath'),
};

export const tree = {
  prefix: 'tree',
  namespace: 'https://w3id.org/tree#',
  Collection: namedNode('https://w3id.org/tree#Collection'),
  member: namedNode('https://w3id.org/tree#member'),
  view: namedNode('https://w3id.org/tree#view'),
};

export const not = {
  prefix: 'not',
  namespace: 'https://nde.nl/ns/status#',
  EndpointCheckResult: namedNode('https://nde.nl/ns/status#EndpointCheckResult'),
  responseTimeMs: namedNode('https://nde.nl/ns/status#responseTimeMs'),
  isAvailable: namedNode('https://nde.nl/ns/status#isAvailable'),
  endpointAvailability: namedNode('https://nde.nl/ns/status#endpointAvailability'),
  errorMessage: namedNode('https://nde.nl/ns/status#errorMessage'),
  monitoredEndpoint: namedNode('https://nde.nl/ns/status#monitoredEndpoint'),
  datasetIri: namedNode('https://nde.nl/ns/status#datasetIri'),
};

export const rdf = {
  prefix: 'rdf',
  namespace: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  type: namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
};

export const xsd = {
  prefix: 'xsd',
  namespace: 'http://www.w3.org/2001/XMLSchema#',
  dateTime: namedNode('http://www.w3.org/2001/XMLSchema#dateTime'),
  integer: namedNode('http://www.w3.org/2001/XMLSchema#integer'),
  boolean: namedNode('http://www.w3.org/2001/XMLSchema#boolean'),
};

export const dcterms = {
  prefix: 'dcterms',
  namespace: 'http://purl.org/dc/terms/',
  isVersionOf: namedNode('http://purl.org/dc/terms/isVersionOf'),
};

export const prefixes = {
  sosa: sosa.namespace,
  http: http.namespace,
  ldes: ldes.namespace,
  tree: tree.namespace,
  not: not.namespace,
  rdf: rdf.namespace,
  xsd: xsd.namespace,
  dcterms: dcterms.namespace,
};
