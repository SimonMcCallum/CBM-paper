/**
 * Main entry point for CBM Submission Assessment System
 */

import { createApp } from './app';
import config from './config';
import logger from './utils/logger';

const serverLogger = logger.child({ module: 'server' });

/**
 * Start the server
 */
async function startServer() {
  try {
    serverLogger.info('Starting CBM Submission Assessment System...');

    // Create Express app
    const app = createApp();

    // Start HTTP server
    const server = app.listen(config.server.port, config.server.host, () => {
      serverLogger.info(`Server started successfully`, {
        host: config.server.host,
        port: config.server.port,
        environment: config.server.nodeEnv,
        llmProvider: config.llm.provider,
      });

      if (config.server.nodeEnv === 'development') {
        serverLogger.info(`API available at http://${config.server.host}:${config.server.port}/api`);
        serverLogger.info(`Health check at http://${config.server.host}:${config.server.port}/health`);
      }
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      serverLogger.info(`${signal} received, starting graceful shutdown`);

      server.close(async () => {
        serverLogger.info('HTTP server closed');

        // TODO: Close database connections
        // await database.close();

        // TODO: Clean up resources
        // await cleanup();

        serverLogger.info('Graceful shutdown complete');
        process.exit(0);
      });

      // Force shutdown after 30 seconds
      setTimeout(() => {
        serverLogger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      serverLogger.error('Uncaught exception', {
        error: error.message,
        stack: error.stack,
      });
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      serverLogger.error('Unhandled rejection', {
        reason,
        promise,
      });
      process.exit(1);
    });

  } catch (error) {
    serverLogger.error('Failed to start server', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  }
}

// Start the server
startServer();
