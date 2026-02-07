import * as p from "@clack/prompts";
import { randomBytes, randomUUID } from "node:crypto";
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
      validate: (v) => (v.length === 0 ? "Required" : undefined),
    });
    onCancel(id);
    githubId = id as string;

    const secret = await p.password({
      message: "Paste GitHub Client Secret:",
      validate: (v) => (v.length === 0 ? "Required" : undefined),
    });
    onCancel(secret);
    githubSecret = secret as string;
  }

  // Always generate a secure session signing secret for NextAuth.
  const authSecret = randomBytes(32).toString("base64url");

  // ── 3. DATABASE ──────────────────────────────────────────────
  const dbPath = await p.text({
    message: "Database file path:",
    initialValue: "./dispatch.db",
  });
  onCancel(dbPath);

  // ── 4. INITIAL ACCOUNT ──────────────────────────────────────
  const createAccount = await p.confirm({
    message: "Create your first user account?",
    initialValue: true,
  });
  onCancel(createAccount);

  let accountName = "";
  let accountEmail = "";
  let accountPassword = "";

  if (createAccount) {
    const name = await p.text({
      message: "Display name:",
      placeholder: "Jane Doe",
      validate: (v) => (v.length === 0 ? "Required" : undefined),
    });
    onCancel(name);
    accountName = name as string;

    const email = await p.text({
      message: "Email address:",
      placeholder: "you@example.com",
      validate: (v) => {
        if (!v) return "Required";
        if (!v.includes("@")) return "Enter a valid email";
        return undefined;
      },
    });
    onCancel(email);
    accountEmail = email as string;

    const pwd = await p.password({
      message: "Password:",
      validate: (v) => (v.length < 4 ? "At least 4 characters" : undefined),
    });
    onCancel(pwd);
    accountPassword = pwd as string;
  }

  // ── 5. SEED DATA ────────────────────────────────────────────
  const seedDb = await p.confirm({
    message: "Load sample data? (demo projects, tasks, notes)",
    initialValue: false,
  });
  onCancel(seedDb);

  // ── SUMMARY ─────────────────────────────────────────────────
  p.note(
    [
      `AUTH_SECRET       ${c.dim(authSecret.slice(0, 16) + "...")} ${c.green("(generated)")}`,
      `GitHub OAuth      ${useGitHub ? c.green("enabled") : c.yellow("disabled")}`,
      `Port              ${appPort}`,
      `Database          ${dbPath}`,
      `Initial account   ${createAccount ? c.green(accountEmail as string) : c.yellow("skip")}`,
      `Sample data       ${seedDb ? c.green("yes") : c.yellow("no")}`,
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
  envLines.push("", "# Database", `DATABASE_URL=${dbPath}`, "");
  writeFileSync(envPath, envLines.join("\n"), "utf-8");
  s.stop(c.green("Wrote .env.local"));

  // Push database schema
  s.start("Initializing database schema");
  try {
    execSync("npm run db:push", { stdio: "pipe", cwd: process.cwd() });
    s.stop(c.green("Database schema initialized"));
  } catch {
    s.stop(c.red("Database initialization failed"));
    p.log.error('Run "npm run db:push" manually to retry.');
  }

  // Create user account
  if (createAccount) {
    s.start("Creating user account");
    try {
      const bcrypt = await import("bcryptjs");
      const Database = (await import("better-sqlite3")).default;
      const resolvedDb = resolve(process.cwd(), dbPath as string);
      const sqlite = new Database(resolvedDb);
      const hash = await bcrypt.hash(accountPassword, 10);
      const id = randomUUID();
      sqlite
        .prepare('INSERT INTO "user" (id, name, email, password) VALUES (?, ?, ?, ?)')
        .run(id, accountName, accountEmail, hash);
      sqlite.close();
      s.stop(c.green(`Account created: ${accountEmail}`));
    } catch (err: unknown) {
      s.stop(c.red("Account creation failed"));
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("UNIQUE")) {
        p.log.warning(`Account "${accountEmail}" already exists — you can sign in with it.`);
      } else {
        p.log.error(msg);
      }
    }
  }

  // Seed database
  if (seedDb) {
    s.start("Seeding database with sample data");
    try {
      execSync("npm run db:seed", { stdio: "pipe", cwd: process.cwd() });
      s.stop(c.green("Sample data loaded"));
    } catch {
      s.stop(c.red("Seeding failed"));
      p.log.error('Run "npm run db:seed" manually to retry.');
    }
  }

  // ── NEXT STEPS ──────────────────────────────────────────────
  const nextSteps = [
    "Start the dev server:",
    "",
    `  ${c.cyan(`npm run dev -- --port ${appPort}`)}`,
    "",
    `Then open ${c.underline(appUrl)}`,
  ];
  if (createAccount) {
    nextSteps.push("", `Sign in with: ${c.bold(accountEmail)}`);
  }
  p.note(nextSteps.join("\n"), "Next Steps");

  const runServerNow = await p.confirm({
    message: "Run the development server now? (npm run dev)",
    initialValue: true,
  });
  onCancel(runServerNow);

  if (runServerNow) {
    p.outro(c.green("Setup complete! Starting development server..."));
    p.log.info("Starting development server...");
    execSync(`npm run dev -- --port ${appPort}`, { stdio: "inherit", cwd: process.cwd() });
    return;
  }

  p.outro(c.green("Setup complete! Happy dispatching."));
}

main().catch((err) => {
  p.cancel("Setup failed unexpectedly.");
  console.error(err);
  process.exit(1);
});
