import esbuild from "esbuild";
import { mkdir, rm } from "fs/promises";
import { pathToFileURL } from "url";

const outdir = ".tmp/tests";
const outfile = `${outdir}/run-tests.mjs`;

await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });

await esbuild.build({
  entryPoints: ["tests/run-tests.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  outfile,
  external: ["obsidian"],
  sourcemap: "inline",
});

await import(pathToFileURL(outfile).href);
