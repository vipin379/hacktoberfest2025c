#!/usr/bin/env node
/**
 * dart-search-bot.js
 *
 * Bot/CLI Node.js untuk mengindeks dan mencari class & method di proyek Dart/Flutter.
 * - Rekursif memindai semua file .dart **hanya** di dalam folder `lib/`
 * - Menampilkan lokasi (file, start_line, end_line) dan cuplikan kode
 * - Mode sekali jalan: gunakan argumen --find class <Nama> atau --find method <Nama>
 * - Mode ekspor: --json <file.json> untuk menyimpan indeks
 * - Mode CSV: --csv <file.csv> untuk ekspor hasil ke CSV (newline di-snippet tetap dipertahankan)
 * - Mode listing: --list all | --list classes | --list methods | --list functions
 *
 * Contoh pakai:
 *   node dart-search-bot.js /path/ke/proyek
 *   node dart-search-bot.js /path/ke/proyek --find class SplashScreen
 *   node dart-search-bot.js /path/ke/proyek --find method build
 *   node dart-search-bot.js /path/ke/proyek --json index.json
 *
 * Catatan: Ini memakai regex + pencocokan kurung sederhana.
 */

"use strict"

const fs = require("fs")
const path = require("path")
const readline = require("readline")

// List ignore
const DEFAULT_IGNORES = new Set([
  "node_modules",
  ".git",
  ".dart_tool",
  "build",
  ".idea",
  ".vscode",
  ".gradle",
  ".svn",
  "ios",
  "android",
  ".flutter-plugins",
  ".flutter-plugins-dependencies",
])

// List of al files .dart di lib directory
function listDartFiles(rootDir, ignores = DEFAULT_IGNORES) {
  const results = []
  function walk(dir) {
    let entries
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const ent of entries) {
      const full = path.join(dir, ent.name)
      if (ent.isDirectory()) {
        if (ignores.has(ent.name)) continue
        walk(full)
      } else if (ent.isFile() && full.endsWith(".dart")) {
        results.push(full)
      }
    }
  }
  walk(rootDir)
  return results
}

// Helper menghitung LOC (Line of Code) di file
function buildLineIndex(text) {
  const lineStarts = [0]
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\n") lineStarts.push(i + 1)
  }

  return lineStarts
}

