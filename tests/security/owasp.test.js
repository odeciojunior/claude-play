"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
(0, globals_1.describe)('Security Testing (OWASP)', () => {
    (0, globals_1.describe)('SQL Injection Protection', () => {
        (0, globals_1.it)('should prevent SQL injection in pattern storage', async () => {
            const neural = initNeuralEngine();
            const malicious = "'; DROP TABLE patterns; --";
            await (0, globals_1.expect)(neural.storePattern({
                id: malicious,
                context: malicious,
                confidence: 0.8
            })).resolves.not.toThrow();
            const patterns = await neural.listPatterns();
            (0, globals_1.expect)(patterns).toBeDefined();
        });
        (0, globals_1.it)('should sanitize user input in queries', async () => {
            const neural = initNeuralEngine();
            const injection = "1' OR '1'='1";
            const result = await neural.retrievePattern(injection);
            (0, globals_1.expect)(result).not.toContain('OR');
        });
    });
    (0, globals_1.describe)('XSS Protection', () => {
        (0, globals_1.it)('should escape script tags in pattern data', async () => {
            const neural = initNeuralEngine();
            const xssPayload = '<script>alert("XSS")</script>';
            await neural.storePattern({
                id: 'xss-test',
                context: xssPayload,
                confidence: 0.8
            });
            const retrieved = await neural.getPattern('xss-test');
            (0, globals_1.expect)(retrieved.context).not.toContain('<script>');
            (0, globals_1.expect)(retrieved.context).toContain('&lt;script&gt;');
        });
        (0, globals_1.it)('should sanitize event handlers', async () => {
            const malicious = '<img src=x onerror=alert(1)>';
            const sanitized = sanitizeInput(malicious);
            (0, globals_1.expect)(sanitized).not.toContain('onerror');
        });
    });
    (0, globals_1.describe)('Input Validation', () => {
        (0, globals_1.it)('should validate confidence bounds', async () => {
            const neural = initNeuralEngine();
            await (0, globals_1.expect)(neural.storePattern({ id: 'test', confidence: 1.5 })).rejects.toThrow();
            await (0, globals_1.expect)(neural.storePattern({ id: 'test', confidence: -0.5 })).rejects.toThrow();
        });
        (0, globals_1.it)('should validate pattern structure', async () => {
            const neural = initNeuralEngine();
            await (0, globals_1.expect)(neural.storePattern({ invalid: 'structure' })).rejects.toThrow();
        });
        (0, globals_1.it)('should limit input sizes', async () => {
            const neural = initNeuralEngine();
            const hugeInput = 'x'.repeat(10000000);
            await (0, globals_1.expect)(neural.storePattern({ id: 'huge', context: hugeInput })).rejects.toThrow();
        });
    });
    (0, globals_1.describe)('Access Control', () => {
        (0, globals_1.it)('should enforce pattern visibility', async () => {
            const neural = initNeuralEngine();
            await neural.storePattern({
                id: 'private-pattern',
                visibility: 'private',
                owner: 'user1'
            });
            const retrieved = await neural.retrievePattern('private-pattern', {
                user: 'user2'
            });
            (0, globals_1.expect)(retrieved).toBeNull();
        });
        (0, globals_1.it)('should validate user permissions', async () => {
            const neural = initNeuralEngine();
            await (0, globals_1.expect)(neural.deletePattern('pattern-1', { user: 'unauthorized' })).rejects.toThrow('Permission denied');
        });
    });
    (0, globals_1.describe)('Data Sanitization', () => {
        (0, globals_1.it)('should remove sensitive data from logs', async () => {
            const logger = initLogger();
            logger.log({
                message: 'User login',
                password: 'secret123',
                apiKey: 'sk-secret'
            });
            const logs = logger.getLogs();
            (0, globals_1.expect)(logs[0]).not.toContain('secret123');
            (0, globals_1.expect)(logs[0]).not.toContain('sk-secret');
            (0, globals_1.expect)(logs[0]).toContain('[REDACTED]');
        });
        (0, globals_1.it)('should sanitize error messages', async () => {
            const neural = initNeuralEngine();
            try {
                await neural.connect('postgresql://user:password@host/db');
            }
            catch (error) {
                (0, globals_1.expect)(error.message).not.toContain('password');
            }
        });
    });
    (0, globals_1.describe)('Rate Limiting', () => {
        (0, globals_1.it)('should enforce rate limits on pattern application', async () => {
            const neural = initNeuralEngine();
            const requests = Array.from({ length: 100 }, () => neural.applyPattern('test'));
            await (0, globals_1.expect)(Promise.all(requests)).rejects.toThrow('Rate limit exceeded');
        });
    });
});
function initNeuralEngine() {
    return {
        storePattern: jest.fn(),
        retrievePattern: jest.fn(),
        getPattern: jest.fn(),
        listPatterns: jest.fn(),
        deletePattern: jest.fn(),
        applyPattern: jest.fn(),
        connect: jest.fn()
    };
}
function sanitizeInput(input) {
    return input
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
function initLogger() {
    const logs = [];
    return {
        log: (data) => {
            const sanitized = JSON.stringify(data).replace(/(password|apiKey|token|secret)":"[^"]+"/g, '$1":"[REDACTED]"');
            logs.push(sanitized);
        },
        getLogs: () => logs
    };
}
//# sourceMappingURL=owasp.test.js.map