import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const supabaseDir = path.join(root, "supabase");

const sqlFiles = [];

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }
    if (entry.isFile() && entry.name.toLowerCase().endsWith(".sql")) {
      sqlFiles.push(fullPath);
    }
  }
}

function stripInlineComment(line) {
  const idx = line.indexOf("--");
  return idx >= 0 ? line.slice(0, idx) : line;
}

const forbiddenPatterns = [
  /\bcreate\s+table(?:\s+if\s+not\s+exists)?\s+public\./i,
  /\balter\s+table\s+public\./i,
  /\bdrop\s+table(?:\s+if\s+exists)?\s+public\./i,
  /\btruncate\s+table\s+public\./i,
  /\binsert\s+into\s+public\./i,
  /\bupdate\s+public\./i,
  /\bdelete\s+from\s+public\./i,
  /\bset\s+(?:local\s+)?search_path\s*=\s*public\b/i,
];

const violations = [];

if (!fs.existsSync(supabaseDir)) {
  console.error("supabase directory not found.");
  process.exit(1);
}

walk(supabaseDir);

for (const file of sqlFiles) {
  const rel = path.relative(root, file);
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((rawLine, idx) => {
    const line = stripInlineComment(rawLine);
    if (!line.trim()) return;
    for (const pattern of forbiddenPatterns) {
      if (pattern.test(line)) {
        violations.push({
          file: rel,
          line: idx + 1,
          text: rawLine.trim(),
        });
        break;
      }
    }
  });
}

if (violations.length > 0) {
  console.error("SQL schema scope validation failed. Found forbidden public schema writes:");
  for (const v of violations) {
    console.error(`- ${v.file}:${v.line} -> ${v.text}`);
  }
  process.exit(1);
}

console.log(`SQL schema scope validation passed. Scanned ${sqlFiles.length} SQL file(s).`);
