/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as crons from "../crons.js";
import type * as features from "../features.js";
import type * as lib_testUtils from "../lib/testUtils.js";
import type * as llm from "../llm.js";
import type * as mail from "../mail.js";
import type * as notifications from "../notifications.js";
import type * as permissions from "../permissions.js";
import type * as quota from "../quota.js";
import type * as sandbox from "../sandbox.js";
import type * as sessions from "../sessions.js";
import type * as sync from "../sync.js";
import type * as testing from "../testing.js";
import type * as toolRegistry from "../toolRegistry.js";
import type * as workspaces from "../workspaces.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  crons: typeof crons;
  features: typeof features;
  "lib/testUtils": typeof lib_testUtils;
  llm: typeof llm;
  mail: typeof mail;
  notifications: typeof notifications;
  permissions: typeof permissions;
  quota: typeof quota;
  sandbox: typeof sandbox;
  sessions: typeof sessions;
  sync: typeof sync;
  testing: typeof testing;
  toolRegistry: typeof toolRegistry;
  workspaces: typeof workspaces;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
