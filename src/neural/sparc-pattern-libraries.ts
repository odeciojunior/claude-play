/**
 * SPARC Phase-Specific Pattern Libraries
 *
 * Pre-built pattern libraries for each SPARC phase, bootstrapping the
 * learning system with proven best practices.
 *
 * @module sparc-pattern-libraries
 */

import { SPARCPattern, PatternCategory, SPARCPhase } from './sparc-integration';

// ============================================================================
// Specification Phase Patterns
// ============================================================================

export const specificationPatterns: Omit<SPARCPattern, 'id' | 'created_at' | 'last_used'>[] = [
  {
    phase: 'specification',
    category: 'requirement_template',
    pattern_data: {
      name: 'User Story Format',
      description: 'Standard user story template with acceptance criteria',
      context: { type: 'feature', audience: 'end-user' },
      template: `
As a [user type]
I want [goal]
So that [benefit]

Acceptance Criteria:
- [ ] Given [context], when [action], then [outcome]
- [ ] Given [context], when [action], then [outcome]
- [ ] Edge cases handled: [list]
      `,
      examples: [
        'As a developer, I want code autocompletion, so that I can write code faster',
        'As an admin, I want user analytics, so that I can monitor system usage',
      ],
      success_indicators: ['Clear acceptance criteria', 'Testable requirements', 'Defined edge cases'],
      antipatterns: ['Vague requirements', 'No acceptance criteria', 'Technical jargon for business users'],
    },
    confidence: 0.95,
    usage_count: 150,
    success_count: 145,
    avg_time_saved: 300, // 5 minutes
    avg_quality_improvement: 0.85,
    metadata: { source: 'agile_methodology', verified: true },
  },
  {
    phase: 'specification',
    category: 'acceptance_criteria',
    pattern_data: {
      name: 'Given-When-Then BDD',
      description: 'Behavior-driven development acceptance criteria format',
      context: { type: 'behavior_specification', testing_framework: 'gherkin' },
      template: `
Given [initial context]
When [event occurs]
Then [expected outcome]
And [additional outcomes]
      `,
      examples: [
        'Given user is logged in, When user clicks logout, Then user is redirected to home page',
        'Given shopping cart has items, When user clicks checkout, Then payment form is displayed',
      ],
      success_indicators: ['Testable scenarios', 'Clear preconditions', 'Measurable outcomes'],
      antipatterns: ['Ambiguous steps', 'Missing context', 'Untestable criteria'],
    },
    confidence: 0.92,
    usage_count: 200,
    success_count: 188,
    avg_time_saved: 180,
    avg_quality_improvement: 0.88,
    metadata: { source: 'bdd_patterns', verified: true },
  },
  {
    phase: 'specification',
    category: 'requirement_template',
    pattern_data: {
      name: 'API Endpoint Specification',
      description: 'RESTful API endpoint requirement template',
      context: { type: 'api', protocol: 'rest' },
      template: `
Endpoint: [METHOD] /api/v1/[resource]
Description: [What this endpoint does]

Request:
- Headers: [required headers]
- Body: [request schema]
- Query Params: [optional params]

Response:
- Success (200): [response schema]
- Error (4xx/5xx): [error schema]

Authentication: [required/optional]
Rate Limiting: [requests per minute]
      `,
      examples: ['POST /api/v1/users - Create new user', 'GET /api/v1/orders/:id - Retrieve order details'],
      success_indicators: ['Complete request/response schemas', 'Auth requirements clear', 'Error handling defined'],
      antipatterns: ['Missing error cases', 'Unclear auth', 'No rate limiting'],
    },
    confidence: 0.90,
    usage_count: 120,
    success_count: 110,
    avg_time_saved: 420,
    avg_quality_improvement: 0.82,
    metadata: { source: 'rest_api_design', verified: true },
  },
  {
    phase: 'specification',
    category: 'acceptance_criteria',
    pattern_data: {
      name: 'Performance Requirements',
      description: 'Quantifiable performance acceptance criteria',
      context: { type: 'performance', metrics: 'latency_throughput' },
      template: `
Performance Requirements:
- Latency: p50 < [X]ms, p95 < [Y]ms, p99 < [Z]ms
- Throughput: [N] requests per second
- Concurrent Users: [M] simultaneous users
- Data Volume: Handle [X] records
- Response Time: [Y]ms for [operation]
      `,
      examples: ['API latency: p95 < 200ms', 'Database queries: p99 < 50ms', 'Page load: p50 < 1s'],
      success_indicators: ['Measurable metrics', 'Realistic targets', 'Multiple percentiles'],
      antipatterns: ['Vague "fast" requirements', 'Only average metrics', 'Unrealistic targets'],
    },
    confidence: 0.88,
    usage_count: 85,
    success_count: 78,
    avg_time_saved: 240,
    avg_quality_improvement: 0.80,
    metadata: { source: 'performance_engineering', verified: true },
  },
];

