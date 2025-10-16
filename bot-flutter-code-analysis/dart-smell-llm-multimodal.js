/**
 * LLM-driven Flutter UI Analyzer — Groq (OpenAI-compatible)
 * MULTI-MODEL FALLBACK + RETRY-AWARE + STACK ROTATION
 *
 * Input CSV (wajib kolom) --> Output dari dart-search-bot.js:
 *   file_path, class_name, method_name, start_line, end_line, code_snippet
 *
 * Output CSV (tambahan kolom):
 *   NEST_DEPTH, CHAIN_LEN, WIDGETS_PER_BUILD, RENDER_CYCLO, MUTATION_COUNT, SIDE_EFFECT_CALLS,
 *   status(ui|non-ui), llm_reason
 *
 * Env:
 *   GROQ_API_KEY=...                                (wajib)
 *   GROQ_BASE_URL=https://api.groq.com/openai/v1    (opsional; default sesuai ini)
 *   GROQ_MODELS="llama-3.1-70b-versatile,mixtral-8x7b-32768" (opsional; override --model)
 *
 * Flags:
 *   --from-csv <in.csv>
 *   --out <out.csv>
 *   --json <out.json>                (opsional)
 *   --model <model>                  (default: llama-3.1-70b-versatile)
 *   --models <m1,m2,...>             (override --model; urutan = prioritas)
 *   --attempts-per-model <N>         (default: 3)
 *   --warn <int> --fail <int>        (default: 6, 8)  ← untuk informasi saja
 *   --concurrency <N>                (default: 1) (tetap sequential demi aman)
 *   --retry-delay-ms <int>           (default: 2000)
 *   --dry-run                        (cetak CSV ke stdout, tidak menulis file)
 *
 * Catatan “STACK ROTATION”:
 * - Kita memakai antrean (queue) model.
 * - Untuk setiap snippet:
 *   - Selalu coba model di indeks 0 dulu.
 *   - Jika model tsb GAGAL setelah N percobaan, model itu dipindah ke BELAKANG antrean (rotasi),
 *     lalu kita lanjut coba model yang sekarang berada di depan antrean.
 *   - Jika BERHASIL, antrean tidak di-rotasi (supaya model yang sehat tetap dipakai).
 * - Antrean dipertahankan lintas-snippet, jadi error di satu snippet akan menggeser prioritas
 *   untuk snippet berikutnya sesuai permintaan Anda.
 */

import fs from "fs"
import OpenAI from "openai"
import Cerebras from "@cerebras/cerebras_cloud_sdk"

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

/* =============== Prompt & LLM =============== */
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

async function llmOnce({ client, model, snippet }) {
  // throttle ringan per request (opsional)
  await new Promise((r) => setTimeout(r, 3000))

  const completion = await client.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content: buildPrompt(snippet),
      },
    ],
    stream: true,
    max_completion_tokens: 20000,
    temperature: 0.7,
    top_p: 0.8,
  })

  let text
  for await (const chunk of completion) {
    text = (text || "") + chunk.choices[0]?.delta?.content || ""
  }

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

/* Retry helpers */
function isRetryableError(e) {
  const status = e?.status || e?.response?.status
  // network / 408 / 409 / 425 / 429 / 5xx dianggap retryable
  return (
    !status ||
    status === 408 ||
    status === 409 ||
    status === 425 ||
    status === 429 ||
    (status >= 500 && status <= 599)
  )
}
function nextDelayMs(e, fallbackMs) {
  const ra = Number(e?.response?.headers?.["retry-after"])
  if (Number.isFinite(ra) && ra >= 0) return ra * 1000
  return fallbackMs
}

/**
 * Analisis dengan antrean model (stack rotation/queue):
 * - Selalu coba modelQueue[0] dulu.
 * - Jika gagal setelah attemptsPerModel: ROTASI → model gagal dipindah ke belakang antrean.
 * - Jika berhasil: JANGAN rotasi (pertahankan model unggulan).
 * - Fungsi MEMODIFIKASI modelQueue (antrean dipakai lintas-snippet).
 */
