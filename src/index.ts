#!/usr/bin/env node
/**
 * Knowledge Tree MCP Server - Main Entry Point
 * 
 * This is a clean, modular implementation following SOLID principles.
 * All functionality is delegated to specialized modules.
 */

import { KnowledgeTreeServer } from './server/index.js';

/**
 * Main entry point for the Knowledge Tree MCP server
 * 
 * This follows the Single Responsibility Principle:
 * - Parse arguments and create server: KnowledgeTreeServer.fromArgs()
 * - Start the server: server.start()
 * - Handle shutdown gracefully
 */
async function main() {
  try {
    // Create server from command line arguments
    const server = KnowledgeTreeServer.fromArgs(process.argv.slice(2));
    
    // Set up graceful shutdown
    const shutdown = async (signal: string) => {
      console.error(`\n📋 Received ${signal}, shutting down gracefully...`);
      try {
        await server.stop();
        process.exit(0);
      } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
      }
    };

    // Register shutdown handlers
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    
    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      console.error('Uncaught exception:', error);
      shutdown('uncaughtException');
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled rejection at:', promise, 'reason:', reason);
      shutdown('unhandledRejection');
    });

    // Start the server
    await server.start();
    
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Always run main - this is the entry point
main();