// ============================================================================
// Pseudocode Phase Patterns
// ============================================================================

export const pseudocodePatterns: Omit<SPARCPattern, 'id' | 'created_at' | 'last_used'>[] = [
  {
    phase: 'pseudocode',
    category: 'algorithm_design',
    pattern_data: {
      name: 'Divide and Conquer Algorithm',
      description: 'Pattern for recursive divide-and-conquer solutions',
      context: { algorithm_type: 'recursive', problem: 'divisible' },
      template: `
function divideAndConquer(problem):
  // Base case
  if problem is small enough:
    return direct_solution(problem)

  // Divide
  subproblems = divide(problem)

  // Conquer
  results = []
  for each subproblem in subproblems:
    results.append(divideAndConquer(subproblem))

  // Combine
  return combine(results)
      `,
      examples: ['Merge sort', 'Quick sort', 'Binary search'],
      success_indicators: ['Clear base case', 'Efficient division', 'Proper combination'],
      antipatterns: ['Missing base case', 'Unbalanced divisions', 'Stack overflow risk'],
    },
    confidence: 0.93,
    usage_count: 95,
    success_count: 90,
    avg_time_saved: 600,
    avg_quality_improvement: 0.87,
    metadata: { source: 'algorithm_patterns', complexity: 'O(n log n)' },
  },
  {
    phase: 'pseudocode',
    category: 'complexity_analysis',
    pattern_data: {
      name: 'Time Complexity Analysis Template',
      description: 'Systematic approach to analyzing algorithm complexity',
      context: { analysis_type: 'time_complexity' },
      template: `
Algorithm: [Name]

1. Basic Operations:
   - [Operation 1]: Count
   - [Operation 2]: Count

2. Input Size: n = [what n represents]

3. Best Case: O([complexity])
   - Occurs when: [condition]

4. Average Case: O([complexity])
   - Expected behavior: [description]

5. Worst Case: O([complexity])
   - Occurs when: [condition]

6. Space Complexity: O([complexity])
   - Auxiliary space: [description]
      `,
      examples: ['Binary search: O(log n)', 'Merge sort: O(n log n)', 'Hash table lookup: O(1) average'],
      success_indicators: ['All cases analyzed', 'Clear reasoning', 'Space considered'],
      antipatterns: ['Only worst case', 'No space analysis', 'Unclear n definition'],
    },
    confidence: 0.91,
    usage_count: 110,
    success_count: 105,
    avg_time_saved: 480,
    avg_quality_improvement: 0.85,
    metadata: { source: 'algorithm_analysis', verified: true },
  },
  {
    phase: 'pseudocode',
    category: 'algorithm_design',
    pattern_data: {
      name: 'Two-Pointer Technique',
      description: 'Efficient pattern for array/list problems',
      context: { data_structure: 'array', problem: 'search_or_partition' },
      template: `
function twoPointer(array):
  left = 0
  right = array.length - 1

  while left < right:
    if condition_met(array[left], array[right]):
      return result

    if should_move_left:
      left++
    else:
      right--

  return default_result
      `,
      examples: ['Two sum sorted array', 'Container with most water', 'Valid palindrome'],
      success_indicators: ['O(n) time complexity', 'O(1) space', 'Single pass'],
      antipatterns: ['Nested loops', 'Excessive space', 'Multiple passes'],
    },
    confidence: 0.89,
    usage_count: 75,
    success_count: 70,
    avg_time_saved: 420,
    avg_quality_improvement: 0.83,
    metadata: { source: 'coding_patterns', complexity: 'O(n)' },
  },
];

// ============================================================================
// Architecture Phase Patterns
// ============================================================================

