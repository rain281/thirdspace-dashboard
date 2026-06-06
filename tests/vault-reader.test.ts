import assert from "node:assert/strict";
import { filterManagedProjectIndexEntries } from "../src/data/vault-reader";

const activityProjects = filterManagedProjectIndexEntries([
  {
    id: "kora",
    name: "Kora",
    workspace: "04-项目/产品系统/Kora",
    lifecycle: "active",
  },
  {
    id: "xiaohuanzi",
    name: "小桓子",
    workspace: "99-归档/完结项目/小桓子",
    lifecycle: "archived",
  },
  {
    id: "pilot",
    name: "Pilot",
    workspace: "04-项目/产品系统/Pilot",
  },
]);

assert.deepEqual(activityProjects.map(project => project.id), ["kora", "pilot"]);
