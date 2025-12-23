import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

/**
 * Create a new task for an agent.
 */
export const createTask = mutation({
  args: {
    sessionId: v.string(),
    taskId: v.string(),
    delegatedFrom: v.optional(v.string()),
    delegatedTo: v.string(),
    task: v.string(),
    context: v.optional(v.any()),
  },
  async handler(ctx, args) {
    return await ctx.db.insert('agentTasks', {
      sessionId: args.sessionId,
      taskId: args.taskId,
      delegatedFrom: args.delegatedFrom,
      delegatedTo: args.delegatedTo,
      task: args.task,
      context: args.context,
      status: 'pending',
      createdAt: Date.now(),
    });
  },
});

/**
 * Update the status and result of a task.
 */
export const updateTaskStatus = mutation({
  args: {
    sessionId: v.string(),
    taskId: v.string(),
    status: v.union(
      v.literal('pending'),
      v.literal('running'),
      v.literal('completed'),
      v.literal('failed')
    ),
    result: v.optional(v.any()),
    error: v.optional(v.string()),
  },
  async handler(ctx, args) {
    const existing = await ctx.db
      .query('agentTasks')
      .filter((q) =>
        q.and(
          q.eq(q.field('sessionId'), args.sessionId),
          q.eq(q.field('taskId'), args.taskId)
        )
      )
      .first();

    if (!existing) throw new Error(`Task ${args.taskId} not found`);

    const updateData: any = {
      status: args.status,
    };

    if (args.status === 'completed' || args.status === 'failed') {
      updateData.completedAt = Date.now();
      updateData.result = args.result;
      updateData.error = args.error;
    }

    await ctx.db.patch(existing._id, updateData);
  },
});

/**
 * Create or update an execution plan.
 */
export const saveExecutionPlan = mutation({
  args: {
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
  },
  async handler(ctx, args) {
    const existing = await ctx.db
      .query('executionPlans')
      .filter((q) =>
        q.and(
          q.eq(q.field('sessionId'), args.sessionId),
          q.eq(q.field('planId'), args.planId)
        )
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        description: args.description,
        steps: args.steps,
        status: args.status,
        updatedAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert('executionPlans', {
      sessionId: args.sessionId,
      planId: args.planId,
      description: args.description,
      steps: args.steps,
      status: args.status,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

/**
 * Get the current execution plan for a session.
 */
export const getExecutionPlan = query({
  args: {
    sessionId: v.string(),
  },
  async handler(ctx, args) {
    return await ctx.db
      .query('executionPlans')
      .withIndex('by_session', (q) => q.eq('sessionId', args.sessionId))
      .order('desc')
      .first();
  },
});

/**
 * Record a tool execution.
 */
export const recordToolExecution = mutation({
  args: {
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
    agentId: v.optional(v.string()),
  },
  async handler(ctx, args) {
    const existing = await ctx.db
      .query('toolExecutions')
      .filter((q) =>
        q.and(
          q.eq(q.field('sessionId'), args.sessionId),
          q.eq(q.field('executionId'), args.executionId)
        )
      )
      .first();

    if (existing) {
      const endTime = args.status !== 'running' ? Date.now() : undefined;
      const duration = endTime ? endTime - existing.startTime : undefined;

      await ctx.db.patch(existing._id, {
        status: args.status,
        output: args.output,
        error: args.error,
        endTime,
        duration,
      });
      return existing._id;
    }

    return await ctx.db.insert('toolExecutions', {
      sessionId: args.sessionId,
      executionId: args.executionId,
      toolId: args.toolId,
      toolName: args.toolName,
      status: args.status,
      input: args.input,
      output: args.output,
      error: args.error,
      startTime: Date.now(),
      agentId: args.agentId,
    });
  },
});