export const architecturePatterns: Omit<SPARCPattern, 'id' | 'created_at' | 'last_used'>[] = [
  {
    phase: 'architecture',
    category: 'system_design',
    pattern_data: {
      name: 'Microservices Architecture',
      description: 'Distributed system with independent services',
      context: { architecture_type: 'distributed', scale: 'large' },
      template: `
System: [System Name]

Services:
1. [Service A]
   - Responsibility: [What it does]
   - API: [Endpoints]
   - Data: [Database/storage]
   - Dependencies: [Other services]

2. [Service B]
   - [Same structure]

Communication:
- Sync: REST/gRPC
- Async: Message queue (RabbitMQ/Kafka)

Infrastructure:
- API Gateway: [Implementation]
- Service Discovery: [Tool]
- Load Balancer: [Strategy]
- Monitoring: [Solution]
      `,
      examples: ['E-commerce: User, Order, Payment, Inventory services', 'Social media: Auth, Posts, Feed, Notifications'],
      success_indicators: ['Clear service boundaries', 'Loose coupling', 'Independent deployment'],
      antipatterns: ['Shared database', 'Tight coupling', 'Distributed monolith'],
    },
    confidence: 0.92,
    usage_count: 65,
    success_count: 60,
    avg_time_saved: 1800, // 30 minutes
    avg_quality_improvement: 0.86,
    metadata: { source: 'architecture_patterns', scale: 'enterprise' },
  },
  {
    phase: 'architecture',
    category: 'component_pattern',
    pattern_data: {
      name: 'Repository Pattern',
      description: 'Abstract data access layer',
      context: { pattern_type: 'data_access', layer: 'dal' },
      template: `
interface Repository<T> {
  findById(id: ID): Promise<T | null>
  findAll(filters?: Filters): Promise<T[]>
  create(data: CreateDTO): Promise<T>
  update(id: ID, data: UpdateDTO): Promise<T>
  delete(id: ID): Promise<void>
}

class ConcreteRepository<T> implements Repository<T> {
  constructor(private db: Database) {}

  // Implementation with actual database calls
  async findById(id: ID): Promise<T | null> {
    return this.db.query(...)
  }
}
      `,
      examples: ['UserRepository', 'OrderRepository', 'ProductRepository'],
      success_indicators: ['Abstracted persistence', 'Testable with mocks', 'Single responsibility'],
      antipatterns: ['Direct DB in business logic', 'God repository', 'Leaky abstractions'],
    },
    confidence: 0.94,
    usage_count: 180,
    success_count: 172,
    avg_time_saved: 900,
    avg_quality_improvement: 0.88,
    metadata: { source: 'ddd_patterns', verified: true },
  },
  {
    phase: 'architecture',
    category: 'system_design',
    pattern_data: {
      name: 'Event-Driven Architecture',
      description: 'Asynchronous event-based communication',
      context: { architecture_type: 'event_driven', pattern: 'pub_sub' },
      template: `
Components:
1. Event Producers
   - Emit events on state changes
   - Don't wait for response

2. Event Bus/Broker
   - Message queue (Kafka, RabbitMQ, Redis)
   - Topics/channels
   - Persistence and replay

3. Event Consumers
   - Subscribe to relevant events
   - Process asynchronously
   - Idempotent handling

Event Schema:
- event_id: UUID
- event_type: string
- timestamp: ISO8601
- payload: JSON
- metadata: {}
      `,
      examples: ['Order placed → Inventory update + Payment processing', 'User registered → Welcome email + Analytics'],
      success_indicators: ['Decoupled components', 'Async processing', 'Event replay capability'],
      antipatterns: ['Synchronous dependencies', 'No idempotency', 'Lost events'],
    },
    confidence: 0.90,
    usage_count: 55,
    success_count: 50,
    avg_time_saved: 1500,
    avg_quality_improvement: 0.84,
    metadata: { source: 'event_driven_design', verified: true },
  },
];

// ============================================================================
// Refinement Phase Patterns (TDD Focus)
// ============================================================================

