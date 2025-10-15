/**
 * Security Input Sanitization Module
 *
 * Provides comprehensive input validation and sanitization utilities
 * to prevent security vulnerabilities across the system.
 *
 * Features:
 * - SQL injection prevention (validates parameterized queries)
 * - XSS prevention (HTML/JS sanitization)
 * - Path traversal prevention
 * - Command injection prevention
 * - Input validation and whitelisting
 */

import * as path from 'path';
import { createHash } from 'crypto';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface SanitizationOptions {
  allowHtml?: boolean;
  maxLength?: number;
  allowedCharacters?: RegExp;
  trimWhitespace?: boolean;
}

export interface PathValidationOptions {
  allowedExtensions?: string[];
  allowAbsolute?: boolean;
  allowTraversal?: boolean;
  baseDirectory?: string;
}

export interface CommandValidationOptions {
  allowedCommands?: string[];
  allowedFlags?: string[];
  maxLength?: number;
}

export interface ValidationResult {
  valid: boolean;
  sanitized?: string;
  errors: string[];
  warnings: string[];
}

// ============================================================================
// Input Sanitizer Class
// ============================================================================

export class InputSanitizer {
  private static readonly SQL_DANGEROUS_PATTERNS = [
    /('|(--)|;|\*|\/\*|\*\/|xp_|sp_|exec|execute|select|insert|update|delete|drop|create|alter|union)/gi
  ];

  private static readonly XSS_DANGEROUS_PATTERNS = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /on\w+\s*=/gi,
    /javascript:/gi,
    /<iframe/gi,
    /<object/gi,
    /<embed/gi
  ];

  private static readonly PATH_TRAVERSAL_PATTERNS = [
    /\.\./g,
    /^\/+/,
    /^[a-zA-Z]:\\/  // Windows absolute paths
  ];

  /**
   * Sanitize string input for general use
   */
  static sanitizeString(
    input: string,
    options: SanitizationOptions = {}
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (typeof input !== 'string') {
      errors.push('Input must be a string');
      return { valid: false, errors, warnings };
    }

    let sanitized = input;

    // Trim whitespace if requested
    if (options.trimWhitespace !== false) {
      sanitized = sanitized.trim();
    }

    // Check max length
    if (options.maxLength && sanitized.length > options.maxLength) {
      errors.push(`Input exceeds maximum length of ${options.maxLength}`);
      return { valid: false, errors, warnings };
    }

    // Check allowed characters
    if (options.allowedCharacters) {
      if (!options.allowedCharacters.test(sanitized)) {
        errors.push('Input contains disallowed characters');
        return { valid: false, errors, warnings };
      }
    }

    // Check for potential XSS
    if (!options.allowHtml) {
      const xssDetected = this.detectXSS(sanitized);
      if (xssDetected.detected) {
        errors.push(...xssDetected.patterns);
        return { valid: false, errors, warnings };
      }
    }

    return {
      valid: true,
      sanitized,
      errors,
      warnings
    };
  }

