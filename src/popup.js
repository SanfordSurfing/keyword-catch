/**
 * Keyword Catch 工具栏弹窗：和页面里的小面板共用同一份本地列表。
 */
(function () {
  "use strict";

  const U = globalThis.KeywordCatchUtils;
  const els = {
    count: document.getElementById("count"),
    auto: document.getElementById("auto"),
    collect: document.getElementById("collect"),
    serpCopy: document.getElementById("serp-copy"),
    serpTxt: document.getElementById("serp-txt"),
    serpCsv: document.getElementById("serp-csv"),
    toast: document.getElementById("toast"),
    list: document.getElementById("list"),
    copy: document.getElementById("copy"),
    txt: document.getElementById("txt"),
    csv: document.getElementById("csv"),
    clear: document.getElementById("clear"),
  };

  let keywords = [];
  let autoCollectEnabled = true;
  let toastTimer = 0;

  function showToast(message, kind) {
    els.toast.hidden = false;
    els.toast.className = "toast" + (kind === "error" ? " is-error" : "");
    els.toast.textContent = message;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      els.toast.hidden = true;
    }, 3200);
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderList(justAddedKeys) {
    els.count.textContent = String(keywords.length);
    const added = justAddedKeys ? new Set(justAddedKeys) : new Set();
    if (!keywords.length) {
      els.list.innerHTML =
        '<li class="empty">还没有收集到关键词。请打开 Google 搜索页，点开搜索框后，建议出现就会自动收集；也可以按「收集当前建议」。</li>';
      return;
    }
    els.list.innerHTML = keywords
      .slice()
      .reverse()
      .map(function (item) {
        const isNew = added.has(U.keywordKey(item.text));
        return '<li class="item' + (isNew ? " is-new" : "") + '">' + escapeHtml(item.text) + "</li>";
      })
      .join("");
  }


  async function refreshShortcuts() {
    let commands = [];
    let platform = "";
    try {
      const results = await Promise.all([chrome.commands.getAll(), chrome.runtime.getPlatformInfo()]);
      commands = results[0];
      platform = results[1].os;
    } catch (err) {
      // Missing bindings or API failures must not affect button actions.
    }
    const scope = document;
    if (!scope) return;
    scope.querySelectorAll("[data-command]").forEach(function (label) {
      const command = commands.find(function (item) { return item.name === label.dataset.command; });
      const text = U.formatShortcut(command && command.shortcut, platform);
      if (label.textContent !== text) label.textContent = text;
      label.hidden = !text;
    });
  }
  window.addEventListener("focus", refreshShortcuts);
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) refreshShortcuts();
  });

  async function loadState() {
    const state = await chrome.storage.local.get({
      keywords: [],
      autoCollect: true,
    });
    keywords = Array.isArray(state.keywords) ? state.keywords : [];
    autoCollectEnabled = state.autoCollect !== false;
    els.auto.checked = autoCollectEnabled;
    renderList();
  }

  function filename(kind, ext) {
    const d = new Date();
    const pad = function (n) { return String(n).padStart(2, "0"); };
    const stamp =
      d.getFullYear() +
      pad(d.getMonth() + 1) +
      pad(d.getDate()) +
      "-" +
      pad(d.getHours()) +
      pad(d.getMinutes());
    return "keyword-catch-" + kind + "-" + stamp + "." + ext;
  }

  function downloadText(name, text, mime) {
    const blob = new Blob([text], { type: mime || "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      try {
        const area = document.createElement("textarea");
        area.value = text;
        document.body.appendChild(area);
        area.select();
        const ok = document.execCommand("copy");
        area.remove();
        return ok;
      } catch (err2) {
        return false;
      }
    }
  }

  function summarizeSerp(items) {
    const organic = items.filter(function (item) { return item.type !== "ad"; }).length;
    const ads = items.filter(function (item) { return item.type === "ad"; }).length;
    const parts = [];
    if (organic) parts.push(organic + " 条搜索结果");
    if (ads) parts.push(ads + " 条广告");
    return parts.join("，") || "0 条";
  }

  async function getActiveTab() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs && tabs[0] ? tabs[0] : null;
  }

  async function sendToActiveTab(message) {
    const tab = await getActiveTab();
    if (!tab || tab.id == null) {
      throw new Error("no-tab");
    }
    try {
      return await chrome.tabs.sendMessage(tab.id, message);
    } catch (err) {
      throw new Error("no-content");
    }
  }

  async function handleCollect() {
    try {
      const result = await sendToActiveTab({ type: "KC_COLLECT_VISIBLE" });
      await loadState();
      if (result && result.ok) {
        showToast("已在当前搜索页收集建议，现在共 " + keywords.length + " 个词");
      }
    } catch (err) {
      showToast("当前页不是 Google 搜索页，或插件还没有加载完成。请先打开 google.com 再试。", "error");
    }
  }

  async function handleSerp(action) {
    let result;
    try {
      result = await sendToActiveTab({ type: "KC_GET_SERP" });
    } catch (err) {
      showToast("当前页不是 Google 搜索页，或插件还没有加载完成。请先打开一个搜索结果页再试。", "error");
      return;
    }
    if (!result || result.error) {
      showToast((result && result.error) || "没有读到网址。", "error");
      return;
    }
    const items = result.items || [];
    const summary = "已读到 " + summarizeSerp(items);
    if (action === "copy") {
      const ok = await copyText(U.serpToTxt(items));
      showToast(ok ? summary + "，并已复制网址" : summary + "，但复制失败，请改用下载。", ok ? "" : "error");
    } else if (action === "csv") {
      downloadText(filename("网址", "csv"), U.serpToCsv(items), "text/csv;charset=utf-8");
      showToast(summary + "，已开始下载表格");
    } else {
      downloadText(filename("网址", "txt"), U.serpToTxt(items), "text/plain;charset=utf-8");
      showToast(summary + "，已开始下载文本");
    }
  }

  async function handleCopyKeywords() {
    if (!keywords.length) {
      showToast("列表是空的，先收集一些建议再复制。", "error");
      return;
    }
    const ok = await copyText(U.keywordsToTxt(keywords));
    showToast(ok ? "已复制 " + keywords.length + " 个关键词" : "复制失败，请改用导出。", ok ? "" : "error");
  }

  function handleExportKeywords(kind) {
    if (!keywords.length) {
      showToast("列表是空的，先收集一些建议再导出。", "error");
      return;
    }
    if (kind === "csv") {
      downloadText(filename("关键词", "csv"), U.keywordsToCsv(keywords), "text/csv;charset=utf-8");
    } else {
      downloadText(filename("关键词", "txt"), U.keywordsToTxt(keywords), "text/plain;charset=utf-8");
    }
    showToast("已开始下载");
  }

  async function handleClear() {
    if (!keywords.length) {
      showToast("列表已经是空的。");
      return;
    }
    const ok = window.confirm("确定清空已收集的 " + keywords.length + " 个关键词？此操作不能撤销。");
    if (!ok) return;
    keywords = [];
    await chrome.storage.local.set({ keywords: [] });
    renderList();
    showToast("已清空关键词列表");
  }

  els.auto.addEventListener("change", function () {
    autoCollectEnabled = els.auto.checked;
    chrome.storage.local.set({ autoCollect: autoCollectEnabled });
    showToast(autoCollectEnabled ? "已打开自动收集" : "已关闭自动收集。仍可手动点「收集当前建议」。");
  });
  els.collect.addEventListener("click", handleCollect);
  els.serpCopy.addEventListener("click", function () { handleSerp("copy"); });
  els.serpTxt.addEventListener("click", function () { handleSerp("txt"); });
  els.serpCsv.addEventListener("click", function () { handleSerp("csv"); });
  els.copy.addEventListener("click", handleCopyKeywords);
  els.txt.addEventListener("click", function () { handleExportKeywords("txt"); });
  els.csv.addEventListener("click", function () { handleExportKeywords("csv"); });
  els.clear.addEventListener("click", handleClear);

  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area !== "local") return;
    if (changes.keywords) {
      const prev = new Set(keywords.map(function (item) { return U.keywordKey(item.text); }));
      keywords = Array.isArray(changes.keywords.newValue) ? changes.keywords.newValue : [];
      const added = keywords
        .map(function (item) { return U.keywordKey(item.text); })
        .filter(function (key) { return !prev.has(key); });
      renderList(added);
    }
    if (changes.autoCollect) {
      autoCollectEnabled = changes.autoCollect.newValue !== false;
      els.auto.checked = autoCollectEnabled;
    }
  });

  loadState();
  refreshShortcuts();
})();
