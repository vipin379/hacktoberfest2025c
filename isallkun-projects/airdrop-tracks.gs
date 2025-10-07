/***** CONFIG *****/
var AIRBOT = {
  TELEGRAM_TOKEN: "8301496459:AAFqjqcD9co-7Vujg1Kf0PU5FLQcm0aJrGk",
  SHEET_ID: "1WtLiX8CKS_Lidut7F-iO32cSJJ7VpJ33hDv9DusoVFw",
  SHEET_NAME: "Sheet1",
  TIMEZONE: "Asia/Jakarta", // WIB
};

/***** HELPERS *****/
function ok() {
  return ContentService.createTextOutput("ok");
}

function reply(chatId, text) {
  var url = "https://api.telegram.org/bot" + AIRBOT.TELEGRAM_TOKEN + "/sendMessage";
  var payload = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({ chat_id: chatId, text: text }),
  };
  UrlFetchApp.fetch(url, payload);
}

/***** ENTRYPOINT (Telegram webhook) *****/
function doPost(e) {
  var lock = LockService.getScriptLock();

  try {
    var hasLock = lock.tryLock(100);
    if (!hasLock) {
      Logger.log("Skipped duplicate request (locked)");
      return ok();
    }

    if (!e || !e.postData || !e.postData.contents) {
      Logger.log("doPost dipanggil tanpa data valid");
      return ok();
    }

    var bodyObj;
    try {
      bodyObj = JSON.parse(e.postData.contents);
    } catch (_) {
      bodyObj = null;
    }

    // Warmup POST: memaksa scope Spreadsheet agar POST Telegram tidak redirect
    if (bodyObj && bodyObj.init === true) {
      Logger.log("Warmup POST init detected, touching Spreadsheet scope...");
      SpreadsheetApp.openById(AIRBOT.SHEET_ID).getName();
      return ok();
    }

    var update = bodyObj;
    if (!update) {
      Logger.log("Payload bukan JSON Telegram");
      return ok();
    }

    var updateId = update.update_id;
    var cache = CacheService.getScriptCache();
    var cacheKey = "processed_" + updateId;

    if (cache.get(cacheKey)) {
      Logger.log("Skipped duplicate update_id: " + updateId);
      return ok();
    }
    cache.put(cacheKey, "true", 600);

    Logger.log("Processing update_id: " + updateId);

    var msg = update.message || update.edited_message || update.channel_post;
    if (!msg) return ok();

    var text = (msg.text || msg.caption || "").trim();
    if (!text) return ok();

    var chatId = msg.chat.id;

    if (/^\/start(?:@\w+)?\b/i.test(text)) {
      reply(chatId, "Halo! Kirim data airdrop dengan format:\n" + "/airdrop Nama Project | Wallet | Tipe | Status | Link | YYYY-MM-DD\n\n" + "Contoh:\n/airdrop Project X | 0xABC... | Galxe | Pending | https://galxe.com/x | 2025-10-07");
      return ok();
    }

    if (/^\/help(?:@\w+)?\b/i.test(text)) {
      reply(
        chatId,
        "Format input:\n" +
          "/airdrop Nama Project | Wallet | Tipe | Status | Link | YYYY-MM-DD\n\n" +
          "• Tanggal boleh kosong → otomatis hari ini (WIB)\n" +
          "• Link harus diawali http(s)://\n" +
          "Contoh:\n/airdrop Project X | 0xABC... | Galxe | Pending | https://galxe.com/x | 2025-10-07"
      );
      return ok();
    }

    if (/^\/airdrop(?:@\w+)?\b/i.test(text)) {
      var normalized = text
        .replace(/^\/airdrop(?:@\w+)?\s*/i, "")
        .replace(/\n+/g, " ")
        .trim();
      var parsed = parseAirdrop(normalized);
      if (!parsed.ok) {
        reply(chatId, "❌ " + parsed.error + "\n\nKetik /help untuk format.");
        return ok();
      }

      var nama = parsed.data.nama;
      var wallet = parsed.data.wallet;
      var tipe = parsed.data.tipe;
      var status = parsed.data.status;
      var link = parsed.data.link;
      var tanggal = parsed.data.tanggal;

      var sheet = SpreadsheetApp.openById(AIRBOT.SHEET_ID).getSheetByName(AIRBOT.SHEET_NAME);

      if (isDuplicate(sheet, nama, wallet)) {
        reply(chatId, "⚠️ Duplikat terdeteksi:\n• Nama: " + nama + "\n• Wallet: " + wallet + "\n\nData tidak disimpan.");
        return ok();
      }

      sheet.appendRow(["", nama, wallet, tipe, status, link, tanggal]);

      var lastRow = sheet.getLastRow();
      var no = lastRow - 1;

      reply(chatId, "✅ Data airdrop tersimpan\n" + "No: " + no + "\n" + "Nama: " + nama + "\n" + "Wallet: " + wallet + "\n" + "Tipe: " + tipe + "\n" + "Status: " + status + "\n" + "Link: " + link + "\n" + "Tanggal: " + tanggal);
      return ok();
    }

    if (text.indexOf("/") === 0) {
      reply(chatId, "Perintah tidak dikenal. Ketik /help untuk bantuan.");
      return ok();
    }

    return ok();
  } catch (err) {
    Logger.log("doPost error: " + err);
    try {
      if (e && e.postData && e.postData.contents) {
        var u = JSON.parse(e.postData.contents);
        var cid = u && u.message && u.message.chat && u.message.chat.id;
        if (cid) reply(cid, "⚠️ Terjadi error pada server.\n" + err);
      }
    } catch (ignored) {
      Logger.log("Error saat mengirim pesan error: " + ignored);
    }
    return ok();
  } finally {
    if (lock && lock.hasLock()) {
      lock.releaseLock();
    }
  }
}

