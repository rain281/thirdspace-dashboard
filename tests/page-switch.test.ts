import assert from "node:assert/strict";
import { DASHBOARD_PAGES } from "../src/components/page-switch";

assert.deepEqual(DASHBOARD_PAGES.map(page => page.id), ["today", "projects", "review", "system"]);
assert.deepEqual(DASHBOARD_PAGES.map(page => page.label), ["今日工作", "项目系统", "复盘", "系统"]);
assert.deepEqual(DASHBOARD_PAGES.map(page => page.icon), ["calendar-check", "folder-kanban", "clipboard-check", "settings-2"]);
