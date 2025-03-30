import { NodeSDK } from '@opentelemetry/sdk-node';
import { SpanExporter } from '@opentelemetry/sdk-trace-node';
import { OTLPTraceExporter as OTLPTraceExporterGrpc } from '@opentelemetry/exporter-trace-otlp-grpc';
import { OTLPMetricExporter as OTLPMetricExporterGrpc } from '@opentelemetry/exporter-metrics-otlp-grpc';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { Resource } from '@opentelemetry/resources';

const OTEL_EXPORTER_OTLP_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://127.0.0.1:4317';
const OTEL_RESOURCE_ATTRIBUTES = process.env.OTEL_RESOURCE_ATTRIBUTES || 'service.name=temporal-hello-world';

function setupTraceExporter(): SpanExporter | undefined {
  console.log('[Instrumentation] Setting up Trace Exporter to', OTEL_EXPORTER_OTLP_ENDPOINT);
  return new OTLPTraceExporterGrpc({
    url: OTEL_EXPORTER_OTLP_ENDPOINT,
    timeoutMillis: 1000,
  });

  return undefined;
}

function setupMetricReader() {
  console.log('[Instrumentation] Setting up Metric Reader to', OTEL_EXPORTER_OTLP_ENDPOINT);
  return new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporterGrpc({
      url: OTEL_EXPORTER_OTLP_ENDPOINT,
      timeoutMillis: 1000,
    }),
  });
}

export const resource = new Resource({
  [ATTR_SERVICE_NAME]: OTEL_RESOURCE_ATTRIBUTES.split(',')[0].split('=')[1],
});

export const traceExporter = setupTraceExporter();
const metricReader = setupMetricReader();

export const otelSdk = new NodeSDK({
  resource,
  traceExporter,
  metricReader,
  instrumentations: [getNodeAutoInstrumentations()],
});

otelSdk.start();
