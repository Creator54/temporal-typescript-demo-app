import { diag } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { OTLPTraceExporter as OTLPHttpTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { BatchSpanProcessor, SpanExporter } from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { Resource } from '@opentelemetry/resources';

/**
 * Tracing Configuration
 * 
 * This module configures the tracing exporter for OpenTelemetry
 * and provides utilities for trace collection.
 */

/**
 * Get the configured tracing exporter
 * 
 * Creates and configures a trace exporter based on environment variables.
 * Defaults to OTLP gRPC exporter if not specified.
 * 
 * @returns A configured SpanExporter instance
 */
export function getTracingExporter(): SpanExporter {
    const protocol = process.env.OTEL_EXPORTER_OTLP_PROTOCOL || 'grpc';
    const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4317';
    
    diag.info(`[TELEMETRY] Configuring trace exporter with ${protocol} protocol: ${endpoint}`);
    
    let exporter: SpanExporter;
    
    // Choose the appropriate exporter based on protocol
    if (protocol.toLowerCase() === 'http/json' || protocol.toLowerCase() === 'http') {
        // Use the HTTP exporter
        const url = endpoint.endsWith('/v1/traces') ? endpoint : `${endpoint}/v1/traces`;
        exporter = new OTLPHttpTraceExporter({
            url,
            headers: getOtelHeaders(),
        });
        diag.info(`[TELEMETRY] Using HTTP trace exporter with URL: ${url}`);
    } else {
        // Default to gRPC exporter
        exporter = new OTLPTraceExporter({
            url: endpoint,
            // Headers not supported in gRPC protocol
        });
        diag.info(`[TELEMETRY] Using gRPC trace exporter with endpoint: ${endpoint}`);
    }
    
    return exporter;
}

/**
 * Create a batch span processor with optimal settings
 * 
 * Creates a BatchSpanProcessor with configuration aligned with
 * the Java implementation for consistent behavior.
 * 
 * @param exporter The span exporter to use
 * @returns Configured BatchSpanProcessor
 */
export function createBatchSpanProcessor(exporter: SpanExporter): BatchSpanProcessor {
    return new BatchSpanProcessor(exporter, {
        // Match Java BatchSpanProcessor configuration
        scheduledDelayMillis: 100,       // 100ms delay between exports (Java: 100ms)
        maxExportBatchSize: 512,         // Maximum 512 spans per batch (Java: 512)
        maxQueueSize: 2048,              // Queue up to 2048 spans (Java: 2048)
        exportTimeoutMillis: 30000,      // 30 seconds export timeout (Java: 30 seconds)
    });
}

/**
 * Get headers for OTLP exporters from environment variables
 * 
 * Parses the OTEL_EXPORTER_OTLP_HEADERS environment variable to create
 * headers for the OTLP exporters.
 * 
 * @returns Record of header key-value pairs
 */
function getOtelHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    const headersEnv = process.env.OTEL_EXPORTER_OTLP_HEADERS;
    
    if (headersEnv) {
        try {
            headersEnv.split(',').forEach(pair => {
                const [key, value] = pair.split('=');
                if (key && value) {
                    headers[key.trim()] = value.trim();
                }
            });
            diag.info(`[TELEMETRY] Using OTLP headers: ${JSON.stringify(headers)}`);
        } catch (e) {
            diag.warn(`[TELEMETRY] Failed to parse OTEL_EXPORTER_OTLP_HEADERS: ${e}`);
        }
    }
    
    return headers;
}

/**
 * Configure tracing-related environment variables
 * 
 * Sets up standard environment variables for tracing configuration
 * to ensure consistent behavior across the application.
 */
export function configureTracingEnvironment(): void {
    // Configure environment variables for tracing if not already set
    if (!process.env.OTEL_TRACES_EXPORTER) {
        process.env.OTEL_TRACES_EXPORTER = 'otlp';
    }
    
    // Set trace sampling to AlwaysOn to match Java implementation
    process.env.OTEL_TRACES_SAMPLER = 'always_on';
    
    if (!process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT && process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
        // Use the generic endpoint for traces if specific one not set
        process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    }
}

/**
 * Create a tracer provider with batch span processor
 * 
 * Creates and configures a NodeTracerProvider with a batch span processor
 * that matches the Java implementation's configuration.
 * 
 * @param resource The resource to use for the tracer provider
 * @returns Configured NodeTracerProvider
 */
export function createTracerProvider(resource: Resource): NodeTracerProvider {
    const tracerProvider = new NodeTracerProvider({
        resource
    });
    
    // Create trace exporter
    const traceExporter = getTracingExporter();
    
    // Configure batch span processor with optimal settings
    const batchSpanProcessor = new BatchSpanProcessor(traceExporter, {
        // Match Java BatchSpanProcessor configuration
        scheduledDelayMillis: 100,       // 100ms delay between exports (Java: 100ms)
        maxExportBatchSize: 512,         // Maximum 512 spans per batch (Java: 512)
        maxQueueSize: 2048,              // Queue up to 2048 spans (Java: 2048)
        exportTimeoutMillis: 30000,      // 30 seconds export timeout (Java: 30 seconds)
    });
    
    // Register the batch span processor
    tracerProvider.addSpanProcessor(batchSpanProcessor);
    
    diag.info('[TELEMETRY] Created tracer provider with batch span processor');
    
    return tracerProvider;
} 