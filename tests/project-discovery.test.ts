import assert from "node:assert/strict";
import { loadProjectDiscoverySnapshot } from "../src/data/project-discovery";

const writes: string[] = [];
const fakeDiscoveryApp = {
  vault: {
    adapter: {
      async read(path: string) {
        if (path === ".thirdspace/project-discovery.yaml") return [
          'version: "1.0"',
          'mode: "discover_only"',
          "roots:",
          '  - "/Volumes/资料/projects"',
          "",
        ].join("\n");
        if (path === ".thirdspace/queues/project-candidates.json") return JSON.stringify({
          version: "1.0",
          generated_at: "2026-06-12 03:20:00",
          roots: ["/Volumes/资料/projects"],
          candidates: [
            {
              id: "kora",
              name: "Kora",
              path: "/Volumes/资料/projects/Kora",
              markers: ["git", "node"],
              reason: "检测到 git / node 项目特征",
              status: "pending",
              detected_at: "2026-06-12 03:00:00",
              last_seen_at: "2026-06-12 03:00:00",
              suggested_category: "产品系统",
              suggested_workspace: "04-项目/产品系统/Kora",
            },
          ],
        });
        throw new Error(`missing ${path}`);
      },
      async write(path: string) {
        writes.push(`adapter.write:${path}`);
      },
      async exists() {
        return false;
      },
    },
    getAbstractFileByPath() {
      return null;
    },
    async create(path: string) {
      writes.push(`vault.create:${path}`);
    },
    async modify(file: { path: string }) {
      writes.push(`vault.modify:${file.path}`);
    },
    async createFolder(path: string) {
      writes.push(`vault.createFolder:${path}`);
    },
  },
};

const snapshot = await loadProjectDiscoverySnapshot(fakeDiscoveryApp as any);
assert.equal(snapshot.pending.length, 1);
assert.equal(snapshot.pending[0].name, "Kora");
assert.equal(snapshot.generatedAt, "2026-06-12 03:20:00");
assert.deepEqual(writes, []);
