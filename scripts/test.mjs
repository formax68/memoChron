// Bundles each tests/*.test.mjs (they import TypeScript sources) with esbuild,
// then runs them with Node's built-in test runner.
import esbuild from "esbuild";
import { spawnSync } from "child_process";
import { mkdtempSync, readdirSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import process from "process";

const testFiles = readdirSync("tests")
  .filter((f) => f.endsWith(".test.mjs"))
  .map((f) => join("tests", f));

const outdir = mkdtempSync(join(tmpdir(), "memochron-tests-"));

try {
  await esbuild.build({
    entryPoints: testFiles,
    bundle: true,
    platform: "node",
    format: "esm",
    outdir,
    outExtension: { ".js": ".mjs" },
    logLevel: "warning",
  });

  const result = spawnSync(process.execPath, ["--test", outdir], {
    stdio: "inherit",
    env: { ...process.env, TZ: "Europe/Athens" },
  });
  process.exitCode = result.status ?? 1;
} finally {
  rmSync(outdir, { recursive: true, force: true });
}
