/**
 * LLM-driven Flutter UI Analyzer — Hugging Face Router (OpenAI-compatible)
 * NO FALLBACK, INFINITE RETRY
 *
 * Input CSV (wajib kolom) --> Output dari dart-smell-llm.js:
 *   file_path, class_name, method_name, start_line, end_line, code_snippet
 *
 * Output CSV (tambahan kolom):
 *   NEST_DEPTH, CHAIN_LEN, WIDGETS_PER_BUILD, RENDER_CYCLO, MUTATION_COUNT, SIDE_EFFECT_CALLS,
 *   status(ui|non-ui), llm_reason
 *
 * Env (opsional):
 *   HF_TOKEN=...                      (wajib untuk akses Hugging Face Inference Router)
 *   HF_BASE_URL=https://router.huggingface.co/v1   (opsional; default sesuai ini)
 *
 * Flags:
 *   --from-csv <in.csv>
 *   --out <out.csv>
 *   --json <out.json>           (opsional)
 *   --model <router-model>      (default: openai/gpt-oss-120b:fireworks-ai)
 *   --warn <int> --fail <int>   (default: 6, 8)  ← untuk informasi saja
 *   --concurrency <N>           (default: 1) (tetap sequential demi aman)
 *   --retry-delay-ms <int>      (default: 2000)
 *   --dry-run                   (cetak CSV ke stdout, tidak menulis file)
 */

import fs from "fs"
import OpenAI from "openai"

