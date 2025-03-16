import { diag } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';

/**
 * Tracing Configuration
 * 
 * This module configures the trace exporter for OpenTelemetry
 * and provides utilities for trace configuration.
 */

/**
 * Get a configured trace exporter
 * 
 * Creates and configures an OTLPTraceExporter that sends traces
 * to the configured endpoint via gRPC protocol.
 * 
 * @returns Configured OTLPTraceExporter ready for use
 */
export function getTracingExporter(): OTLPTraceExporter {
    const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4317';
    diag.info(`[TELEMETRY] Configuring trace exporter with gRPC protocol: ${endpoint}`);
    
    return new OTLPTraceExporter({
        url: endpoint, // For gRPC, we don't need to specify the path
    });
}

/**
 * Configure tracing-related environment variables
 * 
 * Sets up standard environment variables for tracing configuration
 * to ensure consistent behavior across the application.
 */
export function configureTracingEnvironment(): void {
    // Configure environment variables for tracing
    process.env.OTEL_TRACES_EXPORTER = 'otlp';
    process.env.OTEL_TRACES_SAMPLER = 'always_on';
} 