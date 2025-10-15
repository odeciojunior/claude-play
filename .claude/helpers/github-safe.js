#!/usr/bin/env node

/**
 * Safe GitHub CLI Helper
 * Prevents timeout issues when using gh commands with special characters
 *
 * SECURITY: Uses spawn instead of execSync to prevent command injection
 * All arguments are passed as array elements, not concatenated strings
 *
 * Usage:
 *   ./github-safe.js issue comment 123 "Message with `backticks`"
 *   ./github-safe.js pr create --title "Title" --body "Complex body"
 */

import { spawnSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomBytes } from 'crypto';

const args = process.argv.slice(2);

if (args.length < 2) {
  console.log(`
Safe GitHub CLI Helper

Usage:
  ./github-safe.js issue comment <number> <body>
  ./github-safe.js pr comment <number> <body>
  ./github-safe.js issue create --title <title> --body <body>
  ./github-safe.js pr create --title <title> --body <body>

This helper prevents timeout issues with special characters like:
- Backticks in code examples
- Command substitution \$(...)
- Directory paths
- Special shell characters

SECURITY: All arguments are safely passed to gh command without shell interpretation
`);
  process.exit(1);
}

// Validate command whitelist
const ALLOWED_COMMANDS = ['issue', 'pr', 'repo', 'run'];
const ALLOWED_SUBCOMMANDS = ['comment', 'create', 'view', 'list', 'close', 'view', 'status'];

const [command, subcommand, ...restArgs] = args;

// Validate against whitelist
if (!ALLOWED_COMMANDS.includes(command)) {
  console.error(`Error: Command '${command}' is not allowed`);
  console.error(`Allowed commands: ${ALLOWED_COMMANDS.join(', ')}`);
  process.exit(1);
}

if (subcommand && !ALLOWED_SUBCOMMANDS.includes(subcommand)) {
  console.error(`Error: Subcommand '${subcommand}' is not allowed`);
  console.error(`Allowed subcommands: ${ALLOWED_SUBCOMMANDS.join(', ')}`);
  process.exit(1);
}

// Handle commands that need body content
if ((command === 'issue' || command === 'pr') && 
    (subcommand === 'comment' || subcommand === 'create')) {
  
  let bodyIndex = -1;
  let body = '';
  
  if (subcommand === 'comment' && restArgs.length >= 2) {
    // Simple format: github-safe.js issue comment 123 "body"
    body = restArgs[1];
    bodyIndex = 1;
  } else {
    // Flag format: --body "content" 
    bodyIndex = restArgs.indexOf('--body');
    if (bodyIndex !== -1 && bodyIndex < restArgs.length - 1) {
      body = restArgs[bodyIndex + 1];
    }
  }
  
  if (body) {
    // Use temporary file for body content
    const tmpFile = join(tmpdir(), `gh-body-${randomBytes(8).toString('hex')}.tmp`);
    
    try {
      writeFileSync(tmpFile, body, 'utf8');
      
      // Build new command with --body-file
      const newArgs = [...restArgs];
      if (subcommand === 'comment' && bodyIndex === 1) {
        // Replace body with --body-file
        newArgs[1] = '--body-file';
        newArgs.push(tmpFile);
      } else if (bodyIndex !== -1) {
        // Replace --body with --body-file
        newArgs[bodyIndex] = '--body-file';
        newArgs[bodyIndex + 1] = tmpFile;
      }

      // Execute safely using spawn (no shell interpretation)
      // SECURITY: spawnSync with array arguments prevents command injection
      const ghArgs = [command, subcommand, ...newArgs];
      console.log(`Executing: gh ${ghArgs.join(' ')}`);

      const result = spawnSync('gh', ghArgs, {
        stdio: 'inherit',
        timeout: 30000, // 30 second timeout
        shell: false  // CRITICAL: Disable shell to prevent command injection
      });

      if (result.error) {
        throw result.error;
      }

      if (result.status !== 0) {
        process.exit(result.status);
      }
      
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    } finally {
      // Clean up
      try {
        unlinkSync(tmpFile);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  } else {
    // No body content, execute safely with spawn
    const result = spawnSync('gh', args, {
      stdio: 'inherit',
      shell: false  // CRITICAL: Disable shell to prevent command injection
    });

    if (result.error) {
      console.error('Error:', result.error.message);
      process.exit(1);
    }

    if (result.status !== 0) {
      process.exit(result.status);
    }
  }
} else {
  // Other commands, execute safely with spawn
  const result = spawnSync('gh', args, {
    stdio: 'inherit',
    shell: false  // CRITICAL: Disable shell to prevent command injection
  });

  if (result.error) {
    console.error('Error:', result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status);
  }
}
