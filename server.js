// Azure Web App startup script for Nuxt 3
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Set the port that Azure provides or default to 3000
const PORT = process.env.PORT || process.env.port || '3000';
const HOST = process.env.HOST || '0.0.0.0';

// Ensure we have the built output
const serverPath = path.join(__dirname, '.output', 'server', 'index.mjs');

console.log('='.repeat(60));
console.log('🚀 Starting Nuxt.js Server');
console.log('='.repeat(60));
console.log(`📍 Host: ${HOST}`);
console.log(`🔌 Port: ${PORT}`);
console.log(`📂 Server path: ${serverPath}`);
console.log('='.repeat(60));

// Spawn the Nuxt server as a child process
const server = spawn('node', [serverPath], {
  stdio: 'inherit',
  env: {
    ...process.env,
    HOST,
    PORT,
    NODE_ENV: process.env.NODE_ENV || 'production'
  }
});

// Handle process termination
process.on('SIGTERM', () => {
  console.log('⚠️  SIGTERM received, shutting down gracefully...');
  server.kill('SIGTERM');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('⚠️  SIGINT received, shutting down gracefully...');
  server.kill('SIGINT');
  process.exit(0);
});

// Handle server exit
server.on('exit', (code, signal) => {
  console.log(`❌ Server exited with code ${code} and signal ${signal}`);
  process.exit(code || 1);
});

server.on('error', (error) => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});