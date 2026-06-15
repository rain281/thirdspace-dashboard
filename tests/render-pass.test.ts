import assert from "node:assert/strict";
import { canCommitRenderPass, RenderPassGuard } from "../src/data/render-pass";

const guard = new RenderPassGuard();

const first = guard.begin();
assert.equal(guard.isCurrent(first), true);

const second = guard.begin();
assert.equal(guard.isCurrent(first), false);
assert.equal(guard.isCurrent(second), true);
assert.equal(canCommitRenderPass(guard, first, { isConnected: true } as HTMLElement), false);
assert.equal(canCommitRenderPass(guard, second, { isConnected: false } as HTMLElement), false);
assert.equal(canCommitRenderPass(guard, second, { isConnected: true } as HTMLElement), true);
