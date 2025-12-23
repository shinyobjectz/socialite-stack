/**
 * Mock Convex server functions for testing.
 * These bypass the Convex internal wrapping and return the raw definition,
 * allowing tests to access the .handler property directly.
 */
export const query = definition => definition;
export const mutation = definition => definition;
export const action = definition => definition;
export const internalQuery = definition => definition;
export const internalMutation = definition => definition;
export const internalAction = definition => definition;