/***** PARSER & VALIDATOR *****/
function parseAirdrop(raw) {
  var s = String(raw || "");
  var parts0 = s.split("|");
  var parts = [];
  for (var i = 0; i < parts0.length; i++) {
    var t = String(parts0[i] || "").trim();
    if (t) parts.push(t);
  }

  if (parts.length < 5) {
    return { ok: false, error: "Format kurang kolom. Wajib: Nama | Wallet | Tipe | Status | Link | [Tanggal]" };
  }

  if (parts.length === 5) {
    var today = Utilities.formatDate(new Date(), AIRBOT.TIMEZONE, "yyyy-MM-dd");
    parts.push(today);
  }

  var nama = parts[0];
  var wallet = parts[1];
  var tipe = parts[2];
  var status = parts[3];
  var link = parts[4];
  var tanggalRaw = parts[5];

  if (!nama || !wallet || !tipe || !status || !link) {
    return { ok: false, error: "Ada kolom kosong. Pastikan 5 kolom terisi (Nama, Wallet, Tipe, Status, Link)." };
  }
  if (!/^https?:\/\/.+/i.test(link)) {
    return { ok: false, error: "Link tidak valid. Harus diawali http:// atau https://." };
  }

  var tanggal = normalizeDateToISO(tanggalRaw);
  if (!tanggal) {
    return { ok: false, error: "Format tanggal tidak valid. Gunakan YYYY-MM-DD (contoh: 2025-10-07)." };
  }

  return { ok: true, data: { nama: nama, wallet: wallet, tipe: tipe, status: status, link: link, tanggal: tanggal } };
}

function normalizeDateToISO(input) {
  if (!input) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
  var m = input.match(/^(\d{2})[-\/](\d{2})[-\/](\d{4})$/);
  if (m) {
    var dd = m[1],
      mm = m[2],
      yyyy = m[3];
    return yyyy + "-" + mm + "-" + dd;
  }
  var d = new Date(input);
  if (!isNaN(d.getTime())) {
    return Utilities.formatDate(d, AIRBOT.TIMEZONE, "yyyy-MM-dd");
  }
  return null;
}

function isDuplicate(sheet, nama, wallet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;
  var range = sheet.getRange(2, 2, lastRow - 1, 2).getValues();
  for (var i = 0; i < range.length; i++) {
    var namaX = String(range[i][0] || "").trim();
    var walletX = String(range[i][1] || "").trim();
    if (namaX.toLowerCase() === String(nama).toLowerCase() && walletX.toLowerCase() === String(wallet).toLowerCase()) {
      return true;
    }
  }
  return false;
}

/***** UTILITIES *****/
function doGet(e) {
  if (e && e.parameter && e.parameter.init === "1") {
    Logger.log("Warmup GET init detected, touching Spreadsheet scope...");
    SpreadsheetApp.openById(AIRBOT.SHEET_ID).getName();
    return ok();
  }
  return ok();
}