function posToLine(lineStarts, pos) {
  // Binary search untuk cari baris berdasarkan posisi karakter.
  let lo = 0,
    hi = lineStarts.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (lineStarts[mid] <= pos) {
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return hi // 0-based
}

function findMatchingBrace(text, openIdx) {
  let depth = 0
  for (let i = openIdx; i < text.length; i++) {
    const ch = text[i]
    if (ch === "{") depth++
    else if (ch === "}") {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

// Parser class & method
function parseDart(text, filePath) {
  const classes = []
  const functions = []
  const lineIdx = buildLineIndex(text) // LOC

  // Catch class: "class Name ... { ... }"
  const classRe =
    /(^|\n)\s*(?:(?:abstract|base|sealed|final|interface)\s+)*(?:mixin\s+)?class\s+([A-Za-z_]\w*)\b[^\n{]*\{/g

  let m
  while ((m = classRe.exec(text)) !== null) {
    const name = m[2]
    const braceOpen = text.indexOf("{", m.index)
    if (braceOpen === -1) continue
    const braceClose = findMatchingBrace(text, braceOpen)

    const beforeBrace = text.slice(m.index, braceOpen)
    const relClass = beforeBrace.search(/\bclass\s+/)
    const classStartPos = relClass !== -1 ? m.index + relClass : m.index
    const startLine = posToLine(lineIdx, classStartPos) + 1

    const endLine =
      braceClose !== -1 ? posToLine(lineIdx, braceClose) + 1 : startLine

    const classBlock = text.slice(
      braceOpen + 1,
      braceClose === -1 ? text.length : braceClose
    )
    const classBlockOffset = braceOpen + 1

    const methods = extractMethods(
      text,
      classBlock,
      classBlockOffset,
      lineIdx,
      name
    )

    classes.push({
      type: "class",
      name,
      file_path: filePath,
      start_line: startLine,
      end_line: endLine,
      code_snippet: safeSnippet(text, lineIdx, startLine, endLine),
      methods,
    })
  }

  // Tangkap top-level functions (yang bukan di dalam class)
  // Pola kasar: <tipe?> <nama>(...) { ... } atau => ...;
  // Hindari kata kunci kontrol.
  const control = new Set([
    "if",
    "for",
    "while",
    "switch",
    "catch",
    "try",
    "do",
    "else",
  ])
  const funcRe =
    /(^|\n)\s*(?:[A-Za-z_][\w<>,\[\]\.\?\s]*\s+)?([a-z_]\w*)\s*\([^;{}]*\)\s*(?:async\s*)?(\{|=>)/g

  while ((m = funcRe.exec(text)) !== null) {
    const name = m[2]
    if (control.has(name)) continue

    const arrowOrBrace = m[3]
    let start = m.index + (m[1] ? m[1].length : 0)
    let endPos = -1
    if (arrowOrBrace === "{") {
      const open = text.indexOf("{", m.index)
      endPos = findMatchingBrace(text, open)
    } else {
      // Khusus arrow function
      // =>
      // Cari akhir ekspresi panah sampai ';'
      endPos = text.indexOf(";", funcRe.lastIndex)
      if (endPos === -1) endPos = funcRe.lastIndex
    }
    const startLine = posToLine(lineIdx, start) + 1
    const endLine = endPos !== -1 ? posToLine(lineIdx, endPos) + 1 : startLine

    // Skip bila berada di dalam kelas yang sudah kita catat
    if (insideAnyClass(startLine, classes)) continue

    functions.push({
      type: "function",
      name,
      file_path: filePath,
      start_line: startLine,
      end_line: endLine,
      code_snippet: safeSnippet(text, lineIdx, startLine, endLine),
    })
  }

  return { classes, functions }
}

function insideAnyClass(line, classes) {
  for (const c of classes) {
    if (line >= c.start_line && line <= c.end_line) return true
  }
  return false
}

function extractMethods(fullText, blockText, blockOffset, lineIdx, className) {
  const methods = []
  const control = new Set([
    "if",
    "for",
    "while",
    "switch",
    "catch",
    "try",
    "do",
    "else",
  ])
  const methodRe =
    /(^|\n)\s*(?:[A-Za-z_][\w<>,\[\]\.\?\s]*\s+)?([a-z_]\w*)\s*\([^;{}]*\)\s*(?:async\s*)?(\{|=>)/g

  let m
  while ((m = methodRe.exec(blockText)) !== null) {
    const name = m[2]
    if (control.has(name)) continue

    const arrowOrBrace = m[3]
    let sigStart = blockOffset + m.index + (m[1] ? m[1].length : 0)
    let endPos = -1
    if (arrowOrBrace === "{") {
      const open = blockText.indexOf("{", m.index) + blockOffset
      endPos = findMatchingBraceFull(blockText, blockOffset, open)
    } else {
      // =>
      // Akhiri di ';' berikutnya setelah panah
      const relEnd = blockText.indexOf(";", m.index)
      endPos = relEnd !== -1 ? blockOffset + relEnd : blockOffset + m.index
    }

    const startLine = posToLine(lineIdx, sigStart) + 1
    const endLine = endPos !== -1 ? posToLine(lineIdx, endPos) + 1 : startLine

    methods.push({
      type: "method",
      class_name: className,
      name,
      start_line: startLine,
      end_line: endLine,
      code_snippet: safeSnippet(fullText, lineIdx, startLine, endLine),
    })
  }
  return methods
}

function findMatchingBraceFull(blockText, blockOffset, openIdxFull) {
  // openIdxFull adalah indeks absolut pada teks penuh
  const i = openIdxFull - blockOffset
  const relClose = findMatchingBrace(blockText, i)
  if (relClose === -1) return -1
  return blockOffset + relClose
}

function safeSnippet(fullText, lineIdx, startLine, endLine) {
  const total = endLine - startLine + 1
  const take = Math.min(total)
  const startPos = lineIdx[startLine - 1] ?? 0
  const endPos = lineIdx[startLine - 1 + take] ?? fullText.length
  return fullText.slice(startPos, endPos).trim()
}

// indexing project
function indexProject(rootDir) {
  const files = listDartFiles(rootDir)
  const index = {
    indexed_at: new Date().toISOString(),
    root: path.resolve(rootDir),
    files: [],
  }

  for (const file of files) {
    let text = ""
    try {
      text = fs.readFileSync(file, "utf8")
    } catch {
      continue
    }
    const parsed = parseDart(text, file)
    if (parsed.classes.length || parsed.functions.length) {
      index.files.push({
        file_path: file,
        classes: parsed.classes,
        functions: parsed.functions,
      })
    }
  }

  return index
}

// Searching class
function findByClass(index, className) {
  const results = []
  for (const f of index.files) {
    for (const c of f.classes) {
      if (c.name.toLowerCase() === className.toLowerCase()) {
        results.push({
          file_path: c.file_path,
          class_name: c.name,
          start_line: c.start_line,
          end_line: c.end_line,
          code_snippet: c.code_snippet,
        })
      }
    }
  }
  return results
}

// Searching method (termasuk top-level function)
function findByMethod(index, methodName) {
  const results = []
  for (const f of index.files) {
    for (const c of f.classes) {
      for (const m of c.methods) {
        if (m.name.toLowerCase() === methodName.toLowerCase()) {
          results.push({
            file_path: c.file_path,
            class_name: m.class_name,
            method_name: m.name,
            start_line: m.start_line,
            end_line: m.end_line,
            code_snippet: m.code_snippet,
          })
        }
      }
    }
    for (const fn of f.functions) {
      if (fn.name.toLowerCase() === methodName.toLowerCase()) {
        results.push({
          file_path: fn.file_path,
          method_name: fn.name,
          start_line: fn.start_line,
          end_line: fn.end_line,
          code_snippet: fn.code_snippet,
        })
      }
    }
  }
  return results
}

function printResults(results) {
  if (!results.length) {
    console.log("Tidak ditemukan.")
    return
  }
  for (const r of results) {
    console.log("=".repeat(80))
    if (r.class_name && r.method_name) {
      console.log(`FILE      : ${r.file_path}`)
      console.log(`CLASS     : ${r.class_name}`)
      console.log(`METHOD    : ${r.method_name}`)
    } else if (r.class_name && !r.method_name) {
      console.log(`FILE      : ${r.file_path}`)
      console.log(`CLASS     : ${r.class_name}`)
    }
    console.log(`LINE      : ${r.start_line} - ${r.end_line}`)
    console.log("-".repeat(80))
    console.log(r.code_snippet)
    console.log()
  }
}

// Listing all classes/methods
function listAll(index, what = "all") {
  const mode = (what || "all").toLowerCase()
  const results = []
  for (const f of index.files) {
    if (mode === "all" || mode === "classes") {
      for (const c of f.classes) {
        results.push({
          file_path: c.file_path,
          class_name: c.name,
          start_line: c.start_line,
          end_line: c.end_line,
          code_snippet: c.code_snippet,
        })
      }
    }
    if (mode === "all" || mode === "methods") {
      for (const c of f.classes) {
        for (const m of c.methods) {
          results.push({
            file_path: c.file_path,
            class_name: c.name,
            method_name: m.name,
            start_line: m.start_line,
            end_line: m.end_line,
            code_snippet: m.code_snippet,
          })
        }
      }
    }
    if (mode === "functions" || mode === "all") {
      for (const fn of f.functions) {
        results.push({
          file_path: fn.file_path,
          method_name: fn.name,
          start_line: fn.start_line,
          end_line: fn.end_line,
          code_snippet: fn.code_snippet,
        })
      }
    }
  }
  return results
}

// Csv Utils
function escapeCSV(val) {
  if (val === undefined || val === null) return '""'
  const s = String(val).replace(/\"/g, '""')
  return '"' + s + '"'
}

function toCSV(rows) {
  const header = [
    "file_path",
    "class_name",
    "method_name",
    "start_line",
    "end_line",
    "code_snippet",
  ]
  const out = [header.join(",")]
  for (const r of rows) {
    const line = [
      escapeCSV(r.file_path || ""),
      escapeCSV(r.class_name || ""),
      escapeCSV(r.method_name || ""),
      r.start_line ?? "",
      r.end_line ?? "",
      escapeCSV(r.code_snippet || ""),
    ].join(",")
    out.push(line)
  }
  return out.join("\n")
}

async function startRepl(index) {
  console.log("Indeks siap. Ketik perintah:")
  console.log("  class <NamaClass>   -> cari class")
  console.log(
    "  method <NamaMethod> -> cari method (termasuk top-level function)"
  )
  console.log("  exit                -> keluar")

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "> ",
  })
  rl.prompt()
  rl.on("line", (line) => {
    const t = line.trim()
    if (!t) return rl.prompt()
    if (t === "exit" || t === "quit") {
      rl.close()
      return
    }
    const [cmd, ...rest] = t.split(/\s+/)
    if (cmd === "class") {
      const name = rest.join(" ").trim()
      printResults(findByClass(index, name))
    } else if (cmd === "method") {
      const name = rest.join(" ").trim()
      printResults(findByMethod(index, name))
    } else {
      console.log(
        "Perintah tidak dikenali. Gunakan: class <Nama> | method <Nama> | exit"
      )
    }
    rl.prompt()
  })
}

function writeCSV(filePath, rows) {
  try {
    fs.writeFileSync(filePath, toCSV(rows), "utf8")
    console.log("CSV disimpan ke", filePath)
  } catch (e) {
    console.error("Gagal menulis CSV:", e.message)
  }
}

function writeJSON(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8")
    console.log("JSON disimpan ke", filePath)
  } catch (e) {
    console.error("Gagal menulis JSON:", e.message)
  }
}

// CLI entrypoint
;(function main() {
  const args = process.argv.slice(2)
  if (!args.length) {
    console.error(
      "Pemakaian: node dart-search-bot.js <rootDirProyek> [--list all|classes|methods|functions | --find class <Nama>|--find method <Nama> | --json <file.json> | --csv <file.csv>]"
    )
    console.error(
      'Catatan: tool ini hanya memindai folder "lib" di dalam root proyek.'
    )
    process.exit(1)
  }

  const projectRoot = args[0]
  if (!fs.existsSync(projectRoot) || !fs.statSync(projectRoot).isDirectory()) {
    console.error("Direktori proyek tidak valid:", projectRoot)
    process.exit(1)
  }

  const libDir = path.join(projectRoot, "lib")
  if (!fs.existsSync(libDir) || !fs.statSync(libDir).isDirectory()) {
    console.error('Direktori "lib" tidak ditemukan di:', projectRoot)
    process.exit(1)
  }

  const flags = args.slice(1)
  const index = indexProject(libDir)

  let resultsForOutput = null

  // --list [all|classes|methods|functions]
  const listIdx = flags.indexOf("--list")
  const listMode =
    listIdx !== -1 && flags[listIdx + 1] && !flags[listIdx + 1].startsWith("--")
      ? flags[listIdx + 1]
      : "all"
  if (listIdx !== -1) {
    resultsForOutput = listAll(index, listMode)
  }

  // --find class <Nama> | --find method <Nama>
  const findIdx = flags.indexOf("--find")
  let findResults = null
  if (findIdx !== -1) {
    const kind = flags[findIdx + 1]
    const name = flags
      .slice(findIdx + 2)
      .join(" ")
      .trim()
    if (!kind || !name) {
      console.error(
        "Format --find salah. Contoh: --find class SplashScreen | --find method build"
      )
      process.exit(1)
    }
    if (kind === "class") {
      findResults = findByClass(index, name)
    } else if (kind === "method") {
      findResults = findByMethod(index, name)
    } else {
      console.error(
        'Jenis --find tidak dikenal. Gunakan "class" atau "method".'
      )
      process.exit(1)
    }
    resultsForOutput = findResults // Prioritaskan hasil find bila ada
  }

  // --csv <file>
  const csvIdx = flags.indexOf("--csv")
  if (csvIdx !== -1 && flags[csvIdx + 1]) {
    const csvOut = flags[csvIdx + 1]
    // Jika belum ada sumber, default ke list all
    if (!resultsForOutput) resultsForOutput = listAll(index, "all")
    writeCSV(csvOut, resultsForOutput)
    // Jika hanya CSV (tanpa --list/--find), selesai di sini
    if (listIdx === -1 && findIdx === -1) return
  }

  // --json <file>
  const jsonIdx = flags.indexOf("--json")
  if (jsonIdx !== -1 && flags[jsonIdx + 1]) {
    const jsonOut = flags[jsonIdx + 1]
    writeJSON(jsonOut, index) // menyimpan indeks penuh
    // Jika hanya JSON (tanpa --list/--find/--csv), selesai di sini
    if (listIdx === -1 && findIdx === -1 && csvIdx === -1) return
  }

  // Jika ada --list tanpa --find, cetak list
  if (listIdx !== -1 && findIdx === -1) {
    printResults(resultsForOutput || listAll(index, listMode))
    return
  }

  // Jika ada --find (dengan/ tanpa CSV), cetak hasil find
  if (findIdx !== -1) {
    printResults(findResults || [])
    return
  }

  startRepl(index)
})()