export const refinementPatterns: Omit<SPARCPattern, 'id' | 'created_at' | 'last_used'>[] = [
  {
    phase: 'refinement',
    category: 'tdd_cycle',
    pattern_data: {
      name: 'Red-Green-Refactor Cycle',
      description: 'Classic TDD workflow',
      context: { methodology: 'tdd', approach: 'test_first' },
      template: `
RED Phase:
1. Write a failing test
2. Run test suite (should fail)
3. Verify failure is for expected reason

GREEN Phase:
4. Write minimal code to pass test
5. Run test suite (should pass)
6. Don't optimize yet

REFACTOR Phase:
7. Improve code quality
8. Remove duplication
9. Run tests (should still pass)
10. Commit if all green

Repeat for next feature
      `,
      examples: ['Adding validation', 'Implementing business logic', 'Database integration'],
      success_indicators: ['Test written first', 'Minimal implementation', 'Clean refactoring'],
      antipatterns: ['Writing code before tests', 'Complex first implementation', 'Skipping refactoring'],
    },
    confidence: 0.96,
    usage_count: 250,
    success_count: 245,
    avg_time_saved: 600,
    avg_quality_improvement: 0.92,
    metadata: { source: 'tdd_methodology', verified: true },
  },
  {
    phase: 'refinement',
    category: 'test_structure',
    pattern_data: {
      name: 'AAA Test Pattern',
      description: 'Arrange-Act-Assert test structure',
      context: { test_type: 'unit', structure: 'aaa' },
      template: `
describe('ComponentName', () => {
  describe('methodName', () => {
    it('should do X when Y', () => {
      // ARRANGE - Set up test data and mocks
      const input = { ... }
      const mockDependency = jest.fn()
      const sut = new SystemUnderTest(mockDependency)

      // ACT - Execute the behavior
      const result = sut.methodName(input)

      // ASSERT - Verify expectations
      expect(result).toBe(expected)
      expect(mockDependency).toHaveBeenCalledWith(...)
    })
  })
})
      `,
      examples: ['User authentication tests', 'Data validation tests', 'API endpoint tests'],
      success_indicators: ['Clear test sections', 'Single assertion focus', 'Descriptive names'],
      antipatterns: ['Multiple assertions', 'Unclear setup', 'Testing implementation'],
    },
    confidence: 0.94,
    usage_count: 300,
    success_count: 288,
    avg_time_saved: 300,
    avg_quality_improvement: 0.90,
    metadata: { source: 'test_patterns', verified: true },
  },
  {
    phase: 'refinement',
    category: 'refactoring_strategy',
    pattern_data: {
      name: 'Extract Function',
      description: 'Break down complex functions',
      context: { refactoring: 'extract', target: 'function' },
      template: `
Before:
function complexFunction() {
  // Section 1: Setup (10 lines)
  // Section 2: Processing (15 lines)
  // Section 3: Validation (8 lines)
  // Section 4: Result (5 lines)
}

After:
function complexFunction() {
  const data = setupData()
  const processed = processData(data)
  validateResult(processed)
  return formatResult(processed)
}

function setupData() { ... }
function processData(data) { ... }
function validateResult(data) { ... }
function formatResult(data) { ... }
      `,
      examples: ['Breaking down 100-line functions', 'Separating concerns', 'Improving testability'],
      success_indicators: ['Single responsibility', 'Testable units', 'Clear names'],
      antipatterns: ['Over-extraction', 'Unclear names', 'Breaking cohesion'],
    },
    confidence: 0.91,
    usage_count: 175,
    success_count: 165,
    avg_time_saved: 480,
    avg_quality_improvement: 0.87,
    metadata: { source: 'refactoring_catalog', verified: true },
  },
  {
    phase: 'refinement',
    category: 'test_structure',
    pattern_data: {
      name: 'Test Data Builders',
      description: 'Fluent API for creating test data',
      context: { test_type: 'integration', pattern: 'builder' },
      template: `
class UserBuilder {
  private user: Partial<User> = {}

  withName(name: string) {
    this.user.name = name
    return this
  }

  withEmail(email: string) {
    this.user.email = email
    return this
  }

  withRole(role: string) {
    this.user.role = role
    return this
  }

  build(): User {
    return {
      id: uuid(),
      ...this.user,
      createdAt: new Date()
    }
  }
}

// Usage
const user = new UserBuilder()
  .withName('John')
  .withEmail('john@example.com')
  .withRole('admin')
  .build()
      `,
      examples: ['Order builder', 'Product builder', 'API request builder'],
      success_indicators: ['Readable tests', 'Flexible data creation', 'Default values'],
      antipatterns: ['Complex constructors', 'Brittle test data', 'Duplication'],
    },
    confidence: 0.88,
    usage_count: 125,
    success_count: 115,
    avg_time_saved: 420,
    avg_quality_improvement: 0.85,
    metadata: { source: 'test_patterns', verified: true },
  },
];

// ============================================================================
// Completion Phase Patterns
// ============================================================================

