import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const mode = process.argv[2];

const knownModes = new Set(["scope", "module", "logic"]);
if (!knownModes.has(mode)) {
  console.error("Usage: node scripts/delivery-guard.mjs <scope|module|logic>");
  process.exit(2);
}

function git(args, options = {}) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  }).trim();
}

function env(name) {
  return process.env[name] ?? "";
}

function currentBranch() {
  return env("GITHUB_HEAD_REF") || git(["rev-parse", "--abbrev-ref", "HEAD"]);
}

function baseBranch() {
  return env("GITHUB_BASE_REF") || "";
}

function eventName() {
  return env("GITHUB_EVENT_NAME");
}

function actor() {
  return env("GITHUB_ACTOR");
}

function diffBaseRef() {
  const base = baseBranch();
  if (base) {
    return `origin/${base}`;
  }

  const branch = currentBranch();
  if (branch === "main" && existsSync(".git")) {
    return "HEAD^";
  }

  return "origin/main";
}

function changedFiles() {
  if (!env("GITHUB_ACTIONS")) {
    const modifiedFiles = git(["diff", "--name-only", "HEAD"])
      .split("\n")
      .map((file) => file.trim())
      .filter(Boolean);
    const untrackedFiles = git(["ls-files", "--others", "--exclude-standard"])
      .split("\n")
      .map((file) => file.trim())
      .filter(Boolean);
    const localFiles = [...new Set([...modifiedFiles, ...untrackedFiles])];

    if (localFiles.length > 0) {
      return localFiles;
    }
  }

  const base = diffBaseRef();
  try {
    git(["fetch", "--no-tags", "--depth=50", "origin", base.replace(/^origin\//, "")], {
      stdio: ["ignore", "ignore", "ignore"],
    });
  } catch {
    // Local/offline runs can still use whatever refs are already available.
  }

  try {
    return git(["diff", "--name-only", `${base}...HEAD`])
      .split("\n")
      .map((file) => file.trim())
      .filter(Boolean);
  } catch {
    return git(["diff", "--name-only", "HEAD"])
      .split("\n")
      .map((file) => file.trim())
      .filter(Boolean);
  }
}

function fail(message, details = []) {
  console.error(`FAIL: ${message}`);
  for (const detail of details) {
    console.error(`- ${detail}`);
  }
  process.exit(1);
}

function pass(message) {
  console.log(`PASS: ${message}`);
}

function runScopeGuard() {
  const branch = currentBranch();
  const base = baseBranch();
  const event = eventName();
  const runActor = actor();

  if (event === "pull_request") {
    if (base === "dev" && !branch.startsWith("feature/")) {
      fail("PR в dev разрешен только из feature/*.", [`head: ${branch}`, `base: ${base}`]);
    }

    if (base === "main" && branch !== "dev") {
      fail("PR в main разрешен только из dev.", [`head: ${branch}`, `base: ${base}`]);
    }

    pass(`ветка ${branch} корректно направлена в ${base}.`);
    return;
  }

  if (branch.startsWith("feature/") || branch === "dev" || branch === "main") {
    pass(`ветка ${branch} входит в delivery-flow.`);
    return;
  }

  if (/bot|codex|claude|openai/i.test(runActor) && branch === "main") {
    fail("AI-актор не должен работать напрямую в main.", [`actor: ${runActor}`]);
  }

  fail("ветка не входит в delivery-flow.", [`branch: ${branch}`]);
}

function runModuleGuard() {
  const files = changedFiles();
  const deniedPrefixes = ["node_modules/", ".next/", ".vercel/"];
  const deniedExact = [".env", ".env.local", ".env.production", ".env.preview"];
  const deniedFiles = files.filter(
    (file) => deniedExact.includes(file) || deniedPrefixes.some((prefix) => file.startsWith(prefix)),
  );

  if (deniedFiles.length > 0) {
    fail("изменены служебные или секретные зоны, которые не должны попадать в PR.", deniedFiles);
  }

  const allowedRoots = [
    ".github/",
    "docs/",
    "orchestrator/",
    "public/",
    "scripts/",
    "skills/",
    "src/",
    "knowledge-import/",
  ];
  const allowedRootFiles = new Set([
    ".env.example",
    "CLAUDE.md",
    "HANDOFF_TO_CODEX.md",
    "README.md",
    "components.json",
    "eslint.config.mjs",
    "global.d.ts",
    "next.config.ts",
    "package-lock.json",
    "package.json",
    "postcss.config.js",
    "tailwind.config.ts",
    "tsconfig.json",
    "vitest.config.ts",
  ]);

  const unknownFiles = files.filter(
    (file) => !allowedRootFiles.has(file) && !allowedRoots.some((root) => file.startsWith(root)),
  );

  if (unknownFiles.length > 0) {
    fail("изменения затрагивают неизвестные зоны проекта; нужен явный review владельца.", unknownFiles);
  }

  pass(files.length === 0 ? "измененных файлов нет." : `проверено файлов: ${files.length}.`);
}

function runLogicGuard() {
  const files = changedFiles().filter(
    (file) => file !== "scripts/delivery-guard.mjs" && /\.(js|jsx|ts|tsx|mjs|cjs|json|ya?ml|md)$/.test(file),
  );
  const productionDeployPattern = /\b(vercel\s+(deploy\s+)?--prod|vercel\s+promote|--target\s+production)\b/i;
  const bypassPattern = /\b(skip checks|no-verify|push\s+origin\s+main|git\s+push\s+.*\bmain)\b/i;
  const offenders = [];

  for (const file of files) {
    let content = "";
    try {
      content = existsSync(file) ? readFileSync(file, "utf8") : execFileSync("git", ["show", `HEAD:${file}`], { encoding: "utf8" });
    } catch {
      continue;
    }

    if (productionDeployPattern.test(content)) {
      offenders.push(`${file}: найдена production deploy/promote команда`);
    }

    if (bypassPattern.test(content)) {
      offenders.push(`${file}: найден потенциальный обход delivery-flow`);
    }
  }

  if (offenders.length > 0) {
    fail("найдены команды, которые могут обойти ручной production approval.", offenders);
  }

  pass("обходы production deploy и прямого push в main не найдены.");
}

if (mode === "scope") runScopeGuard();
if (mode === "module") runModuleGuard();
if (mode === "logic") runLogicGuard();
