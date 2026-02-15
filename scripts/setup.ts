import * as p from "@clack/prompts";
import { randomBytes } from "node:crypto";
import { writeFileSync, existsSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve } from "node:path";

// ── Colors (zero-dependency ANSI helpers) ────────────────────
const c = {
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  underline: (s: string) => `\x1b[4m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  bgCyan: (s: string) => `\x1b[46m\x1b[30m${s}\x1b[0m`,
  // 256-color gradient for logo
  gradient: (lines: string[]) => {
    const colors = [51, 50, 44, 38, 32, 44];
    return lines
      .map((line, i) => `\x1b[38;5;${colors[i % colors.length]}m${line}\x1b[0m`)
      .join("\n");
  },
};

// ── Logo ─────────────────────────────────────────────────────
const LOGO_LINES = [
  "  ██████╗ ██╗███████╗██████╗  █████╗ ████████╗ ██████╗██╗  ██╗",
  "  ██╔══██╗██║██╔════╝██╔══██╗██╔══██╗╚══██╔══╝██╔════╝██║  ██║",
  "  ██║  ██║██║███████╗██████╔╝███████║   ██║   ██║     ███████║",
  "  ██║  ██║██║╚════██║██╔═══╝ ██╔══██║   ██║   ██║     ██╔══██║",
  "  ██████╔╝██║███████║██║     ██║  ██║   ██║   ╚██████╗██║  ██║",
  "  ╚═════╝ ╚═╝╚══════╝╚═╝     ╚═╝  ╚═╝   ╚═╝    ╚═════╝╚═╝  ╚═╝",
];

// Read version from package.json
const pkgPath = resolve(process.cwd(), "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
const VERSION = pkg.version || "0.0.0";

// ── Helpers ──────────────────────────────────────────────────
function onCancel(value: unknown) {
  if (p.isCancel(value)) {
    p.cancel("Setup cancelled.");
    process.exit(0);
  }
}

function printHeader() {
  console.clear();
  console.log("");
  console.log(c.gradient(LOGO_LINES));
  console.log("");
  console.log(c.dim(`  v${VERSION} — Personal task & dispatch manager`));
  console.log("");
}

// ── Main ─────────────────────────────────────────────────────
async function main() {
  printHeader();

  p.intro(c.bgCyan(" Dispatch Setup "));

  // Check for existing .env.local
  const envPath = resolve(process.cwd(), ".env.local");
  if (existsSync(envPath)) {
    const overwrite = await p.confirm({
      message: ".env.local already exists. Overwrite it?",
      initialValue: false,
    });
    onCancel(overwrite);
    if (!overwrite) {
      p.cancel("Existing configuration preserved.");
      process.exit(0);
    }
  }

  // ── 1. PORT ─────────────────────────────────────────────────
  const portInput = await p.text({
    message: "Port to run Dispatch on:",
    initialValue: "3000",
    placeholder: "3000",
    validate: (v) => {
      if (!v) return "Enter a valid port number";
      if (!/^\d+$/.test(v)) return "Enter a valid port number";
      const port = Number(v);
      if (port < 1 || port > 65535) return "Port must be between 1 and 65535";
      return undefined;
    },
  });
  onCancel(portInput);
  const appPort = String(portInput);
  const appUrl = `http://localhost:${appPort}`;

  // ── 2. GITHUB OAUTH ─────────────────────────────────────────
  const useGitHub = await p.confirm({
    message: "Enable GitHub OAuth login? (you can always add this later)",
    initialValue: false,
  });
  onCancel(useGitHub);

  let githubId = "";
  let githubSecret = "";

  if (useGitHub) {
    p.note(
      [
        "To create a GitHub OAuth App:",
        "",
        `  1. Go to ${c.underline("https://github.com/settings/developers")}`,
        `  2. Click ${c.bold("New OAuth App")}`,
        "  3. Fill in the form:",
        "",
        `     Application name:    ${c.cyan("Dispatch")}`,
        `     Homepage URL:        ${c.cyan(appUrl)}`,
        `     Authorization URL:   ${c.cyan(`${appUrl}/api/auth/callback/github`)}`,
        "",
        '  4. Click "Register application"',
        `  5. Copy the ${c.bold("Client ID")} shown on the page`,
        '  6. Click "Generate a new client secret" and copy it',
      ].join("\n"),
      "GitHub OAuth Setup"
    );

    const id = await p.text({
      message: "Paste GitHub Client ID:",
      placeholder: "Ov23li...",
      validate: (v) => (!v || v.length === 0 ? "Required" : undefined),
    });
    onCancel(id);
    githubId = id as string;

    const secret = await p.password({
      message: "Paste GitHub Client Secret:",
      validate: (v) => (!v || v.length === 0 ? "Required" : undefined),
    });
    onCancel(secret);
    githubSecret = secret as string;
  }

  // Always generate a secure session signing secret for NextAuth.
  const authSecret = randomBytes(32).toString("base64url");

  // ── SUMMARY ─────────────────────────────────────────────────
  p.note(
    [
      `AUTH_SECRET       ${c.dim(authSecret.slice(0, 16) + "...")} ${c.green("(generated)")}`,
      `GitHub OAuth      ${useGitHub ? c.green("enabled") : c.yellow("disabled")}`,
      `Port              ${appPort}`,
      `Runtime           ${c.cyan("Docker Compose")}`,
    ].join("\n"),
    "Configuration Summary"
  );

  const confirm = await p.confirm({
    message: "Apply this configuration?",
    initialValue: true,
  });
  onCancel(confirm);
  if (!confirm) {
    p.cancel("Setup cancelled.");
    process.exit(0);
  }

  // ── EXECUTE ─────────────────────────────────────────────────
  const s = p.spinner();

  // Write .env.local
  s.start("Writing .env.local");
  const envLines = ["# NextAuth", `AUTH_SECRET=${authSecret}`, `NEXTAUTH_URL=${appUrl}`];
  if (useGitHub) {
    envLines.push(
      `AUTH_GITHUB_ID=${githubId}`,
      `AUTH_GITHUB_SECRET=${githubSecret}`
    );
  }
  envLines.push("", "# Docker", `DISPATCH_PORT=${appPort}`, "");
  writeFileSync(envPath, envLines.join("\n"), "utf-8");
  s.stop(c.green("Wrote .env.local"));

  // ── NEXT STEPS ──────────────────────────────────────────────
  const nextSteps = [
    "Start Dispatch in Docker:",
    "",
    `  ${c.cyan("docker compose --env-file .env.local up -d --build")}`,
    "",
    `Then open ${c.underline(appUrl)}`,
  ];
  p.note(nextSteps.join("\n"), "Next Steps");

  const runDockerNow = await p.confirm({
    message: "Start Dispatch in Docker now? (docker compose up -d --build)",
    initialValue: true,
  });
  onCancel(runDockerNow);

  if (runDockerNow) {
    p.outro(c.green("Setup complete! Starting Dispatch in Docker..."));
    p.log.info("Starting Docker Compose services...");
    try {
      execSync("docker compose --env-file .env.local up -d --build", {
        stdio: "inherit",
        cwd: process.cwd(),
      });
      p.log.success(`Dispatch is running at ${appUrl}`);
      return;
    } catch {
      p.log.error(
        'Docker startup failed. Ensure Docker Desktop is running, then run: "docker compose --env-file .env.local up -d --build".'
      );
      process.exit(1);
    }
  }

  p.outro(c.green("Setup complete! Happy dispatching."));
}

main().catch((err) => {
  p.cancel("Setup failed unexpectedly.");
  console.error(err);
  process.exit(1);
});
