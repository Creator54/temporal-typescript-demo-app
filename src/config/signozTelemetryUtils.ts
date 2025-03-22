import { diag, trace, metrics, Tracer, Meter } from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';

/**
 * Utility class for configuring and accessing SigNoz telemetry in temporal applications.
 * Provides centralized access to meters, tracers, and other telemetry components.
 */

// Persistent SDK and telemetry instances
let sdkInstance: NodeSDK | null = null;
let tracerInstance: Tracer | null = null;
let meterInstance: Meter | null = null;
let initialized = false;

/**
 * Gets the configured tracer instance.
 * Thread-safe and creates new instance if needed.
 * 
 * @return Tracer instance for the application
 */
export function getTracer(): Tracer {
    if (!tracerInstance) {
        tracerInstance = trace.getTracer('temporal-hello-world');
    }
    return tracerInstance;
}

/**
 * Gets the configured meter instance.
 * Thread-safe and creates new instance if needed.
 * 
 * @return Meter instance for the application
 */
export function getMeter(): Meter {
    if (!meterInstance) {
        meterInstance = metrics.getMeter('temporal-hello-world');
    }
    return meterInstance;
}

/**
 * Initializes OpenTelemetry for the application.
 * Sets up tracing, metrics and initializes dashboard-specific metrics.
 */
export function initializeTelemetry(): void {
    if (initialized) {
        return;
    }
    
    diag.info("Initializing OpenTelemetry...");
    
    try {
        // SDK initialization handled in opentelemetryConfig.ts
        
        // Create instances for later use
        tracerInstance = getTracer();
        meterInstance = getMeter();
        
        initialized = true;
        diag.info("OpenTelemetry initialized successfully");
    } catch (error) {
        diag.error(`Error initializing OpenTelemetry: ${error}`);
    }
}

/**
 * Shuts down OpenTelemetry SDK.
 * Ensures proper resource cleanup on application termination.
 */
export async function shutdownTelemetry(): Promise<void> {
    if (!sdkInstance) {
        return;
    }
    
    try {
        diag.info("Shutting down OpenTelemetry SDK...");
        await sdkInstance.shutdown();
        sdkInstance = null;
        tracerInstance = null;
        meterInstance = null;
        initialized = false;
        diag.info("OpenTelemetry SDK shut down successfully");
    } catch (error) {
        diag.error(`Error shutting down OpenTelemetry SDK: ${error}`);
    }
}

/**
 * Gets the OpenTelemetry SDK instance.
 * Allows direct access to the SDK for advanced configuration.
 * 
 * @return NodeSDK instance
 */
export function getSDK(): NodeSDK | null {
    return sdkInstance;
}

/**
 * Sets the OpenTelemetry SDK instance.
 * Used during SDK initialization.
 * 
 * @param sdk The initialized SDK instance
 */
export function setSDK(sdk: NodeSDK): void {
    sdkInstance = sdk;
}

/**
 * Force export of any pending spans
 * 
 * Use this function during shutdown to ensure all telemetry data is exported
 * before the process exits. This helps prevent data loss.
 * 
 * @returns Promise that resolves when export is complete or times out
 */
export async function forceSpanExport(): Promise<boolean> {
    if (!sdkInstance) {
        return false;
    }
    
    diag.info('Forcing export of pending spans');
    
    // Create a promise that times out after 5 seconds
    const timeoutPromise = new Promise<boolean>((resolve) => {
        setTimeout(() => {
            diag.warn('Span export timed out after 5 seconds');
            resolve(false);
        }, 5000);
    });
    
    // Create a promise for the shutdown
    const shutdownPromise = sdkInstance.shutdown().then(() => {
        diag.info('SDK shutdown complete, spans exported');
        // Reset instances after shutdown
        sdkInstance = null;
        tracerInstance = null;
        meterInstance = null;
        initialized = false;
        return true;
    }).catch(err => {
        diag.error('Error during SDK shutdown:', err);
        return false;
    });
    
    // Return the first promise that resolves
    return Promise.race([shutdownPromise, timeoutPromise]);
}

// Export default object with all methods
export default {
    getTracer,
    getMeter,
    initializeTelemetry,
    shutdownTelemetry,
    forceSpanExport,
    getSDK,
    setSDK
}; 