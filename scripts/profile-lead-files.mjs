#!/usr/bin/env node
import { createReadStream, readdirSync, statSync } from "fs";
import path from "path";
import readline from "readline";

const LEADS_DIR = "/opt/vulpine-command-center/leads";
const SUPPORTED = new Set([".csv", ".txt", ".html", ".htm", ".xlsx", ".ods"]);

const FIELD_HINTS = {
  firstName: [/^first[ _-]?name$/i, /^fname$/i],
  lastName: [/^last[ _-]?name$/i, /^lname$/i],
  email: [/e-?mail/i, /^email$/i],
  phone: [/phone/i, /mobile/i, /cell/i],
  companyName: [/company/i, /business/i, /organization/i, /account/i],
  source: [/source/i],
  campaign: [/campaign/i, /list/i],
  notes: [/note/i, /description/i, /comment/i],
};

function parseDelimitedLine(line) {
  const delimiter = line.includes("\t") ? "\t" : ",";
  const values = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}

function candidates(headers) {
  const result = {};
  for (const [field, patterns] of Object.entries(FIELD_HINTS)) {
    const match = headers.find((header) => patterns.some((pattern) => pattern.test(header)));
    if (match) result[field] = match;
  }
  return result;
}

async function profileTextFile(filePath) {
  const stream = createReadStream(filePath, { encoding: "utf8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  let firstLine = "";
  let rows = 0;
  for await (const line of rl) {
    if (!firstLine && line.trim()) firstLine = line;
    if (line.trim()) rows += 1;
  }
  const headers = firstLine ? parseDelimitedLine(firstLine).slice(0, 80) : [];
  return { rows: Math.max(rows - 1, 0), headers, candidateFields: candidates(headers) };
}

async function main() {
  const files = readdirSync(LEADS_DIR)
    .map((name) => {
      const filePath = path.join(LEADS_DIR, name);
      return { name, path: filePath, ext: path.extname(name).toLowerCase(), size: statSync(filePath).size };
    })
    .filter((file) => SUPPORTED.has(file.ext));

  console.log(`Lead file profiler`);
  console.log(`Directory: ${LEADS_DIR}`);
  console.log(`Files scanned: ${files.length}`);
  console.log("");

  for (const file of files) {
    const mb = (file.size / 1024 / 1024).toFixed(2);
    if ([".csv", ".txt", ".html", ".htm"].includes(file.ext)) {
      const profile = await profileTextFile(file.path);
      console.log(`- ${file.name}`);
      console.log(`  type: ${file.ext.slice(1)}`);
      console.log(`  size_mb: ${mb}`);
      console.log(`  row_estimate: ${profile.rows}`);
      console.log(`  headers: ${profile.headers.join(" | ") || "none detected"}`);
      console.log(`  candidate_fields: ${JSON.stringify(profile.candidateFields)}`);
    } else {
      console.log(`- ${file.name}`);
      console.log(`  type: ${file.ext.slice(1)}`);
      console.log(`  size_mb: ${mb}`);
      console.log(`  row_estimate: not inspected without spreadsheet parser`);
      console.log(`  headers: not inspected without spreadsheet parser`);
      console.log(`  candidate_fields: {}`);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
