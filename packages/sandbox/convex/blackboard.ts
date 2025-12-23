import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

/**
 * Write an entry to the session blackboard.
 * If an entry with the same key and namespace exists for the session, it will be updated.
 */
export const write = mutation({
  args: {
    sessionId: v.string(),
    namespace: v.string(),
    key: v.string(),
    value: v.any(),
    agentId: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  async handler(ctx, args) {
    const existing = await ctx.db
      .query('blackboardEntries')
      .withIndex('by_session_key', (q) =>
        q.eq('sessionId', args.sessionId).eq('key', args.key)
      )
      .filter((q) => q.eq(q.field('namespace'), args.namespace))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        value: args.value,
        agentId: args.agentId ?? existing.agentId,
        metadata: args.metadata ? { ...existing.metadata, ...args.metadata } : existing.metadata,
        updatedAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert('blackboardEntries', {
      sessionId: args.sessionId,
      namespace: args.namespace,
      key: args.key,
      value: args.value,
      agentId: args.agentId,
      metadata: args.metadata,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

/**
 * Search for entries in the blackboard.
 * Can filter by namespace, key, or a pattern in the value (if value is a string).
 */
export const search = query({
  args: {
    sessionId: v.string(),
    namespace: v.optional(v.string()),
    key: v.optional(v.string()),
    pattern: v.optional(v.string()),
  },
  async handler(ctx, args) {
    let query = ctx.db
      .query('blackboardEntries')
      .withIndex('by_session', (q) => q.eq('sessionId', args.sessionId));

    const results = await query.collect();

    return results.filter((entry) => {
      const namespaceMatch = !args.namespace || entry.namespace === args.namespace;
      const keyMatch = !args.key || entry.key === args.key;

      let patternMatch = true;
      if (args.pattern && typeof entry.value === 'string') {
        patternMatch = entry.value.toLowerCase().includes(args.pattern.toLowerCase());
      } else if (args.pattern) {
        // If pattern is provided but value is not a string, we skip pattern matching for this entry
        // or we could stringify it. For now, we'll just skip.
        patternMatch = false;
      }

      return namespaceMatch && keyMatch && patternMatch;
    });
  },
});

/**
 * Get all entries for a specific namespace.
 */
export const getNamespace = query({
  args: {
    sessionId: v.string(),
    namespace: v.string(),
  },
  async handler(ctx, args) {
    return await ctx.db
      .query('blackboardEntries')
      .withIndex('by_session_namespace', (q) =>
        q.eq('sessionId', args.sessionId).eq('namespace', args.namespace)
      )
      .collect();
  },
});