  /**
   * Sanitize SQL input (for validation of parameterized queries)
   * Note: This does NOT make string concatenation safe!
   * Always use parameterized queries.
   */
  static validateSQLParameter(input: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Null/undefined is ok for SQL params
    if (input === null || input === undefined) {
      return { valid: true, sanitized: String(input), errors, warnings };
    }

    // Numbers are safe
    if (typeof input === 'number' && isFinite(input)) {
      return { valid: true, sanitized: String(input), errors, warnings };
    }

    // Booleans are safe
    if (typeof input === 'boolean') {
      return { valid: true, sanitized: String(input), errors, warnings };
    }

    // Strings need validation
    if (typeof input === 'string') {
      // Check for SQL injection patterns - use a more comprehensive regex
      const sqlPatterns = [
        /[';]/,  // SQL delimiters
        /(--|\*\/|\/\*)/,  // SQL comments
        /(union|select|insert|update|delete|drop|create|alter|exec|execute)/i,  // SQL keywords
        /(\b(or|and)\b\s*['"]?\d+['"]?\s*=\s*['"]?\d+)/i  // Boolean conditions
      ];

      for (const pattern of sqlPatterns) {
        if (pattern.test(input)) {
          warnings.push(
            'Input contains SQL-like patterns. Ensure you are using parameterized queries!'
          );
          break;
        }
      }

      return {
        valid: true,
        sanitized: input,
        errors,
        warnings
      };
    }

    // Objects/Arrays should be JSON stringified
    if (typeof input === 'object') {
      try {
        const sanitized = JSON.stringify(input);
        return { valid: true, sanitized, errors, warnings };
      } catch (error) {
        errors.push('Failed to serialize object to JSON');
        return { valid: false, errors, warnings };
      }
    }

    errors.push(`Unsupported input type: ${typeof input}`);
    return { valid: false, errors, warnings };
  }

  /**
   * Detect potential XSS patterns
   */
  private static detectXSS(input: string): {
    detected: boolean;
    patterns: string[];
  } {
    const patterns: string[] = [];

    for (const pattern of this.XSS_DANGEROUS_PATTERNS) {
      if (pattern.test(input)) {
        patterns.push(`Detected XSS pattern: ${pattern.source}`);
      }
    }

    return {
      detected: patterns.length > 0,
      patterns
    };
  }

  /**
   * Sanitize HTML (strip all tags by default)
   */
  static sanitizeHTML(input: string, allowedTags: string[] = []): string {
    let sanitized = input;

    // Strip all HTML tags first
    sanitized = sanitized.replace(/<[^>]*>/g, '');

    // Escape special characters
    sanitized = sanitized
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');

    return sanitized;
  }

  /**
   * Decode HTML entities
   */
  private static decodeHTMLEntities(input: string): string {
    return input
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&#x2F;/g, '/');
  }

  /**
   * Validate and sanitize file path
   */
  static validatePath(
    input: string,
    options: PathValidationOptions = {}
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (typeof input !== 'string') {
      errors.push('Path must be a string');
      return { valid: false, errors, warnings };
    }

    let sanitized = input.trim();

    // Check for path traversal BEFORE normalization
    if (!options.allowTraversal) {
      if (/\.\./.test(sanitized)) {
        errors.push('Path contains traversal sequences');
        return { valid: false, errors, warnings };
      }
    }

    // Check for absolute paths
    if (!options.allowAbsolute && path.isAbsolute(sanitized)) {
      errors.push('Absolute paths are not allowed');
      return { valid: false, errors, warnings };
    }

    // Normalize the path
    try {
      sanitized = path.normalize(sanitized);
    } catch (error) {
      errors.push('Failed to normalize path');
      return { valid: false, errors, warnings };
    }

    // Validate against base directory
    if (options.baseDirectory) {
      const resolvedPath = path.resolve(options.baseDirectory, sanitized);
      const resolvedBase = path.resolve(options.baseDirectory);

      if (!resolvedPath.startsWith(resolvedBase)) {
        errors.push('Path escapes base directory');
        return { valid: false, errors, warnings };
      }

      sanitized = resolvedPath;
    }

    // Check file extension
    if (options.allowedExtensions) {
      const ext = path.extname(sanitized).toLowerCase();
      if (!options.allowedExtensions.includes(ext)) {
        errors.push(
          `File extension '${ext}' is not allowed. Allowed: ${options.allowedExtensions.join(', ')}`
        );
        return { valid: false, errors, warnings };
      }
    }

    return {
      valid: true,
      sanitized,
      errors,
      warnings
    };
  }

  /**
   * Validate shell command
   */
  static validateCommand(
    command: string,
    args: string[],
    options: CommandValidationOptions = {}
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate command
    if (options.allowedCommands) {
      if (!options.allowedCommands.includes(command)) {
        errors.push(
          `Command '${command}' is not allowed. Allowed: ${options.allowedCommands.join(', ')}`
        );
        return { valid: false, errors, warnings };
      }
    }

    // Check for command injection patterns
    const dangerousPatterns = [
      /[;&|`$(){}[\]<>]/,
      /\$\(/,
      /`.*`/,
      /\$\{.*\}/
    ];

    for (const arg of args) {
      for (const pattern of dangerousPatterns) {
        if (pattern.test(arg)) {
          errors.push(`Argument contains dangerous pattern: ${arg}`);
          return { valid: false, errors, warnings };
        }
      }
    }

    // Validate flags
    if (options.allowedFlags) {
      for (const arg of args) {
        if (arg.startsWith('-') || arg.startsWith('--')) {
          const flag = arg.split('=')[0];
          if (!options.allowedFlags.includes(flag)) {
            errors.push(`Flag '${flag}' is not allowed`);
            return { valid: false, errors, warnings };
          }
        }
      }
    }

    // Check max length
    const fullCommand = `${command} ${args.join(' ')}`;
    if (options.maxLength && fullCommand.length > options.maxLength) {
      errors.push(`Command exceeds maximum length of ${options.maxLength}`);
      return { valid: false, errors, warnings };
    }

    return {
      valid: true,
      sanitized: fullCommand,
      errors,
      warnings
    };
  }

  /**
   * Sanitize sensitive data (for logging)
   */
  static sanitizeSensitiveData(obj: any, visited = new WeakSet()): any {
    const sensitiveKeys = [
      'password',
      'passwd',
      'pwd',
      'secret',
      'token',
      'key',
      'apikey',
      'api_key',
      'credential',
      'auth',
      'authorization',
      'cookie',
      'session',
      'private'
    ];

    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    // Prevent circular reference issues
    if (visited.has(obj)) {
      return '[Circular]';
    }
    visited.add(obj);

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeSensitiveData(item, visited));
    }

    const sanitized: any = {};

    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();

      if (sensitiveKeys.some(sk => lowerKey.includes(sk))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeSensitiveData(value, visited);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Generate secure hash for input
   */
  static hashInput(input: string): string {
    return createHash('sha256').update(input).digest('hex');
  }

  /**
   * Validate email address
   */
  static validateEmail(email: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      errors.push('Invalid email format');
      return { valid: false, errors, warnings };
    }

    return {
      valid: true,
      sanitized: email.toLowerCase().trim(),
      errors,
      warnings
    };
  }

  /**
   * Validate URL
   */
  static validateURL(url: string, allowedProtocols: string[] = ['http', 'https']): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const parsed = new URL(url);

      if (!allowedProtocols.includes(parsed.protocol.replace(':', ''))) {
        errors.push(
          `Protocol '${parsed.protocol}' not allowed. Allowed: ${allowedProtocols.join(', ')}`
        );
        return { valid: false, errors, warnings };
      }

      return {
        valid: true,
        sanitized: parsed.toString(),
        errors,
        warnings
      };
    } catch (error) {
      errors.push('Invalid URL format');
      return { valid: false, errors, warnings };
    }
  }
}

// ============================================================================
// Exports
// ============================================================================

export default InputSanitizer;
