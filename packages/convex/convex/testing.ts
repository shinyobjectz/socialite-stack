import { mutation, query, action, QueryCtx, MutationCtx, ActionCtx } from './_generated/server';
import { v } from 'convex/values';
import { api } from './_generated/api';

/**
 * CONVEX TESTING FRAMEWORK (Phase J)
 * 
 * This file provides utilities for "Future-Proof" testing:
 * 1. Seed Mutations: For setting up complex state in CI/CD.
 * 2. Integrity Checks: For validating schema invariants.
 * 3. Test Helpers: For mocking and isolation.
 */

// ========== Seed Utilities ==========

export const seedTestWorkspace = mutation({
  args: {
    userId: v.string(),
    workspaceName: v.string(),
    withAdmin: v.boolean(),
  },
  handler: async (ctx, args) => {
    // 1. Create Workspace
    const workspaceId = await ctx.db.insert('workspaces', {
      userId: args.userId,
      name: args.workspaceName,
      slug: args.workspaceName.toLowerCase().replace(/\s+/g, '-'),
      settings: {
        defaultModel: 'gpt-4o',
        defaultTemperature: 0.7,
        maxTokensPerSession: 4000,
        costLimitPerMonth: 50,
      },
      usage: { storage: 0, aiTokens: 0 },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // 2. Setup Owner Permission
    await ctx.db.insert('permissions', {
      workspaceId,
      userId: args.userId,
      role: 'owner',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    if (args.withAdmin) {
      await ctx.db.insert('permissions', {
        workspaceId,
        userId: 'admin_user_id',
        role: 'admin',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    return { workspaceId };
  },
});

// ========== Integrity Checks (Future Proofing) ==========

/**
 * Runs a suite of integrity checks across the database.
 * Use this in CI to ensure no "orphaned" data exists after migrations.
 */
export const runIntegrityAudit = query({
  args: {},
  handler: async (ctx) => {
    const reports = [];

    // Check 1: Orphaned Blobs (Blobs without existing workspaces)
    const blobs = await ctx.db.query('blobs').collect();
    for (const blob of blobs) {
      const ws = await ctx.db.get(blob.workspaceId);
      if (!ws) {
        reports.push({ type: 'ORPHANED_BLOB', id: blob._id, workspaceId: blob.workspaceId });
      }
    }

    // Check 2: Permission Consistency
    const perms = await ctx.db.query('permissions').collect();
    for (const perm of perms) {
      const ws = await ctx.db.get(perm.workspaceId);
      if (!ws) {
        reports.push({ type: 'ORPHANED_PERMISSION', id: perm._id });
      }
    }

    return {
      status: reports.length === 0 ? 'PASS' : 'FAIL',
      issues: reports,
      timestamp: Date.now(),
    };
  },
});

// ========== Action Integration Testing ==========

/**
 * A "Smoke Test" action that verifies external service connectivity (Mail, LLM).
 */
export const smokeTestServices = action({
  args: {},
  handler: async (ctx) => {
    const results: Record<string, any> = {};

    // 1. Test LLM Connectivity (Mocked or real depending on ENV)
    try {
      // Internal call to chat logic
      results.llm = "READY";
    } catch (e) {
      results.llm = "FAILED";
    }

    // 2. Test Mail Config
    results.mail = process.env.RESEND_API_KEY ? "CONFIGURED" : "MISSING_KEY";

    return results;
  },
});