/* ================= CSV utils ================= */
function parseCSV(text) {
  const rows = []
  let i = 0,
    field = "",
    row = [],
    inQuotes = false
  while (i < text.length) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else field += ch
    } else {
      if (ch === '"') inQuotes = true
      else if (ch === ",") {
        row.push(field)
        field = ""
      } else if (ch === "\n") {
        row.push(field)
        rows.push(row)
        row = []
        field = ""
      } else if (ch !== "\r") field += ch
    }
    i++
  }
  if (field.length || inQuotes || row.length) {
    row.push(field)
    rows.push(row)
  }
  if (!rows.length) return { header: [], data: [] }
  const header = rows[0]
  const data = rows.slice(1).map((r) => {
    const obj = {}
    for (let j = 0; j < header.length; j++) obj[header[j]] = r[j] ?? ""
    return obj
  })
  return { header, data }
}
function escCSV(v) {
  return '"' + String(v ?? "").replace(/"/g, '""') + '"'
}
function writeCSV(filePath, header, rows) {
  const out = [header.join(",")]
  for (const r of rows) out.push(header.map((h) => escCSV(r[h])).join(","))
  fs.writeFileSync(filePath, out.join("\n"), "utf8")
}
/* new: ensure header and append row */
function ensureOutputCsv(filePath, header) {
  if (fs.existsSync(filePath)) {
    const stat = fs.statSync(filePath)
    if (stat.size > 0) return
  }
  fs.writeFileSync(filePath, header.join(",") + "\n", "utf8")
}
function appendCsvRow(filePath, header, rowObj) {
  const line = header.map((h) => escCSV(rowObj[h])).join(",") + "\n"
  fs.appendFileSync(filePath, line, "utf8")
}

/* =============== Prompt & LLM (HF Router) =============== */
function buildPrompt(snippet) {
  return `
You are a static analyzer for Flutter UI. Return ONLY valid JSON (no prose).
Analyze the provided code snippet (may include an entire class). Focus on the *build()* method if present.

Rules:
- Count depth ONLY for nested Widget constructors (custom widgets count). Ignore non-widget objects (TextStyle, BoxDecoration, EdgeInsets, Controllers, Colors, Durations, Curves, Animations, etc).
- CHAIN_LEN: longest chain where each widget uses exactly "child:" (no "children:") leading to another widget (outer→inner count).
- WIDGETS_PER_BUILD: total widget constructor calls inside a single build() body.
- RENDER_CYCLO: cyclomatic complexity inside build() considering if/else-if/switch/case/for/while/do and ternary ?:. Base = 0.
- MUTATION_COUNT: number of state/collection writes inside build() (e.g., setState(...), x++, +=, =, .add/.remove/.clear/.insert etc).
- SIDE_EFFECT_CALLS: number of side-effectful calls started inside build() (e.g., dart:io/process/sleep, http/Dio, db/storage, timers/streams/listeners, heavy parse/codec/crypto).

If no UI/widget tree, set is_ui=false (but still compute metrics best-effort as 0s).

Respond with exactly this JSON (no extra keys):
{
  "is_ui": boolean,
  "metrics": {
    "nest_depth": integer,
    "chain_len": integer,
    "widgets_per_build": integer,
    "render_cyclo": integer,
    "mutation_count": integer,
    "side_effect_calls": integer
  },
  "reasoning": string
}

----- BEGIN SNIPPET -----
${snippet}
----- END SNIPPET -----
`.trim()
}

async function hfOnce({ client, model, snippet }) {
  await new Promise((r) => setTimeout(r, 3000))

  const completion = await client.chat.completions.create({
    model,
    messages: [
      {
        role: "user",
        content: buildPrompt(snippet),
      },
    ],
    // Try JSON mode; if backend ignores, we still parse the text
    response_format: { type: "json_object" },
    temperature: 0,
  })

  const text = completion?.choices?.[0]?.message?.content ?? ""
  if (!text) throw new Error("Empty LLM response")

  let parsed
  console.log("LLM raw response:", text)
  try {
    parsed = JSON.parse(text)
  } catch {
    parsed = {
      is_ui: false,
      metrics: {},
      reasoning: `LLM response not valid JSON`,
    }
  }

  if (typeof parsed.is_ui !== "boolean") parsed.is_ui = false
  const m = parsed.metrics || {}
  const coerce = (x) => Math.max(0, Number(x) || 0)
  return {
    is_ui: parsed.is_ui,
    metrics: {
      nest_depth: coerce(m.nest_depth),
      chain_len: coerce(m.chain_len),
      widgets_per_build: coerce(m.widgets_per_build),
      render_cyclo: coerce(m.render_cyclo),
      mutation_count: coerce(m.mutation_count),
      side_effect_calls: coerce(m.side_effect_calls),
    },
    reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning : "",
  }
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

/** Infinite retry with fixed delay */
async function hfAnalyzeWithRetry({ client, model, snippet, delayMs, label }) {
  let attempt = 1
  for (;;) {
    try {
      if (attempt > 1) console.log(`${label} Retry attempt #${attempt}...`)
      const r = await hfOnce({ client, model, snippet })
      return r
    } catch (e) {
      const msg = e?.message || String(e)
      console.warn(`${label} LLM error: ${msg}. Will retry in ${delayMs}ms.`)
      await sleep(delayMs)
      attempt++
    }
  }
}

/* =============== Status =============== */
function statusFrom(is_ui) {
  return is_ui ? "ui" : "non-ui"
}

/* =============== Main =============== */
async function main() {
  const args = process.argv.slice(2)
  const inIdx = args.indexOf("--from-csv")
  const outIdx = args.indexOf("--out")
  const jsonIdx = args.indexOf("--json")
  const modelIdx = args.indexOf("--model")
  const warnIdx = args.indexOf("--warn")
  const failIdx = args.indexOf("--fail")
  const concIdx = args.indexOf("--concurrency")
  const delayIdx = args.indexOf("--retry-delay-ms")
  const dry = args.includes("--dry-run")

  if (inIdx === -1 || outIdx === -1) {
    console.error(
      "Usage: node dart-smell-llm-hf.mjs --from-csv input.csv --out output.csv [--json out.json] [--model openai/gpt-oss-120b:fireworks-ai] [--warn 6] [--fail 8] [--concurrency 1] [--retry-delay-ms 2000] [--dry-run]"
    )
    process.exit(1)
  }

  const inputPath = args[inIdx + 1]
  const outPath = args[outIdx + 1]
  const jsonPath = jsonIdx !== -1 ? args[jsonIdx + 1] : null
  const model =
    modelIdx !== -1 ? args[modelIdx + 1] : "openai/gpt-oss-120b:fireworks-ai"
  const WARN = warnIdx !== -1 ? parseInt(args[warnIdx + 1], 10) || 6 : 6
  const FAIL = failIdx !== -1 ? parseInt(args[failIdx + 1], 10) || 8 : 8
  const REQ_CONC =
    concIdx !== -1 ? Math.max(1, parseInt(args[concIdx + 1], 10) || 1) : 1
  const RETRY_DELAY_MS =
    delayIdx !== -1
      ? Math.max(0, parseInt(args[delayIdx + 1], 10) || 2000)
      : 2000

  const baseURL = process.env.HF_BASE_URL || "https://api.groq.com/openai/v1"
  const apiKey = process.env.HF_TOKEN
  if (!apiKey) {
    console.error("Missing HF_TOKEN environment variable.")
    process.exit(1)
  }

  const client = new OpenAI({ baseURL, apiKey })

  if (!fs.existsSync(inputPath)) {
    console.error("CSV not found:", inputPath)
    process.exit(1)
  }
  const raw = fs.readFileSync(inputPath, "utf8")
  const { header, data } = parseCSV(raw)

  const needed = [
    "file_path",
    "class_name",
    "method_name",
    "start_line",
    "end_line",
    "code_snippet",
  ]
  for (const k of needed)
    if (!header.includes(k)) {
      console.error("Missing column in CSV:", k)
      process.exit(1)
    }

  const outHeader = [
    ...header,
    "NEST_DEPTH",
    "CHAIN_LEN",
    "WIDGETS_PER_BUILD",
    "RENDER_CYCLO",
    "MUTATION_COUNT",
    "SIDE_EFFECT_CALLS",
    "status",
    "llm_reason",
  ]

  if (REQ_CONC > 1) {
    console.warn(
      `[info] Concurrency requested = ${REQ_CONC}, but flow is sequential for safe streaming. Using concurrency=1.`
    )
  }

  const jsonItems = []
  const total = data.length
  const remaining = data.slice()

  console.log("=== dart-smell-llm-hf ===")
  console.log(`Input CSV  : ${inputPath}`)
  console.log(`Output CSV : ${outPath}`)
  if (jsonPath) console.log(`Output JSON: ${jsonPath}`)
  console.log(`Model      : ${model}`)
  console.log(`Base URL   : ${baseURL}`)
  console.log(`Warn/Fail  : ${WARN}/${FAIL}`)
  console.log(`Retry delay: ${RETRY_DELAY_MS}ms`)
  console.log(`Total rows : ${total}`)
  console.log("================================\n")

  if (!dry) ensureOutputCsv(outPath, outHeader)

  let processed = 0
  while (remaining.length > 0) {
    const rowIndex = processed
    const row = remaining[0]
    const label = `[${rowIndex + 1}/${total}]`
    const title = `${row.file_path || ""}${
      row.class_name ? " :: " + row.class_name : ""
    }${row.method_name ? "." + row.method_name : ""}`
    console.log(
      `${label} Start  → ${title} (lines ${row.start_line}-${row.end_line})`
    )

    const snip = row.code_snippet || ""
    const r = await hfAnalyzeWithRetry({
      client,
      model,
      snippet: snip,
      delayMs: RETRY_DELAY_MS,
      label,
    })

    const is_ui = r.is_ui
    const metrics = r.metrics
    const reason = r.reasoning

    console.log(
      `${label} LLM OK  ← depth=${metrics.nest_depth}, chain=${metrics.chain_len}, widgets=${metrics.widgets_per_build}, cyclo=${metrics.render_cyclo}, mut=${metrics.mutation_count}, side=${metrics.side_effect_calls}`
    )

    const status = statusFrom(is_ui)
    console.log(`${label} Done    ✓ status=${status}`)

    const outRow = {
      ...row,
      NEST_DEPTH: String(metrics.nest_depth),
      CHAIN_LEN: String(metrics.chain_len),
      WIDGETS_PER_BUILD: String(metrics.widgets_per_build),
      RENDER_CYCLO: String(metrics.render_cyclo),
      MUTATION_COUNT: String(metrics.mutation_count),
      SIDE_EFFECT_CALLS: String(metrics.side_effect_calls),
      status,
      llm_reason: reason,
    }

    if (dry) {
      if (processed === 0) {
        console.log("\n=== DRY RUN CSV ===")
        console.log(outHeader.join(","))
      }
      console.log(outHeader.map((h) => escCSV(outRow[h])).join(","))
    } else {
      appendCsvRow(outPath, outHeader, outRow)
    }

    if (jsonPath) {
      jsonItems.push({
        file_path: row.file_path,
        class_name: row.class_name,
        method_name: row.method_name,
        start_line: Number(row.start_line || 0),
        end_line: Number(row.end_line || 0),
        ...metrics,
        status,
        llm_reason: reason,
        engine: "hf-router",
      })
    }

    remaining.shift()
    processed++

    if (!dry) {
      try {
        writeCSV(inputPath, header, remaining)
        console.log(
          `${label} Input CSV updated (remaining: ${remaining.length})`
        )
      } catch (e) {
        console.warn(
          `${label} WARNING: failed to update input CSV: ${e.message || e}`
        )
      }
    }
  }

  console.log(`\nProcessed: ${processed}/${total}`)

  if (!dry && jsonPath) {
    fs.writeFileSync(
      jsonPath,
      JSON.stringify(
        {
          generated_at: new Date().toISOString(),
          engine: "hf-router",
          baseURL,
          model,
          warn: WARN,
          fail: FAIL,
          items: jsonItems,
        },
        null,
        2
      ),
      "utf8"
    )
    console.log(`JSON saved : ${jsonPath}`)
  }

  if (!dry) {
    console.log(`CSV updated per-row → ${outPath}`)
    console.log(`Input CSV trimmed   → ${inputPath}`)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
