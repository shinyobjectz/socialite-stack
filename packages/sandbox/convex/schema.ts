import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  blackboardEntries: defineTable({
    sessionId: v.string(),
    namespace: v.string(),
    key: v.string(),
    value: v.any(),
    agentId: v.optional(v.string()),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_session', ['sessionId'])
    .index('by_session_namespace', ['sessionId', 'namespace'])
    .index('by_session_key', ['sessionId', 'key']),

  executionPlans: defineTable({
    sessionId: v.string(),
    planId: v.string(),
    description: v.string(),
    steps: v.array(
      v.object({
        id: v.string(),
        description: v.string(),
        agentId: v.string(),
        task: v.string(),
        dependencies: v.array(v.string()),
        status: v.union(
          v.literal('pending'),
          v.literal('running'),
          v.literal('completed'),
          v.literal('failed')
        ),
        result: v.optional(v.any()),
        error: v.optional(v.string()),
      })
    ),
    status: v.union(
      v.literal('planning'),
      v.literal('executing'),
      v.literal('completed'),
      v.literal('failed')
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_session', ['sessionId']),

  agentTasks: defineTable({
    sessionId: v.string(),
    taskId: v.string(),
    delegatedFrom: v.optional(v.string()),
    delegatedTo: v.string(),
    task: v.string(),
    context: v.optional(v.any()),
    status: v.union(
      v.literal('pending'),
      v.literal('running'),
      v.literal('completed'),
      v.literal('failed')
    ),
    result: v.optional(v.any()),
    error: v.optional(v.string()),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index('by_session', ['sessionId'])
    .index('by_delegatedTo', ['delegatedTo']),

  toolExecutions: defineTable({
    sessionId: v.string(),
    executionId: v.string(),
    toolId: v.string(),
    toolName: v.string(),
    status: v.union(
      v.literal('running'),
      v.literal('success'),
      v.literal('error')
    ),
    input: v.any(),
    output: v.optional(v.any()),
    error: v.optional(v.string()),
    startTime: v.number(),
    endTime: v.optional(v.number()),
    duration: v.optional(v.number()),
    agentId: v.optional(v.string()),
  }).index('by_session', ['sessionId']),

  artifacts: defineTable({
    sessionId: v.string(),
    artifactId: v.string(),
    type: v.union(
      v.literal('document'),
      v.literal('canvas'),
      v.literal('analysis'),
      v.literal('transcript')
    ),
    title: v.string(),
    content: v.string(),
    metadata: v.optional(v.any()),
    generatedBy: v.string(),
    createdAt: v.number(),
  }).index('by_session', ['sessionId']),
});