export const completionPatterns: Omit<SPARCPattern, 'id' | 'created_at' | 'last_used'>[] = [
  {
    phase: 'completion',
    category: 'validation_checklist',
    pattern_data: {
      name: 'Production Readiness Checklist',
      description: 'Comprehensive pre-deployment validation',
      context: { deployment: 'production', validation: 'comprehensive' },
      template: `
Code Quality:
- [ ] All tests passing (>90% coverage)
- [ ] Linter passing
- [ ] Type checking passing
- [ ] No critical security issues
- [ ] Code review approved

Performance:
- [ ] Load testing completed
- [ ] Performance benchmarks met
- [ ] No memory leaks
- [ ] Database queries optimized
- [ ] Caching implemented

Security:
- [ ] Authentication working
- [ ] Authorization validated
- [ ] Input sanitization
- [ ] HTTPS enforced
- [ ] Secrets in environment

Monitoring:
- [ ] Logging configured
- [ ] Error tracking setup
- [ ] Metrics collection
- [ ] Alerts configured
- [ ] Dashboards created

Documentation:
- [ ] API docs updated
- [ ] Deployment guide ready
- [ ] Rollback plan documented
- [ ] Architecture docs current
      `,
      examples: ['Microservice deployment', 'API release', 'Database migration'],
      success_indicators: ['All items checked', 'Evidence documented', 'Stakeholder approval'],
      antipatterns: ['Skipping items', 'No validation', 'Missing documentation'],
    },
    confidence: 0.93,
    usage_count: 85,
    success_count: 82,
    avg_time_saved: 1200,
    avg_quality_improvement: 0.89,
    metadata: { source: 'deployment_best_practices', verified: true },
  },
  {
    phase: 'completion',
    category: 'deployment_pattern',
    pattern_data: {
      name: 'Blue-Green Deployment',
      description: 'Zero-downtime deployment strategy',
      context: { deployment: 'zero_downtime', strategy: 'blue_green' },
      template: `
Setup:
1. Blue Environment (current production)
2. Green Environment (new version)

Deployment Steps:
1. Deploy to Green environment
2. Run smoke tests on Green
3. Warm up Green (cache, connections)
4. Switch load balancer to Green
5. Monitor Green for issues
6. Keep Blue as fallback (1 hour)
7. If issues, switch back to Blue
8. If stable, decommission Blue

Validation:
- Health checks pass
- Metrics normal
- Error rates low
- Performance acceptable
      `,
      examples: ['API version upgrade', 'Database schema change', 'Infrastructure update'],
      success_indicators: ['Zero downtime', 'Quick rollback', 'Validated before switch'],
      antipatterns: ['No rollback plan', 'Immediate Blue shutdown', 'No validation'],
    },
    confidence: 0.91,
    usage_count: 45,
    success_count: 43,
    avg_time_saved: 1800,
    avg_quality_improvement: 0.87,
    metadata: { source: 'deployment_patterns', verified: true },
  },
  {
    phase: 'completion',
    category: 'validation_checklist',
    pattern_data: {
      name: 'API Contract Validation',
      description: 'Ensure API backward compatibility',
      context: { api: 'rest', validation: 'contract' },
      template: `
Breaking Changes Check:
- [ ] No removed endpoints
- [ ] No removed fields
- [ ] No changed field types
- [ ] No new required fields
- [ ] Error codes unchanged

Non-Breaking Additions:
- [ ] New optional fields OK
- [ ] New endpoints documented
- [ ] Version header supported
- [ ] Deprecation warnings added

Testing:
- [ ] Contract tests passing
- [ ] Integration tests passing
- [ ] Backward compatibility verified
- [ ] Consumer tests run

Documentation:
- [ ] Changelog updated
- [ ] API docs current
- [ ] Migration guide (if needed)
- [ ] Deprecation timeline
      `,
      examples: ['REST API v2 release', 'GraphQL schema update', 'SDK version bump'],
      success_indicators: ['No breaking changes', 'Tests passing', 'Consumers notified'],
      antipatterns: ['Breaking changes without version', 'No consumer notification', 'Missing docs'],
    },
    confidence: 0.90,
    usage_count: 70,
    success_count: 66,
    avg_time_saved: 900,
    avg_quality_improvement: 0.86,
    metadata: { source: 'api_design', verified: true },
  },
];

// ============================================================================
// Combined Pattern Library
// ============================================================================

export const allPatternLibraries = {
  specification: specificationPatterns,
  pseudocode: pseudocodePatterns,
  architecture: architecturePatterns,
  refinement: refinementPatterns,
  completion: completionPatterns,
};

export function getPatternCount(): Record<SPARCPhase, number> {
  return {
    specification: specificationPatterns.length,
    pseudocode: pseudocodePatterns.length,
    architecture: architecturePatterns.length,
    refinement: refinementPatterns.length,
    completion: completionPatterns.length,
  };
}

export function getTotalPatternCount(): number {
  return Object.values(allPatternLibraries).reduce((sum, patterns) => sum + patterns.length, 0);
}
