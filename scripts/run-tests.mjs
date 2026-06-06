import esbuild from "esbuild";
import { mkdir, rm } from "fs/promises";
import { dirname, resolve } from "path";
import { fileURLToPath, pathToFileURL } from "url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");
const tmpdir = resolve(repoRoot, ".tmp");
const outdir = resolve(tmpdir, "tests");
const outfile = resolve(outdir, "run-tests.mjs");

try {
  await rm(tmpdir, { recursive: true, force: true });
  await mkdir(outdir, { recursive: true });

  await esbuild.build({
    entryPoints: [resolve(repoRoot, "tests/run-tests.ts")],
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node20",
    outfile,
    external: ["obsidian"],
    sourcemap: "inline",
  });

  await import(pathToFileURL(outfile).href);
} finally {
  await rm(tmpdir, { recursive: true, force: true });
}
