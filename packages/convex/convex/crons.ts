import { cronJobs } from "convex/server";
import { api } from "./_generated/api";

/**
 * Background Jobs (Phase H)
 */

const crons = cronJobs();

// Cleanup expired sessions every hour
crons.interval(
  "cleanup expired sessions",
  { hours: 1 },
  api.sessions.cleanupExpiredSessions
);

// Daily usage report / cost finalization
crons.daily(
  "finalize monthly costs",
  { hourUTC: 0, minuteUTC: 0 },
  api.llm.finalizeMonthlyCosts
);

export default crons;
