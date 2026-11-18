/**
 * 简单自检：网址解包、去重、域名判断。不启动浏览器。
 * 运行：node tests/run.mjs
 */
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const utils = require(path.join(root, "src/shared/utils.js"));

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log("ok  " + name);
}

test("unwrap /url?q= https target", () => {
  const href =
    "https://www.google.com/url?q=https://example.com/page?x=1&sa=U&ved=abc";
  assert.equal(utils.unwrapGoogleUrl(href), "https://example.com/page?x=1");
});

test("unwrap /url?url= https target", () => {
  const href = "https://www.google.com.sg/url?url=https://shop.example/a%20b&sa=t";
  assert.equal(utils.unwrapGoogleUrl(href), "https://shop.example/a%20b");
});

test("unwrap relative /url?q= with a base", () => {
  const href = "/url?q=https://news.example.com/story";
  assert.equal(
    utils.unwrapGoogleUrl(href, "https://www.google.co.jp/search?q=test"),
    "https://news.example.com/story"
  );
});

test("keep a already-clean https url", () => {
  assert.equal(
    utils.unwrapGoogleUrl("https://example.com/ok"),
    "https://example.com/ok"
  );
});

test("reject javascript and non-http wrappers", () => {
  assert.equal(utils.unwrapGoogleUrl("javascript:alert(1)"), null);
  assert.equal(
    utils.unwrapGoogleUrl("https://www.google.com/url?q=javascript:alert(1)"),
    null
  );
  assert.equal(
    utils.unwrapGoogleUrl("https://www.google.com/url?q=data:text/html,hi"),
    null
  );
  assert.equal(utils.unwrapGoogleUrl("https://www.google.com/url?q=not-a-url"), null);
  assert.equal(utils.unwrapGoogleUrl(""), null);
});

test("prefer url= over q= only when url is present; still safe", () => {
  const href =
    "https://www.google.com/url?url=https://real.example/&q=https://other.example/";
  assert.equal(utils.unwrapGoogleUrl(href), "https://real.example/");
});

test("normalize and case-insensitive dedupe, keep first spelling", () => {
  const first = utils.mergeKeywords([], ["Best Coffee", "  best   coffee  "], 1000);
  assert.deepEqual(
    first.list.map((x) => x.text),
    ["Best Coffee"]
  );
  assert.equal(first.added.length, 1);
  const second = utils.mergeKeywords(first.list, ["best coffee", "Espresso"], 2000);
  assert.deepEqual(
    second.list.map((x) => x.text),
    ["Best Coffee", "Espresso"]
  );
  assert.deepEqual(
    second.added.map((x) => x.text),
    ["Espresso"]
  );
  assert.equal(second.list[1].addedAt, 2000);
});

test("skip empty suggestions and chrome footer text", () => {
  const result = utils.mergeKeywords([], [
    "   ",
    "举报不当预测",
    "Report inappropriate predictions",
    "best beans",
  ]);
  // mergeKeywords itself does not skip footer text; isSkippableSuggestion does.
  assert.equal(utils.isSkippableSuggestion("  "), true);
  assert.equal(utils.isSkippableSuggestion("举报不当预测"), true);
  assert.equal(utils.isSkippableSuggestion("Report inappropriate predictions"), true);
  assert.equal(utils.isSkippableSuggestion("best beans"), false);
  const incoming = ["举报不当预测", "best beans"].filter(
    (t) => !utils.isSkippableSuggestion(t)
  );
  const merged = utils.mergeKeywords([], incoming, 1);
  assert.deepEqual(merged.list.map((x) => x.text), ["best beans"]);
});

test("google search hosts include regional domains, exclude other google products", () => {
  for (const host of [
    "www.google.com",
    "google.com",
    "www.google.com.sg",
    "google.com.hk",
    "www.google.co.jp",
    "google.co.uk",
    "ipv6.google.com",
    "GOOGLE.DE",
  ]) {
    assert.equal(utils.isGoogleSearchHost(host), true, host);
  }
  for (const host of [
    "mail.google.com",
    "accounts.google.com",
    "docs.google.com",
    "maps.google.com",
    "www.googleadservices.com",
    "drive.google.com",
    "example.com",
    "",
  ]) {
    assert.equal(utils.isGoogleSearchHost(host), false, host);
  }
});

