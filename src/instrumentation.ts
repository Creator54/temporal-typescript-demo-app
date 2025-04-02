import { NodeSDK } from '@opentelemetry/sdk-node';
import { SpanExporter } from '@opentelemetry/sdk-trace-node';
import { OTLPTraceExporter as OTLPTraceExporterGrpc } from '@opentelemetry/exporter-trace-otlp-grpc';
import { OTLPMetricExporter as OTLPMetricExporterGrpc } from '@opentelemetry/exporter-metrics-otlp-grpc';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-grpc';
import { SimpleLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { Resource } from '@opentelemetry/resources';
import { logs } from '@opentelemetry/api-logs';
import { LoggerProvider } from '@opentelemetry/sdk-logs';

// Default OpenTelemetry endpoint for SigNoz cloud
// Available regions:
// - US: ingest.us.signoz.cloud:443
// - EU: ingest.eu.signoz.cloud:443
// - IN: ingest.in.signoz.cloud:443
const OTEL_EXPORTER_OTLP_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'https://ingest.in.signoz.cloud:443';
const OTEL_RESOURCE_ATTRIBUTES = process.env.OTEL_RESOURCE_ATTRIBUTES || 'service.name=temporal-hello-world';

// Set up authentication headers for SigNoz if ingestion key is provided
const headers = process.env.SIGNOZ_INGESTION_KEY 
  ? { 'signoz-ingestion-key': process.env.SIGNOZ_INGESTION_KEY }
  : undefined;

function setupTraceExporter(): SpanExporter | undefined {
  console.log('[Instrumentation] Setting up Trace Exporter to', OTEL_EXPORTER_OTLP_ENDPOINT);
  return new OTLPTraceExporterGrpc({
    url: OTEL_EXPORTER_OTLP_ENDPOINT,
    timeoutMillis: 1000,
    headers
  });
}

function setupMetricReader() {
  console.log('[Instrumentation] Setting up Metric Reader to', OTEL_EXPORTER_OTLP_ENDPOINT);
  return new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporterGrpc({
      url: OTEL_EXPORTER_OTLP_ENDPOINT,
      timeoutMillis: 1000,
      headers
    }),
  });
}

function setupLogExporter() {
  console.log('[Instrumentation] Setting up Log Exporter to', OTEL_EXPORTER_OTLP_ENDPOINT);
  return new OTLPLogExporter({
    url: OTEL_EXPORTER_OTLP_ENDPOINT,
    timeoutMillis: 1000,
    headers
  });
}

export const resource = new Resource({
  [ATTR_SERVICE_NAME]: OTEL_RESOURCE_ATTRIBUTES.split(',')[0].split('=')[1],
});

export const traceExporter = setupTraceExporter();
const metricReader = setupMetricReader();
const logExporter = setupLogExporter();

const loggerProvider = new LoggerProvider({ resource });
loggerProvider.addLogRecordProcessor(new SimpleLogRecordProcessor(logExporter));
logs.setGlobalLoggerProvider(loggerProvider);

export const otelSdk = new NodeSDK({
  resource,
  traceExporter,
  metricReader,
  instrumentations: [getNodeAutoInstrumentations()],
});

otelSdk.start();
