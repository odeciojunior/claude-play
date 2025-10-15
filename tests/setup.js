"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
globals_1.jest.setTimeout(30000);
global.console = {
    ...console,
    log: globals_1.jest.fn(),
    debug: globals_1.jest.fn(),
    info: globals_1.jest.fn(),
    warn: globals_1.jest.fn()
};
beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DB_PATH = ':memory:';
});
afterAll(async () => {
});
afterEach(() => {
    globals_1.jest.clearAllMocks();
});
//# sourceMappingURL=setup.js.map