test("opaque /goto tracker cannot be unwrapped", () => {
  const href =
    "https://www.google.com/goto?url=CAESaQHEIkXX2pk&gsessionid=abc";
  assert.equal(utils.unwrapGoogleUrl(href), null);
  assert.equal(utils.isGoogleClickTracker(href), true);
  assert.equal(
    utils.unwrapGoogleUrl("https://www.google.com/url?q=https://ok.example/x"),
    "https://ok.example/x"
  );
  assert.equal(
    utils.isGoogleClickTracker("https://www.google.com/url?q=https://ok.example/x"),
    true
  );
  assert.equal(utils.isGoogleClickTracker("https://ok.example/x"), false);
});

test("identify google search-query links vs real destinations", () => {
  assert.equal(
    utils.isGoogleSearchQueryUrl("https://www.google.com/search?q=coffee"),
    true
  );
  assert.equal(
    utils.isGoogleSearchQueryUrl("/search?q=coffee", "https://www.google.com.sg/"),
    true
  );
  assert.equal(
    utils.isGoogleSearchQueryUrl("https://www.google.com/chrome/"),
    false
  );
  assert.equal(
    utils.isGoogleSearchQueryUrl("https://support.google.com/websearch"),
    false
  );
  assert.equal(utils.isGoogleSearchQueryUrl("https://example.com/search?q=x"), false);
});

test("keyword and serp export formats", () => {
  const txt = utils.keywordsToTxt([{ text: "alpha" }, { text: "beta" }]);
  assert.equal(txt, "alpha\nbeta");
  const csv = utils.keywordsToCsv([{ text: "a,b", addedAt: Date.parse("2026-11-13T10:00:00+08:00") }]);
  assert.ok(csv.startsWith("\uFEFF"));
  assert.ok(csv.includes('"a,b"'));
  const serpTxt = utils.serpToTxt([
    { type: "organic", url: "https://a.example/" },
    { type: "ad", url: "https://b.example/" },
  ]);
  assert.equal(serpTxt, "https://a.example/\n[广告] https://b.example/");
});


test("split comma-glued or space-glued ad landing pages", () => {
  assert.deepEqual(
    utils.splitUrlCandidates("https://www.quickbase.com/,https://monitor.lunio.ai/"),
    ["https://www.quickbase.com/", "https://monitor.lunio.ai/"]
  );
  assert.deepEqual(
    utils.splitUrlCandidates("https://www.quickbase.com/ https://monitor.lunio.ai/"),
    ["https://www.quickbase.com/", "https://monitor.lunio.ai/"]
  );
  assert.deepEqual(
    utils.splitUrlCandidates("https://example.com/path?x=1"),
    ["https://example.com/path?x=1"]
  );
  assert.deepEqual(utils.splitUrlCandidates("  "), []);
});

test("unwrap must not keep a second url glued into the path", () => {
  const glued = "https://www.quickbase.com/,https://monitor.lunio.ai/";
  const first = utils.splitUrlCandidates(glued)[0];
  assert.equal(utils.unwrapGoogleUrl(first), "https://www.quickbase.com/");
  // The raw glued string is a single URL with a comma in the path; callers must split first.
  const raw = utils.unwrapGoogleUrl(glued);
  assert.equal(raw, "https://www.quickbase.com/,https://monitor.lunio.ai/");
});

