#!/usr/bin/env node

/**
 * Setup script for JavaScript development mode
 * Copies compiled TypeScript files as editable JavaScript files
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔧 Setting up JavaScript development mode...');

try {
  // Ensure src directory exists
  if (!existsSync('src/suitescript')) {
    mkdirSync('src/suitescript', { recursive: true });
    console.log('📁 Created src/suitescript directory');
  }

  // Check if JavaScript files already exist
  if (existsSync('src/suitescript/sl_ai_customer_analyzer.js') && 
      existsSync('src/suitescript/cl_ai_customer_analyzer.js')) {
    console.log('✅ JavaScript files already exist');
  } else {
    // Compile TypeScript first to create JavaScript files
    console.log('🔨 Compiling TypeScript files...');
    execSync('npm run build:typescript', { stdio: 'inherit' });
    console.log('✅ JavaScript files created from TypeScript');
  }

  console.log('\n🎉 JavaScript development mode ready!');
  console.log('📝 You can now edit these files:');
  console.log('   - src/suitescript/sl_ai_customer_analyzer.js (Suitelet)');
  console.log('   - src/suitescript/cl_ai_customer_analyzer.js (Client Script)');
  console.log('\n⚠️  Note: Changes will take effect immediately - no build step needed!');

} catch (error) {
  console.error('❌ Error setting up JavaScript mode:', error.message);
  process.exit(1);
}
