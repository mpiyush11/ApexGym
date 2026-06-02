/**
 * Production configuration validator (ops helper — run before deploy).
 *
 *   node scripts/check-prod-config.mjs
 *
 * Reads process.env and reports missing/insecure config. Exits non-zero if any
 * REQUIRED value is missing, so it can gate a deploy pipeline. It does NOT run
 * as part of the app (the app stays env-safe at runtime); this is a checklist.
 */

const REQUIRED = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
  "FIREBASE_ADMIN_PROJECT_ID",
  "FIREBASE_ADMIN_CLIENT_EMAIL",
  "FIREBASE_ADMIN_PRIVATE_KEY",
];

const RECOMMENDED = [
  "NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY", // public form abuse protection
  "CRON_SECRET", // protects status recompute + weekly report jobs
  "NEXT_PUBLIC_DEFAULT_CURRENCY",
  "NEXT_PUBLIC_DEFAULT_TIMEZONE",
];

function present(k) {
  return typeof process.env[k] === "string" && process.env[k].trim() !== "";
}

const missingRequired = REQUIRED.filter((k) => !present(k));
const missingRecommended = RECOMMENDED.filter((k) => !present(k));

console.log("— GymOS production config check —\n");

console.log("Required:");
for (const k of REQUIRED) console.log(`  ${present(k) ? "✅" : "❌"} ${k}`);

console.log("\nRecommended:");
for (const k of RECOMMENDED) console.log(`  ${present(k) ? "✅" : "⚠️ "} ${k}`);

// Sanity checks.
const warnings = [];
if (present("FIREBASE_ADMIN_PRIVATE_KEY") && !process.env.FIREBASE_ADMIN_PRIVATE_KEY.includes("PRIVATE KEY")) {
  warnings.push("FIREBASE_ADMIN_PRIVATE_KEY does not look like a PEM key.");
}
if (
  present("NEXT_PUBLIC_FIREBASE_PROJECT_ID") &&
  present("FIREBASE_ADMIN_PROJECT_ID") &&
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== process.env.FIREBASE_ADMIN_PROJECT_ID
) {
  warnings.push("Web and Admin project IDs differ — verify this is intentional.");
}
if (!present("NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY")) {
  warnings.push("App Check site key missing — public contact form has reduced bot protection.");
}
if (!present("CRON_SECRET")) {
  warnings.push("CRON_SECRET missing — schedule jobs will only run via owner action.");
}

if (warnings.length) {
  console.log("\nWarnings:");
  for (const w of warnings) console.log(`  ⚠️  ${w}`);
}

if (missingRequired.length) {
  console.error(`\n❌ FAIL: ${missingRequired.length} required variable(s) missing.`);
  process.exit(1);
}
console.log(
  `\n✅ PASS: all required config present.${
    missingRecommended.length ? ` (${missingRecommended.length} recommended missing)` : ""
  }`,
);
