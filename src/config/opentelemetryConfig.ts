import { NodeSDK } from '@opentelemetry/sdk-node';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { CompositePropagator, W3CTraceContextPropagator, W3CBaggagePropagator } from '@opentelemetry/core';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { getMetricsReader } from './metricsExporter';
import { getTracingExporter, configureTracingEnvironment } from './tracingExporter';
import { configureMetricsEnvironment } from './metricsExporter';
import { setOpenTelemetrySdk } from './signozTelemetryUtils';

/**
 * OpenTelemetry Configuration
 * 
 * This module centralizes OpenTelemetry SDK setup and configuration
 * to enable consistent telemetry throughout the application.
 */

// Define incubating semantic convention attributes
const ATTR_SERVICE_NAMESPACE = 'service.namespace';
const ATTR_DEPLOYMENT_ENVIRONMENT = 'deployment.environment';

// Logger configuration state
let loggerConfigured = false;

/**
 * Configure the OpenTelemetry logger
 * 
 * Sets up the diagnostic logger for OpenTelemetry with the appropriate log level.
 * This is done only once to avoid duplicate initialization.
 * 
 * @param logLevel The log level to use (default: INFO)
 */
function configureLogger(logLevel: DiagLogLevel = DiagLogLevel.INFO): void {
    if (!loggerConfigured) {
        diag.setLogger(new DiagConsoleLogger(), logLevel);
        loggerConfigured = true;
        diag.info('[TELEMETRY] OpenTelemetry logger configured');
    }
}

/**
 * Configure OpenTelemetry environment variables
 * 
 * Sets up standard environment variables for OpenTelemetry configuration
 * to ensure consistent behavior across the application.
 * 
 * @param serviceName The name of the service for telemetry
 */
function configureEnvironmentVariables(serviceName: string): void {
    // Configure core environment variables
    process.env.OTEL_SERVICE_NAME = serviceName;
    process.env.OTEL_EXPORTER_OTLP_PROTOCOL = 'grpc';
    process.env.OTEL_PROPAGATORS = 'tracecontext,baggage';
    process.env.OTEL_LOGS_EXPORTER = 'none';
    
    // Configure tracing and metrics
    configureTracingEnvironment();
    configureMetricsEnvironment();
    
    // Log environment configuration for debugging
    diag.debug('[TELEMETRY] Environment variables:', {
        OTEL_EXPORTER_OTLP_ENDPOINT: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4317',
        OTEL_EXPORTER_OTLP_PROTOCOL: process.env.OTEL_EXPORTER_OTLP_PROTOCOL,
        OTEL_RESOURCE_ATTRIBUTES: process.env.OTEL_RESOURCE_ATTRIBUTES,
        OTEL_SERVICE_NAME: process.env.OTEL_SERVICE_NAME,
    });
}

/**
 * Create a resource that identifies the service
 * 
 * Creates a resource with appropriate attributes to identify the service
 * in telemetry data according to OpenTelemetry semantic conventions.
 * 
 * @param serviceName The name of the service
 * @returns Resource instance with service identification attributes
 */
function createServiceResource(serviceName: string): Resource {
    return Resource.default().merge(
        new Resource({
            [ATTR_SERVICE_NAME]: serviceName,
            [ATTR_SERVICE_NAMESPACE]: 'default',
            [ATTR_DEPLOYMENT_ENVIRONMENT]: process.env.OTEL_ENVIRONMENT || 'development',
        })
    );
}

/**
 * Initialize the OpenTelemetry SDK
 * 
 * This function is the main entry point for OpenTelemetry initialization.
 * It configures and starts the OpenTelemetry SDK with all required components.
 * 
 * @param serviceName The name of the service for telemetry data
 * @returns Promise that resolves to the initialized SDK instance
 */
export async function initOpenTelemetry(serviceName: string): Promise<NodeSDK> {
    // Configure the logger first
    configureLogger();
    
    diag.info('[TELEMETRY] Initializing OpenTelemetry for service:', serviceName);

    // Configure environment variables
    configureEnvironmentVariables(serviceName);

    try {
        // Create and configure the SDK
        const sdk = new NodeSDK({
            resource: createServiceResource(serviceName),
            traceExporter: getTracingExporter(),
            // Use as any to bypass type conflicts between different @opentelemetry/sdk-metrics versions
            metricReader: getMetricsReader() as any,
            textMapPropagator: new CompositePropagator({
                propagators: [
                    new W3CTraceContextPropagator(),
                    new W3CBaggagePropagator()
                ],
            }),
            instrumentations: [
                getNodeAutoInstrumentations({
                    '@opentelemetry/instrumentation-http': { enabled: true },
                    '@opentelemetry/instrumentation-grpc': { enabled: true },
                }),
            ]
        });

        // Store SDK instance in utilities
        setOpenTelemetrySdk(sdk);

        // Start the SDK
        await sdk.start();
        diag.info('[TELEMETRY] OpenTelemetry SDK initialized successfully for', serviceName);

        // Register shutdown handler for clean exit
        registerShutdownHandler(sdk);

        return sdk;
    } catch (error) {
        diag.error('[TELEMETRY] Failed to initialize OpenTelemetry:', error instanceof Error ? error.message : String(error));
        throw error;
    }
}

/**
 * Register handlers for graceful shutdown
 * 
 * Sets up process event handlers to ensure the SDK is properly shut down
 * when the process exits, preventing telemetry data loss.
 * 
 * @param sdk The SDK instance to shut down
 */
function registerShutdownHandler(sdk: NodeSDK): void {
    const shutdown = async () => {
        diag.info('[TELEMETRY] Shutting down OpenTelemetry SDK');
        
        try {
            const shutdownPromise = sdk.shutdown();
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Shutdown timed out')), 5000)
            );
            
            await Promise.race([shutdownPromise, timeoutPromise]);
            diag.info('[TELEMETRY] OpenTelemetry SDK shut down successfully');
        } catch (error) {
            diag.error('[TELEMETRY] Error shutting down OpenTelemetry SDK:', 
                error instanceof Error ? error.message : String(error));
        }
    };

    // Handle various termination signals
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
    
    // Handle uncaught errors
    process.on('uncaughtException', async (error) => {
        diag.error('[TELEMETRY] Uncaught exception, shutting down telemetry before exit:', error);
        await shutdown();
    });
} 