test("exported text has one url per line after split-and-pick", () => {
  const items = [
    { type: "ad", url: "https://www.zoho.com/" },
    { type: "ad", url: "https://www.power-crm.net/" },
    { type: "ad", url: "https://www.quickbase.com/" },
    { type: "organic", url: "https://www.hubspot.com/" },
  ];
  const lines = utils.serpToTxt(items).split("\n");
  assert.equal(lines.length, items.length);
  for (const line of lines) {
    assert.equal((line.match(/https?:\/\//g) || []).length, 1, line);
    assert.equal(line.includes(",https://"), false, line);
  }
});

test("shortcut labels use Option on Mac and Alt elsewhere", () => {
  assert.equal(utils.formatShortcut("Alt+Shift+K", "mac"), "Option + Shift + K");
  assert.equal(utils.formatShortcut("Alt+Shift+K", "MacIntel"), "Option + Shift + K");
  for (const platform of ["win", "linux"]) {
    assert.equal(utils.formatShortcut("Alt+Shift+K", platform), "Alt + Shift + K");
  }
  assert.equal(utils.formatShortcut("Alt+Shift+L", "mac"), "Option + Shift + L");
});
test("custom Command and Meta bindings stay Command", () => {
  assert.equal(utils.formatShortcut("Command+Shift+Y", "mac"), "Command + Shift + Y");
  assert.equal(utils.formatShortcut("Meta+Ctrl+L", "mac"), "Command + Ctrl + L");
  assert.equal(utils.formatShortcut("Ctrl+Shift+Y", "win"), "Ctrl + Shift + Y");
});
test("unassigned shortcuts have no invented default", () => {
  for (const shortcut of ["", "  ", null, undefined]) {
    assert.equal(utils.formatShortcut(shortcut, "mac"), "");
  }
});

// Exercise the actual background message handler with changing Chrome bindings.
let messageHandler;
let commandHandler;
let bindings = [{ name: "collect-suggestions", shortcut: "Alt+Shift+K" }];
let failCommands = false;
const sent = [];
vm.runInNewContext(fs.readFileSync(path.join(root, "src/background.js"), "utf8"), {
  chrome: {
    commands: {
      getAll: async () => { if (failCommands) throw new Error("unavailable"); return bindings; },
      onCommand: { addListener: (fn) => { commandHandler = fn; } },
    },
    runtime: {
      getPlatformInfo: async () => ({ os: "mac" }),
      onMessage: { addListener: (fn) => { messageHandler = fn; } },
    },
    tabs: {
      query: (_query, cb) => cb([{ id: 42 }]),
      sendMessage: (id, message, cb) => { sent.push([id, message.type]); cb({ ok: true }); },
    },
  },
});
async function readBindings() {
  return await new Promise((resolve) => {
    assert.equal(messageHandler({ type: "KC_GET_SHORTCUTS" }, {}, resolve), true);
  });
}
assert.equal((await readBindings()).commands[0].shortcut, "Alt+Shift+K");
bindings = [{ name: "collect-suggestions", shortcut: "Command+Shift+Y" }, { name: "copy-serp-urls", shortcut: "" }];
const changed = await readBindings();
assert.equal(changed.commands[0].shortcut, "Command+Shift+Y");
assert.equal(changed.commands[1].shortcut, "");
assert.equal(changed.platform, "mac");
failCommands = true;
assert.equal((await readBindings()).commands.length, 0);
assert.equal(messageHandler({ type: "OTHER" }, {}, () => {}), undefined);
passed += 1;
console.log("ok  background returns fresh bindings and handles API failure");
commandHandler("collect-suggestions");
commandHandler("copy-serp-urls");
commandHandler("unknown");
assert.deepEqual(sent, [[42, "KC_COLLECT_VISIBLE"], [42, "KC_COPY_SERP"]]);
passed += 1;
console.log("ok  original two shortcut actions remain unchanged");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
assert.equal(manifest.version, "0.1.3");
assert.deepEqual(Object.keys(manifest.commands).sort(), ["collect-suggestions", "copy-serp-urls"]);
assert.equal(manifest.commands["collect-suggestions"].suggested_key.default, "Alt+Shift+K");
assert.equal(manifest.commands["copy-serp-urls"].suggested_key.default, "Alt+Shift+L");
passed += 1;
console.log("ok  manifest keeps the original default bindings and two commands");

console.log("\n" + passed + " checks passed");
