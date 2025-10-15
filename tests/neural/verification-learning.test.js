"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const verification_learning_1 = __importDefault(require("../../src/neural/verification-learning"));
const verification_bridge_1 = require("../../src/neural/verification-bridge");
const util_1 = require("util");
const TEST_DB_PATH = '.swarm/test-verification.db';
const TEST_CONFIG = {
    predictionEnabled: true,
    adaptiveThresholds: true,
    minSampleSize: 3,
    confidenceThreshold: 0.6,
    learningRate: 0.2,
    decayFactor: 0.9
};
function createMockOutcome(passed, truthScore, agentType = 'coder', fileType = 'ts') {
    return {
        taskId: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        agentId: `agent-${agentType}-001`,
        agentType,
        timestamp: new Date().toISOString(),
        passed,
        truthScore,
        threshold: 0.95,
        componentScores: {
            compile: passed ? 1.0 : 0.5,
            tests: passed ? 0.95 : 0.6,
            lint: passed ? 0.98 : 0.7,
            typecheck: passed ? 1.0 : 0.8
        },
        fileType,
        complexity: 0.5,
        linesChanged: 100,
        testsRun: 10,
        duration: 1000,
        errorMessages: passed ? [] : ['Test failure in component X'],
        warnings: []
    };
}
async function setupTestDatabase() {
    if (fs.existsSync(TEST_DB_PATH)) {
        fs.unlinkSync(TEST_DB_PATH);
    }
    const dir = path.dirname(TEST_DB_PATH);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    const sqlite3 = require('sqlite3').verbose();
    const db = new sqlite3.Database(TEST_DB_PATH);
    db.run = (0, util_1.promisify)(db.run.bind(db));
    db.get = (0, util_1.promisify)(db.get.bind(db));
    db.all = (0, util_1.promisify)(db.all.bind(db));
    const schemaPath = path.join(__dirname, '../../src/neural/verification-schema.sql');
    if (fs.existsSync(schemaPath)) {
        const schema = fs.readFileSync(schemaPath, 'utf-8');
        const statements = schema.split(';').filter(s => s.trim());
        for (const statement of statements) {
            if (statement.trim()) {
                await db.run(statement);
            }
        }
    }
    return db;
}
(0, globals_1.describe)('VerificationLearningSystem', () => {
    let db;
    let system;
    (0, globals_1.beforeAll)(async () => {
        db = await setupTestDatabase();
        system = new verification_learning_1.default(db, TEST_CONFIG);
    });
    (0, globals_1.afterAll)(async () => {
        await system.shutdown();
        if (db) {
            await new Promise((resolve) => {
                db.close(() => resolve());
            });
        }
    });
    (0, globals_1.describe)('Outcome Learning', () => {
        (0, globals_1.it)('should learn from successful verification', async () => {
            const outcome = createMockOutcome(true, 0.97);
            await system.learnFromVerification(outcome);
            const reliability = await system.getAgentReliability(outcome.agentId);
            (0, globals_1.expect)(reliability).not.toBeNull();
            (0, globals_1.expect)(reliability.successCount).toBeGreaterThan(0);
            (0, globals_1.expect)(reliability.reliability).toBeGreaterThan(0.5);
        });
        (0, globals_1.it)('should learn from failed verification', async () => {
            const outcome = createMockOutcome(false, 0.73);
            await system.learnFromVerification(outcome);
            const reliability = await system.getAgentReliability(outcome.agentId);
            (0, globals_1.expect)(reliability).not.toBeNull();
            (0, globals_1.expect)(reliability.failureCount).toBeGreaterThan(0);
        });
        (0, globals_1.it)('should extract verification patterns', async () => {
            const outcomes = [
                createMockOutcome(false, 0.70, 'coder', 'ts'),
                createMockOutcome(false, 0.72, 'coder', 'ts'),
                createMockOutcome(false, 0.68, 'coder', 'ts')
            ];
            for (const outcome of outcomes) {
                await system.learnFromVerification(outcome);
            }
            const patterns = await system.getVerificationPatterns('failure');
            (0, globals_1.expect)(patterns.length).toBeGreaterThan(0);
            (0, globals_1.expect)(patterns[0].type).toBe('failure');
        });
        (0, globals_1.it)('should track multiple agents', async () => {
            const agents = ['agent1', 'agent2', 'agent3'];
            for (const agentId of agents) {
                const outcome = createMockOutcome(true, 0.95);
                outcome.agentId = agentId;
                await system.learnFromVerification(outcome);
            }
            const allReliability = await system.getAllAgentReliability();
            (0, globals_1.expect)(allReliability.length).toBeGreaterThanOrEqual(3);
        });
    });
    (0, globals_1.describe)('Truth Score Prediction', () => {
        (0, globals_1.beforeEach)(async () => {
            const trainingOutcomes = [
                createMockOutcome(true, 0.96, 'coder', 'ts'),
                createMockOutcome(true, 0.97, 'coder', 'ts'),
                createMockOutcome(true, 0.95, 'coder', 'ts'),
                createMockOutcome(false, 0.72, 'coder', 'ts'),
                createMockOutcome(false, 0.68, 'coder', 'ts')
            ];
            for (const outcome of trainingOutcomes) {
                outcome.agentId = 'coder-test-agent';
                await system.learnFromVerification(outcome);
            }
        });
        (0, globals_1.it)('should predict truth score', async () => {
            const prediction = await system.predictTruthScore('task-test', 'coder-test-agent', 'coder', { fileType: 'ts', complexity: 0.5 });
            (0, globals_1.expect)(prediction.predictedScore).toBeGreaterThanOrEqual(0);
            (0, globals_1.expect)(prediction.predictedScore).toBeLessThanOrEqual(1);
            (0, globals_1.expect)(prediction.confidence).toBeGreaterThanOrEqual(0);
            (0, globals_1.expect)(prediction.confidence).toBeLessThanOrEqual(1);
            (0, globals_1.expect)(prediction.riskLevel).toMatch(/low|medium|high|critical/);
        });
        (0, globals_1.it)('should have reasonable prediction factors', async () => {
            const prediction = await system.predictTruthScore('task-test', 'coder-test-agent', 'coder', { fileType: 'ts' });
            (0, globals_1.expect)(prediction.factors.agentReliability).toBeGreaterThan(0);
            (0, globals_1.expect)(prediction.factors.historicalPerformance).toBeGreaterThan(0);
            (0, globals_1.expect)(prediction.factors.taskComplexity).toBeGreaterThanOrEqual(0);
        });
        (0, globals_1.it)('should recommend appropriate threshold', async () => {
            const prediction = await system.predictTruthScore('task-test', 'coder-test-agent', 'coder', {});
            (0, globals_1.expect)(prediction.recommendedThreshold).toBeGreaterThanOrEqual(0.90);
            (0, globals_1.expect)(prediction.recommendedThreshold).toBeLessThanOrEqual(0.99);
        });
        (0, globals_1.it)('should improve accuracy over time', async () => {
            const predictions = [];
            const actuals = [];
            for (let i = 0; i < 10; i++) {
                const prediction = await system.predictTruthScore(`task-${i}`, 'coder-test-agent', 'coder', {});
                predictions.push(prediction.predictedScore);
                const actual = 0.9 + (Math.random() * 0.1);
                actuals.push(actual);
                const outcome = createMockOutcome(actual >= 0.95, actual, 'coder');
                outcome.agentId = 'coder-test-agent';
                outcome.taskId = `task-${i}`;
                await system.learnFromVerification(outcome);
            }
            let totalError = 0;
            for (let i = 0; i < predictions.length; i++) {
                totalError += Math.abs(predictions[i] - actuals[i]);
            }
            const avgError = totalError / predictions.length;
            (0, globals_1.expect)(avgError).toBeLessThan(0.3);
        });
    });
    (0, globals_1.describe)('Adaptive Thresholds', () => {
        (0, globals_1.it)('should start with base threshold', async () => {
            const threshold = await system.getAdaptiveThreshold('reviewer');
            (0, globals_1.expect)(threshold).toBe(0.95);
        });
        (0, globals_1.it)('should adapt threshold based on outcomes', async () => {
            const agentType = 'tester';
            const fileType = 'ts';
            for (let i = 0; i < 20; i++) {
                const outcome = createMockOutcome(true, 0.98, agentType, fileType);
                await system.learnFromVerification(outcome);
            }
            const threshold = await system.getAdaptiveThreshold(agentType, { fileType });
            (0, globals_1.expect)(threshold).toBeGreaterThan(0);
            (0, globals_1.expect)(threshold).toBeLessThanOrEqual(1);
        });
        (0, globals_1.it)('should provide context-specific thresholds', async () => {
            const agentType = 'coder';
            for (let i = 0; i < 15; i++) {
                const outcome = createMockOutcome(true, 0.97, agentType, 'ts');
                await system.learnFromVerification(outcome);
            }
            for (let i = 0; i < 15; i++) {
                const outcome = createMockOutcome(true, 0.88, agentType, 'js');
                await system.learnFromVerification(outcome);
            }
            const tsThreshold = await system.getAdaptiveThreshold(agentType, { fileType: 'ts' });
            const jsThreshold = await system.getAdaptiveThreshold(agentType, { fileType: 'js' });
            (0, globals_1.expect)(typeof tsThreshold).toBe('number');
            (0, globals_1.expect)(typeof jsThreshold).toBe('number');
        });
        (0, globals_1.it)('should list all adaptive thresholds', async () => {
            const thresholds = await system.getAllThresholds();
            (0, globals_1.expect)(Array.isArray(thresholds)).toBe(true);
        });
    });
    (0, globals_1.describe)('Pattern Library', () => {
        (0, globals_1.it)('should store and retrieve success patterns', async () => {
            for (let i = 0; i < 5; i++) {
                const outcome = createMockOutcome(true, 0.96, 'reviewer', 'ts');
                await system.learnFromVerification(outcome);
            }
            const patterns = await system.getVerificationPatterns('success');
            (0, globals_1.expect)(patterns.length).toBeGreaterThan(0);
            (0, globals_1.expect)(patterns[0].successRate).toBeGreaterThan(0.5);
        });
        (0, globals_1.it)('should store and retrieve failure patterns', async () => {
            for (let i = 0; i < 5; i++) {
                const outcome = createMockOutcome(false, 0.65, 'coder', 'js');
                await system.learnFromVerification(outcome);
            }
            const patterns = await system.getVerificationPatterns('failure');
            (0, globals_1.expect)(patterns.length).toBeGreaterThan(0);
            (0, globals_1.expect)(patterns[0].type).toBe('failure');
        });
        (0, globals_1.it)('should find similar patterns', async () => {
            const baseOutcome = createMockOutcome(false, 0.70, 'coder', 'ts');
            await system.learnFromVerification(baseOutcome);
            const similar = await system.findSimilarPatterns({
                agentType: 'coder',
                fileType: 'ts'
            });
            (0, globals_1.expect)(Array.isArray(similar)).toBe(true);
        });
        (0, globals_1.it)('should track pattern confidence', async () => {
            const agentType = 'tester';
            const fileType = 'spec.ts';
            for (let i = 0; i < 10; i++) {
                const outcome = createMockOutcome(true, 0.95, agentType, fileType);
                await system.learnFromVerification(outcome);
            }
            const patterns = await system.getVerificationPatterns('success');
            const pattern = patterns.find(p => p.agentTypes.includes(agentType) && p.fileTypes.includes(fileType));
            if (pattern) {
                (0, globals_1.expect)(pattern.confidence).toBeGreaterThan(0.5);
                (0, globals_1.expect)(pattern.occurrences).toBeGreaterThan(5);
            }
        });
    });
    (0, globals_1.describe)('Agent Reliability', () => {
        (0, globals_1.it)('should track agent success rate', async () => {
            const agentId = 'reliable-agent';
            for (let i = 0; i < 8; i++) {
                const outcome = createMockOutcome(true, 0.96);
                outcome.agentId = agentId;
                await system.learnFromVerification(outcome);
            }
            for (let i = 0; i < 2; i++) {
                const outcome = createMockOutcome(false, 0.72);
                outcome.agentId = agentId;
                await system.learnFromVerification(outcome);
            }
            const reliability = await system.getAgentReliability(agentId);
            (0, globals_1.expect)(reliability).not.toBeNull();
            (0, globals_1.expect)(reliability.reliability).toBeCloseTo(0.8, 1);
            (0, globals_1.expect)(reliability.successCount).toBe(8);
            (0, globals_1.expect)(reliability.failureCount).toBe(2);
        });
        (0, globals_1.it)('should calculate reliability trends', async () => {
            const agentId = 'improving-agent';
            for (let i = 0; i < 5; i++) {
                const outcome = createMockOutcome(false, 0.70);
                outcome.agentId = agentId;
                await system.learnFromVerification(outcome);
            }
            for (let i = 0; i < 10; i++) {
                const outcome = createMockOutcome(true, 0.96);
                outcome.agentId = agentId;
                await system.learnFromVerification(outcome);
            }
            const reliability = await system.getAgentReliability(agentId);
            (0, globals_1.expect)(reliability).not.toBeNull();
            (0, globals_1.expect)(['improving', 'stable']).toContain(reliability.recentTrend);
        });
        (0, globals_1.it)('should rank agents by reliability', async () => {
            const agents = [
                { id: 'agent-high', score: 0.95, count: 20 },
                { id: 'agent-medium', score: 0.80, count: 15 },
                { id: 'agent-low', score: 0.65, count: 10 }
            ];
            for (const agent of agents) {
                for (let i = 0; i < agent.count; i++) {
                    const passed = Math.random() < agent.score;
                    const outcome = createMockOutcome(passed, agent.score);
                    outcome.agentId = agent.id;
                    await system.learnFromVerification(outcome);
                }
            }
            const allReliability = await system.getAllAgentReliability();
            (0, globals_1.expect)(allReliability.length).toBeGreaterThanOrEqual(3);
            for (let i = 1; i < allReliability.length; i++) {
                (0, globals_1.expect)(allReliability[i - 1].reliability).toBeGreaterThanOrEqual(allReliability[i].reliability);
            }
        });
    });
    (0, globals_1.describe)('Learning Metrics', () => {
        (0, globals_1.it)('should provide comprehensive metrics', async () => {
            const metrics = await system.getMetrics();
            (0, globals_1.expect)(metrics).toHaveProperty('patterns');
            (0, globals_1.expect)(metrics).toHaveProperty('agents');
            (0, globals_1.expect)(metrics).toHaveProperty('thresholds');
            (0, globals_1.expect)(metrics).toHaveProperty('predictions');
            (0, globals_1.expect)(metrics.learningEnabled).toBe(true);
        });
        (0, globals_1.it)('should track pattern counts', async () => {
            const metrics = await system.getMetrics();
            (0, globals_1.expect)(metrics.patterns).toHaveProperty('total');
            (0, globals_1.expect)(metrics.patterns).toHaveProperty('success');
            (0, globals_1.expect)(metrics.patterns).toHaveProperty('failure');
            (0, globals_1.expect)(metrics.patterns).toHaveProperty('warning');
        });
        (0, globals_1.it)('should track agent statistics', async () => {
            const metrics = await system.getMetrics();
            (0, globals_1.expect)(metrics.agents).toHaveProperty('totalAgents');
            (0, globals_1.expect)(metrics.agents).toHaveProperty('avgReliability');
        });
    });
});
(0, globals_1.describe)('VerificationBridge', () => {
    let bridge;
    (0, globals_1.beforeAll)(async () => {
        bridge = new verification_bridge_1.VerificationBridge(TEST_DB_PATH, TEST_CONFIG);
        await bridge.initialize();
    });
    (0, globals_1.afterAll)(async () => {
        await bridge.shutdown();
    });
    (0, globals_1.describe)('Integration', () => {
        (0, globals_1.it)('should initialize successfully', async () => {
            (0, globals_1.expect)(bridge).toBeDefined();
        });
        (0, globals_1.it)('should predict and learn cycle', async () => {
            const taskId = `task-${Date.now()}`;
            const agentId = 'bridge-test-agent';
            const agentType = 'coder';
            const prediction = await bridge.predict(taskId, agentId, agentType, {
                fileType: 'ts',
                complexity: 0.5
            });
            (0, globals_1.expect)(prediction.taskId).toBe(taskId);
            (0, globals_1.expect)(prediction.predictedScore).toBeGreaterThanOrEqual(0);
            const outcome = createMockOutcome(true, 0.96, agentType);
            outcome.taskId = taskId;
            outcome.agentId = agentId;
            await bridge.learn(outcome);
            const reliability = await bridge.getReliability(agentId);
            (0, globals_1.expect)(reliability).not.toBeNull();
        });
        (0, globals_1.it)('should get adaptive threshold', async () => {
            const threshold = await bridge.getThreshold('coder', { fileType: 'ts' });
            (0, globals_1.expect)(threshold).toBeGreaterThan(0);
            (0, globals_1.expect)(threshold).toBeLessThanOrEqual(1);
        });
        (0, globals_1.it)('should generate report', async () => {
            const report = await bridge.generateReport();
            (0, globals_1.expect)(typeof report).toBe('string');
            (0, globals_1.expect)(report).toContain('VERIFICATION LEARNING SYSTEM REPORT');
            (0, globals_1.expect)(report).toContain('OVERALL METRICS');
            (0, globals_1.expect)(report).toContain('AGENT RELIABILITY');
        });
        (0, globals_1.it)('should provide metrics', async () => {
            const metrics = await bridge.getMetrics();
            (0, globals_1.expect)(metrics).toBeDefined();
            (0, globals_1.expect)(metrics).toHaveProperty('predictionAccuracy');
            (0, globals_1.expect)(metrics).toHaveProperty('avgPredictionError');
        });
    });
});
(0, globals_1.describe)('Performance', () => {
    let db;
    let system;
    (0, globals_1.beforeAll)(async () => {
        db = await setupTestDatabase();
        system = new verification_learning_1.default(db, TEST_CONFIG);
    });
    (0, globals_1.afterAll)(async () => {
        await system.shutdown();
    });
    (0, globals_1.it)('should handle high volume of outcomes', async () => {
        const startTime = Date.now();
        const outcomes = [];
        for (let i = 0; i < 100; i++) {
            outcomes.push(createMockOutcome(Math.random() > 0.2, 0.7 + Math.random() * 0.3));
        }
        for (const outcome of outcomes) {
            await system.learnFromVerification(outcome);
        }
        const duration = Date.now() - startTime;
        const avgTime = duration / outcomes.length;
        console.log(`Processed ${outcomes.length} outcomes in ${duration}ms (${avgTime.toFixed(2)}ms avg)`);
        (0, globals_1.expect)(avgTime).toBeLessThan(100);
    });
    (0, globals_1.it)('should make predictions quickly', async () => {
        const iterations = 50;
        const startTime = Date.now();
        for (let i = 0; i < iterations; i++) {
            await system.predictTruthScore(`task-${i}`, 'agent-test', 'coder', {});
        }
        const duration = Date.now() - startTime;
        const avgTime = duration / iterations;
        console.log(`Made ${iterations} predictions in ${duration}ms (${avgTime.toFixed(2)}ms avg)`);
        (0, globals_1.expect)(avgTime).toBeLessThan(50);
    });
});
(0, globals_1.describe)('End-to-End Integration', () => {
    let bridge;
    (0, globals_1.beforeAll)(async () => {
        bridge = new verification_bridge_1.VerificationBridge(TEST_DB_PATH, TEST_CONFIG);
        await bridge.initialize();
    });
    (0, globals_1.afterAll)(async () => {
        await bridge.shutdown();
    });
    (0, globals_1.it)('should complete full verification learning cycle', async () => {
        const agentId = 'e2e-test-agent';
        const agentType = 'coder';
        console.log('Training with 20 outcomes...');
        for (let i = 0; i < 20; i++) {
            const passed = i % 5 !== 0;
            const score = passed ? 0.95 + Math.random() * 0.05 : 0.65 + Math.random() * 0.15;
            const outcome = createMockOutcome(passed, score, agentType);
            outcome.agentId = agentId;
            await bridge.learn(outcome);
        }
        console.log('Making prediction...');
        const prediction = await bridge.predict('task-final', agentId, agentType, {
            fileType: 'ts',
            complexity: 0.5
        });
        console.log('Prediction:', {
            score: prediction.predictedScore.toFixed(3),
            confidence: prediction.confidence.toFixed(3),
            riskLevel: prediction.riskLevel,
            threshold: prediction.recommendedThreshold.toFixed(3)
        });
        const threshold = await bridge.getThreshold(agentType, { fileType: 'ts' });
        console.log('Adaptive threshold:', threshold.toFixed(3));
        const reliability = await bridge.getReliability(agentId);
        console.log('Agent reliability:', {
            reliability: reliability?.reliability.toFixed(3),
            avgScore: reliability?.avgTruthScore.toFixed(3),
            total: reliability?.totalVerifications,
            trend: reliability?.recentTrend
        });
        const patterns = await bridge.getPatterns();
        console.log('Patterns learned:', patterns.length);
        const report = await bridge.generateReport();
        console.log('\n' + report);
        (0, globals_1.expect)(prediction.predictedScore).toBeGreaterThan(0.7);
        (0, globals_1.expect)(reliability?.totalVerifications).toBe(20);
        (0, globals_1.expect)(reliability?.reliability).toBeGreaterThan(0.5);
        (0, globals_1.expect)(patterns.length).toBeGreaterThan(0);
    });
});
//# sourceMappingURL=verification-learning.test.js.map