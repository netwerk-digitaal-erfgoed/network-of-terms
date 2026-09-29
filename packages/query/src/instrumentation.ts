import {
  MeterProvider,
  PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics';
import {
  defaultResource,
  detectResources,
  envDetector,
  resourceFromAttributes,
} from '@opentelemetry/resources';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { metrics, ValueType } from '@opentelemetry/api';
import { hostname } from 'node:os';

/**
 * Export the metrics recorded since the last periodic export, then stop exporting. Call this
 * on shutdown: without it, a replaced pod loses up to one export interval of metrics.
 */
export function shutdownInstrumentation(): Promise<void> {
  return meterProvider.shutdown();
}

const sourceQueriesHistogramName = 'queries.source';

// Incubating in @opentelemetry/semantic-conventions, which recommends copying such constants.
const ATTR_SERVICE_INSTANCE_ID = 'service.instance.id';

const meterProvider = new MeterProvider({
  // Each replica needs its own service.instance.id: without one, replicas write to the same
  // series and overwrite each other’s values. The hostname is the pod name in Kubernetes.
  // OTEL_SERVICE_NAME and OTEL_RESOURCE_ATTRIBUTES override these defaults.
  resource: defaultResource()
    .merge(
      resourceFromAttributes({
        [ATTR_SERVICE_NAME]: 'network-of-terms',
        [ATTR_SERVICE_INSTANCE_ID]: hostname(),
      }),
    )
    .merge(detectResources({ detectors: [envDetector] })),
  readers:
    'test' === process.env.NODE_ENV
      ? []
      : [
          new PeriodicExportingMetricReader({
            exporter: new OTLPMetricExporter(),
            exportIntervalMillis:
              (process.env.OTEL_METRIC_EXPORT_INTERVAL as unknown as number) ??
              60000,
          }),
        ],
});

metrics.setGlobalMeterProvider(meterProvider);

const meter = metrics.getMeter('default');

export const clientQueriesCounter = meter.createCounter(
  'queries.client.counter',
  {
    description: 'Number of user queries',
    valueType: ValueType.INT,
  },
);

export const sourceQueriesHistogram = meter.createHistogram(
  sourceQueriesHistogramName,
  {
    description: 'Queries to terminology sources and their response times',
    valueType: ValueType.INT,
    unit: 'ms',
  },
);