async function analyzeWithQueue({
  client,
  modelQueue,
  snippet,
  delayMs,
  attemptsPerModel,
  label,
}) {
  if (!Array.isArray(modelQueue) || modelQueue.length === 0) {
    throw new Error("Empty model queue")
  }

  const maxModelsToTry = modelQueue.length
  let tried = 0

  while (true) {
    const currentModel = modelQueue[0]
    let success = false
    let lastError = null

    for (let attempt = 1; attempt <= attemptsPerModel; attempt++) {
      try {
        if (attempt > 1)
          console.log(`${label} [${currentModel}] retry #${attempt}...`)
        const r = await llmOnce({ client, model: currentModel, snippet })
        // Sukses → jangan rotasi; kembalikan hasil
        success = true
        return { ...r, used_model: currentModel }
      } catch (e) {
        lastError = e
        const msg = e?.message || String(e)
        const dms = nextDelayMs(e, delayMs)
        const canRetry = isRetryableError(e) && attempt < attemptsPerModel
        console.warn(
          `${label} [${currentModel}] error: ${msg}${
            canRetry ? ` → retry in ${dms}ms` : ""
          }`
        )
        if (canRetry) await sleep(dms)
        else break
      }
    }

    if (!success) {
      // ROTASI: geser model gagal ke belakang antrean
      const failed = modelQueue.shift()
      modelQueue.push(failed)
      tried++
      console.warn(
        `${label} [${failed}] failed after ${attemptsPerModel} attempt(s) → rotated to back. Next up: ${modelQueue[0]}`
      )
    }
  }

  throw new Error("All models failed")
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
  const modelsIdx = args.indexOf("--models")
  const warnIdx = args.indexOf("--warn")
  const failIdx = args.indexOf("--fail")
  const concIdx = args.indexOf("--concurrency")
  const delayIdx = args.indexOf("--retry-delay-ms")
  const apmIdx = args.indexOf("--attempts-per-model")
  const dry = args.includes("--dry-run")

  if (inIdx === -1 || outIdx === -1) {
    console.error(
      "Usage: node dart-smell-llm-groq.mjs --from-csv input.csv --out output.csv [--json out.json] [--model llama-3.1-70b-versatile] [--models m1,m2,...] [--attempts-per-model 3] [--warn 6] [--fail 8] [--concurrency 1] [--retry-delay-ms 2000] [--dry-run]"
    )
    process.exit(1)
  }

  const inputPath = args[inIdx + 1]
  const outPath = args[outIdx + 1]
  const jsonPath = jsonIdx !== -1 ? args[jsonIdx + 1] : null

  const singleModel =
    modelIdx !== -1 ? args[modelIdx + 1] : "llama-3.1-70b-versatile"
  const modelListStr =
    modelsIdx !== -1 ? args[modelsIdx + 1] : process.env.GROQ_MODELS || ""
  const INITIAL_MODELS = (modelListStr || singleModel)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)

  const WARN = warnIdx !== -1 ? parseInt(args[warnIdx + 1], 10) || 6 : 6
  const FAIL = failIdx !== -1 ? parseInt(args[failIdx + 1], 10) || 8 : 8
  const REQ_CONC =
    concIdx !== -1 ? Math.max(1, parseInt(args[concIdx + 1], 10) || 1) : 1
  const RETRY_DELAY_MS =
    delayIdx !== -1
      ? Math.max(0, parseInt(args[delayIdx + 1], 10) || 2000)
      : 2000
  const ATTEMPTS_PER_MODEL =
    apmIdx !== -1 ? Math.max(1, parseInt(args[apmIdx + 1], 10) || 1) : 1

  const baseURL = process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1"
  const apiKey = process.env.GROQ_API_KEY || ""
  if (!apiKey) {
    console.error("Missing GROQ_API_KEY environment variable.")
    process.exit(1)
  }

  const client = new Cerebras({ apiKey })

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
  for (const k of needed) {
    if (!header.includes(k)) {
      console.error("Missing column in CSV:", k)
      process.exit(1)
    }
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

  // ANTREAN MODEL YANG BISA BERUBAH (rotasi lintas-snippet)
  const modelQueue = INITIAL_MODELS.slice()

  console.log("=== dart-smell-llm-groq ===")
  console.log(`Input CSV  : ${inputPath}`)
  console.log(`Output CSV : ${outPath}`)
  if (jsonPath) console.log(`Output JSON: ${jsonPath}`)
  console.log(`Models (queue): ${modelQueue.join(" , ")}`)
  console.log(`Base URL   : ${baseURL}`)
  console.log(`Warn/Fail  : ${WARN}/${FAIL}`)
  console.log(`Retry delay: ${RETRY_DELAY_MS}ms (per attempt)`)
  console.log(`Attempts/model: ${ATTEMPTS_PER_MODEL}`)
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
    let r
    try {
      r = await analyzeWithQueue({
        client,
        modelQueue, // dipass by reference & akan dirotasi jika gagal
        snippet: snip,
        delayMs: RETRY_DELAY_MS,
        attemptsPerModel: ATTEMPTS_PER_MODEL,
        label,
      })
    } catch (e) {
      const errMsg = e?.message || String(e)
      console.warn(`${label} All models failed: ${errMsg}`)
      r = {
        is_ui: false,
        metrics: {
          nest_depth: 0,
          chain_len: 0,
          widgets_per_build: 0,
          render_cyclo: 0,
          mutation_count: 0,
          side_effect_calls: 0,
        },
        reasoning: `All models failed: ${errMsg}`,
        used_model: modelQueue[0] || "",
      }
    }

    const is_ui = r.is_ui
    const metrics = r.metrics
    const reason = r.reasoning

    console.log(
      `${label} LLM OK  ← model=${r.used_model}, depth=${metrics.nest_depth}, chain=${metrics.chain_len}, widgets=${metrics.widgets_per_build}, cyclo=${metrics.render_cyclo}, mut=${metrics.mutation_count}, side=${metrics.side_effect_calls}`
    )

    const status = statusFrom(is_ui)
    console.log(`${label} Done    ✓ status=${status}`)
    console.log(`${label} Queue   ≡ ${modelQueue.join(" , ")}`)

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
        used_model: r.used_model,
        engine: "groq-openai",
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
          engine: "groq-openai",
          baseURL,
          models: modelQueue, // final order setelah rotasi-rotasi
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