// Warming GET
function warmupDeployment() {
  Logger.log("=== Warming Up Deployment ===\n");
  var DEPLOYMENT_URL = "https://script.google.com/macros/s/AKfycbyqgJ7qB2NQeBCy66frq3fTIzigKrgTqU-dVaj980Ih0ezMZTnoUCcD3mDeXD7WKARH/exec";
  try {
    Logger.log("URL: " + DEPLOYMENT_URL + "\n");
    var pingUrl = DEPLOYMENT_URL + (DEPLOYMENT_URL.indexOf("?") === -1 ? "?t=" : "&t=") + Date.now() + "&init=1";
    var response = UrlFetchApp.fetch(pingUrl, {
      method: "get",
      muteHttpExceptions: true,
      followRedirects: true,
    });
    var code = response.getResponseCode();
    var content = (response.getContentText() || "").trim();
    Logger.log("Response Code: " + code);
    Logger.log("Response Body: " + (content.length > 100 ? content.substring(0, 100) + "..." : content) + "\n");
    if (code === 200 && content.toLowerCase() === "ok") {
      Logger.log("✅ Deployment sudah authorized dengan benar!");
    } else {
      Logger.log("⚠ Response tidak seperti yang diharapkan");
      Logger.log("Expected: 200 + 'ok'");
      Logger.log("Got: " + code + " + '" + content + "'");
    }
  } catch (err) {
    Logger.log("✗ Error: " + err);
  }
}

// Warming POST
function warmupDeploymentPost(url) {
  Logger.log("=== Warmup POST Deployment ===");
  var pingUrl = url + (url.indexOf("?") === -1 ? "?t=" : "&t=") + Date.now();
  var resp = UrlFetchApp.fetch(pingUrl, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({ init: true }),
    muteHttpExceptions: true,
    followRedirects: true,
  });
  var code = resp.getResponseCode();
  var body = (resp.getContentText() || "").trim();
  Logger.log("Warm POST → Code: " + code + ", Body: " + (body.length > 100 ? body.substring(0, 100) + "..." : body));
  return { code: code, body: body };
}

// STEP BY STEP FINAL
function step1_DeleteAllWebhooks() {
  Logger.log("=== STEP 1: Delete All Webhooks ===\n");
  try {
    var url = "https://api.telegram.org/bot" + AIRBOT.TELEGRAM_TOKEN + "/deleteWebhook?drop_pending_updates=true";
    var response = UrlFetchApp.fetch(url);
    Logger.log(response.getContentText());
    Utilities.sleep(3000);
    var infoUrl = "https://api.telegram.org/bot" + AIRBOT.TELEGRAM_TOKEN + "/getWebhookInfo";
    var infoResp = UrlFetchApp.fetch(infoUrl);
    Logger.log("\nWebhook Status:");
    Logger.log(infoResp.getContentText());
    Logger.log("\n✅ STEP 1 DONE!");
  } catch (err) {
    Logger.log("Error: " + err);
  }
}

function step2_CreateFreshDeployment() {
  Logger.log("=== STEP 2: Panduan Create Fresh Deployment ===\n");
  Logger.log("Ikuti langkah ini PERSIS:");
  Logger.log("\n1. Pastikan SEMUA deployment sudah di-archive");
  Logger.log("\n2. Klik: Deploy > New deployment");
  Logger.log("\n3. Klik gear icon ⚙️ > Pilih 'Web app'");
  Logger.log("\n4. Isi form:");
  Logger.log("   - Description: Fresh Bot Deploy");
  Logger.log("   - Execute as: Me (your-email@gmail.com)");
  Logger.log("   - Who has access: Anyone");
  Logger.log("\n5. Klik DEPLOY");
  Logger.log("\n6. COPY URL yang muncul (format: https://script.google.com/macros/s/AK.../exec)");
  Logger.log("\n7. BUKA URL tersebut (login sama), Advanced > Go to..., Allow, tunggu 'ok'");
  Logger.log("\n8. Jalankan: step3_SetWebhookToNewDeployment()");
}

