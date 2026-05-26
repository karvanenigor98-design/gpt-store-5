/**
 * Импорт отзывов из data/gpt-telegram-reviews.json в Supabase (GPT STORE).
 * Дедупликация: source_file + telegram_message_id + site_id.
 *
 * Требует: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY в .env.local
 * Перед импортом: npm run reviews:extract
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

function normalizeHash(text) {
  const norm = String(text)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  return crypto.createHash("sha256").update(norm).digest("hex");
}

function parseTelegramMeta(row) {
  const id = String(row.id ?? "");
  const m = id.match(/^tg-(.+)-(\d+)$/);
  if (m) return { sourceFile: m[1], telegramMessageId: Number(m[2]) };
  const m2 = id.match(/^tg-(\d+)$/);
  if (m2) return { sourceFile: "legacy", telegramMessageId: Number(m2[1]) };
  return { sourceFile: "json", telegramMessageId: null };
}

function toIsoFromSortTs(sortTs) {
  if (!sortTs) return new Date().toISOString();
  const n = Number(sortTs);
  if (!Number.isFinite(n)) return new Date().toISOString();
  return new Date(n).toISOString();
}

async function main() {
  loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const jsonPath = path.join(__dirname, "..", "data", "gpt-telegram-reviews.json");
  if (!fs.existsSync(jsonPath)) {
    console.error("Run: npm run reviews:extract first");
    process.exit(1);
  }

  const rows = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  const supabase = createClient(url, key);

  const { data: site } = await supabase.from("sites").select("id").eq("slug", "gpt-store").maybeSingle();
  const siteId = site?.id ?? null;

  const { error: colProbe } = await supabase.from("reviews").select("source_file").limit(1);
  const extendedImport = !colProbe || !/source_file/i.test(colProbe.message ?? "");

  const report = {
    total: rows.length,
    imported: 0,
    skippedDuplicate: 0,
    skippedExistingPublished: 0,
    errors: 0,
  };

  for (const row of rows) {
    const content = String(row.content ?? "").trim();
    if (content.length < 8) continue;

    const { sourceFile, telegramMessageId } = parseTelegramMeta(row);
    const hash = normalizeHash(content);
    const telegramDate = toIsoFromSortTs(row.sortTs);

    if (extendedImport && telegramMessageId != null && sourceFile) {
      const { data: existing } = await supabase
        .from("reviews")
        .select("id,status")
        .eq("telegram_message_id", telegramMessageId)
        .eq("source_file", sourceFile)
        .maybeSingle();

      if (existing) {
        if (existing.status === "approved") {
          report.skippedExistingPublished += 1;
        } else {
          report.skippedDuplicate += 1;
        }
        continue;
      }
    } else if (telegramMessageId != null) {
      const { data: existing } = await supabase
        .from("reviews")
        .select("id,status")
        .eq("telegram_message_id", telegramMessageId)
        .maybeSingle();

      if (existing) {
        if (existing.status === "approved") report.skippedExistingPublished += 1;
        else report.skippedDuplicate += 1;
        continue;
      }
    }

    const payload = {
      site_id: siteId,
      telegram_message_id: telegramMessageId,
      author_name: String(row.authorName ?? "Клиент").slice(0, 120),
      author_username: row.authorUsername ? String(row.authorUsername).replace(/^@+/, "") : null,
      content,
      original_url: row.sourceUrl ?? null,
      telegram_date: telegramDate,
      status: "approved",
    };

    if (extendedImport) {
      Object.assign(payload, {
        source: "telegram",
        source_file: sourceFile,
        normalized_hash: hash,
        imported_at: new Date().toISOString(),
        published_at: telegramDate,
        rating: row.rating != null ? Math.min(5, Math.max(1, Math.round(row.rating))) : 5,
        raw_payload: row,
      });
    }

    const { error } = await supabase.from("reviews").insert(payload);
    if (error) {
      if (error.code === "23505") {
        report.skippedDuplicate += 1;
        continue;
      }
      console.warn("Insert error:", error.message);
      report.errors += 1;
      continue;
    }
    report.imported += 1;
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