function step3_SetWebhookToNewDeployment() {
  var NEW_DEPLOYMENT_URL = "https://script.google.com/macros/s/AKfycbyqgJ7qB2NQeBCy66frq3fTIzigKrgTqU-dVaj980Ih0ezMZTnoUCcD3mDeXD7WKARH/exec";

  Logger.log("=== STEP 3: Set Webhook to New Deployment ===\n");

  if (!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(NEW_DEPLOYMENT_URL)) {
    Logger.log("❌ ERROR: Format URL salah!");
    return;
  }

  try {
    Logger.log("Deployment URL: " + NEW_DEPLOYMENT_URL);
    Logger.log("\nTesting deployment...");

    var pingUrl = NEW_DEPLOYMENT_URL + (NEW_DEPLOYMENT_URL.indexOf("?") === -1 ? "?t=" : "&t=") + Date.now();
    var testResp = UrlFetchApp.fetch(pingUrl, {
      muteHttpExceptions: true,
      followRedirects: true,
    });
    var code = testResp.getResponseCode();
    var content = (testResp.getContentText() || "").trim();
    Logger.log("Response Code: " + code);
    Logger.log("Response Body: " + (content.length > 100 ? content.substring(0, 100) + "..." : content));
    if (!(code === 200 && content.toLowerCase() === "ok")) {
      Logger.log("\n⚠️ Unexpected response saat test deployment");
      Logger.log("Expected: 200 + 'ok'");
      Logger.log("Got: " + code + " + '" + content + "'");
      return;
    }

    Logger.log("\n✅ Deployment test PASSED!");

    // Warmup GET+POST untuk jalur POST Telegram
    warmupDeployment();
    warmupDeploymentPost(NEW_DEPLOYMENT_URL);

    // Hapus webhook + pending
    var delUrl = "https://api.telegram.org/bot" + AIRBOT.TELEGRAM_TOKEN + "/deleteWebhook?drop_pending_updates=true";
    var delResp = UrlFetchApp.fetch(delUrl);
    Logger.log("DeleteWebhook: " + delResp.getContentText());
    Utilities.sleep(3000);

    // Set webhook ke script.google.com (bukan googleusercontent)
    Logger.log("\nSetting webhook...");
    var setUrl = "https://api.telegram.org/bot" + AIRBOT.TELEGRAM_TOKEN + "/setWebhook";
    var payload = {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({
        url: NEW_DEPLOYMENT_URL,
        max_connections: 1,
      }),
    };
    var setResp = UrlFetchApp.fetch(setUrl, payload);
    Logger.log(setResp.getContentText());
    Utilities.sleep(5000);

    // Cek webhook
    Logger.log("\nChecking webhook status...");
    var infoUrl = "https://api.telegram.org/bot" + AIRBOT.TELEGRAM_TOKEN + "/getWebhookInfo";
    var infoResp = UrlFetchApp.fetch(infoUrl);
    var info = JSON.parse(infoResp.getContentText());
    Logger.log(JSON.stringify(info, null, 2));

    var bad = info.result && (info.result.pending_update_count > 0 || /302|405/i.test(String(info.result.last_error_message || "")));
    if (bad) {
      Logger.log("\n⚙️ Detected 302/405/pending. Auto-fix...");

      // Warm POST lagi
      warmupDeploymentPost(NEW_DEPLOYMENT_URL);

      // Delete + set ulang
      var delResp2 = UrlFetchApp.fetch(delUrl);
      Logger.log("DeleteWebhook (again): " + delResp2.getContentText());
      Utilities.sleep(3000);

      var setResp2 = UrlFetchApp.fetch(setUrl, payload);
      Logger.log("SetWebhook (again): " + setResp2.getContentText());
      Utilities.sleep(5000);

      var infoResp2 = UrlFetchApp.fetch(infoUrl);
      var info2 = JSON.parse(infoResp2.getContentText());
      Logger.log("Re-check:");
      Logger.log(JSON.stringify(info2, null, 2));

      if (info2.result && info2.result.pending_update_count === 0 && !info2.result.last_error_message) {
        Logger.log("\n🎉🎉🎉 SUCCESS! WEBHOOK BERSIH SETELAH AUTO-FIX! 🎉🎉🎉");
      } else {
        Logger.log("\n⚠️ Masih ada pending/error. Buka URL web app di browser (akun sama) sampai tampil 'ok', lalu jalankan STEP 3 lagi.");
      }
    } else {
      Logger.log("\n🎉🎉🎉 SUCCESS! WEBHOOK BERSIH! 🎉🎉🎉");
      Logger.log("\n=== TEST BOT SEKARANG ===");
      Logger.log("Kirim ke bot:");
      Logger.log("1. /start");
      Logger.log("2. /airdrop TestProject | 0xABC123 | Galxe | Pending | https://test.com | 2025-10-07");
    }
  } catch (err) {
    Logger.log("Error: " + err);
  }
}

/***** TESTING *****/
function testDoPost() {
  var CHAT_ID_ANDA = 123456789; // <-- GANTI dengan chat ID Anda

  var mockEvent = {
    postData: {
      contents: JSON.stringify({
        update_id: 123456789,
        message: {
          message_id: 1,
          from: {
            id: CHAT_ID_ANDA,
            is_bot: false,
            first_name: "Test",
            username: "test_user",
          },
          chat: {
            id: CHAT_ID_ANDA,
            first_name: "Test",
            username: "test_user",
            type: "private",
          },
          date: 1640995200,
          text: "/start",
        },
      }),
    },
  };

  Logger.log("Menjalankan simulasi pesan /start...");
  doPost(mockEvent);
  Logger.log("Selesai - cek log dan bot Telegram Anda");
}
