/**
 * Keyword Catch — 只在当前这个 Google 搜索页上工作。
 * 收集用户已经看到的搜索建议，导出当前结果页里的网址。
 * 不会移动搜索框里的光标，也不会在后台自动搜索或批量抓取。
 */
(function () {
  "use strict";

  const U = globalThis.KeywordCatchUtils;
  if (!U) return;
  if (!U.isGoogleSearchHost(location.hostname) || !isGoogleSearchPath(location.pathname)) {
    return;
  }

  const HOST_ID = "keyword-catch-root";
  let panelCssText = "";
  /** 这些选择器在 Google 改版后可能失效，失败时要在面板里明确提示，不要悄悄没反应。 */
  const SEARCH_BOX_SELECTORS = [
    'textarea[name="q"]',
    'input[name="q"]',
    '[role="combobox"][name="q"]',
    'form[role="search"] textarea',
    'form[action="/search"] textarea',
    'form[action="/search"] input[name="q"]',
  ];

  // 建议下拉：先用无障碍角色，再用多年来常见的 class（后者更易因改版失效）。
  const SUGGESTION_ITEM_SELECTORS = [
    '[role="option"]',
    "li.sbct",
    "div.sbct",
    ".wM6W7d",
  ];

  const SERP_ROOT_SELECTORS = "#center_col, #search, #rso, #tads, #tadsb, #main";
  const AD_CONTAINER_SELECTORS = "#tads, #tadsb, #tvcap, #taw, [data-text-ad], .commercial-unit-desktop-top, .commercial-unit-desktop-rhs";
  const PAA_SELECTORS = '.related-question-pair, [data-initq], div[jsname="Cpkphb"]';

  let shadow = null;
  let els = {};
  let autoCollectEnabled = true;
  let keywords = [];
  let lastDropdownSignature = "";
  let toastTimer = 0;
  let collectTimer = 0;

  function isGoogleSearchPath(pathname) {
    return (
      pathname === "/" ||
      pathname === "/webhp" ||
      pathname === "/imghp" ||
      pathname === "/search" ||
      pathname.startsWith("/search")
    );
  }

  function $(id) {
    return els[id] || (shadow ? shadow.getElementById(id) : null);
  }


  async function refreshShortcuts() {
    let commands = [];
    let platform = "";
    try {
      const result = await chrome.runtime.sendMessage({ type: "KC_GET_SHORTCUTS" });
      commands = (result && result.commands) || [];
      platform = (result && result.platform) || "";
    } catch (err) {
      // Missing bindings or API failures must not affect button actions.
    }
    const scope = shadow;
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

  function loadState() {
    return chrome.storage.local.get({
      keywords: [],
      autoCollect: true,
      panelState: { minimized: false, left: null, top: null },
    });
  }

  function saveKeywords(list) {
    return chrome.storage.local.set({ keywords: list });
  }

  function saveAutoCollect(value) {
    return chrome.storage.local.set({ autoCollect: value });
  }

  function savePanelState(state) {
    return chrome.storage.local.set({ panelState: state });
  }

  function getSearchBox() {
    for (const selector of SEARCH_BOX_SELECTORS) {
      const node = document.querySelector(selector);
      if (node) return node;
    }
    return null;
  }

  function isRendered(node) {
    if (!node || !(node instanceof Element)) return false;
    const style = window.getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
      return false;
    }
    const rect = node.getBoundingClientRect();
    return rect.width > 8 && rect.height > 8;
  }

  function findSuggestionList() {
    const lists = Array.from(document.querySelectorAll('[role="listbox"]'));
    const box = getSearchBox();
    const visible = lists.filter(isRendered);
    if (box && visible.length) {
      const br = box.getBoundingClientRect();
      const near = visible.filter(function (list) {
        const lr = list.getBoundingClientRect();
        return lr.top >= br.top - 12 && Math.abs(lr.left - br.left) < 480;
      });
      if (near.length) return near[0];
    }
    if (visible.length) return visible[0];

    // 没有 listbox 时，退回常见容器 class。改版后可能失效。
    const fallbacks = Array.from(
      document.querySelectorAll(".aajZCb, .UUbT9, .OBMEnb, ul.G43f7e")
    ).filter(isRendered);
    return fallbacks[0] || null;
  }

  function readSuggestionText(node) {
    const preferred = node.querySelector(".wM6W7d, .sbl1, .ZRod5b");
    const source = preferred || node;
    let text = (source.innerText || source.textContent || "").trim();
    text = text.split(/\n+/)[0] || "";
    text = text.replace(/\s*(删除|移除|刪除|Remove|Delete)\s*$/i, "");
    return U.normalizeKeyword(text);
  }

  function collectVisibleSuggestions() {
    const list = findSuggestionList();
    if (!list) {
      return { status: "hidden", items: [], node: null };
    }
    let nodes = [];
    for (const selector of SUGGESTION_ITEM_SELECTORS) {
      nodes = Array.from(list.querySelectorAll(selector));
      if (nodes.length) break;
    }
    if (!nodes.length && list.matches && list.matches('[role="option"], li, .sbct')) {
      nodes = [list];
    }
    const seen = new Set();
    const items = [];
    for (const node of nodes) {
      if (node.closest && node.closest("#" + HOST_ID)) continue;
      const text = readSuggestionText(node);
      if (!text || U.isSkippableSuggestion(text)) continue;
      const key = U.keywordKey(text);
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(text);
    }
    if (!items.length) return { status: "empty", items: [], node: list };
    return { status: "ok", items: items, node: list };
  }

  function isInsideAd(node) {
    if (!node || !node.closest) return false;
    if (node.closest(AD_CONTAINER_SELECTORS)) return true;
    const labeled = node.closest("[aria-label]");
    if (labeled) {
      const label = labeled.getAttribute("aria-label") || "";
      if (/(^|\s)(ads?|advert|sponsored|广告|廣告|贊助|赞助|anzeigen?|annonces?|annunci|広告)(\s|$)/i.test(label)) {
        return true;
      }
    }
    const block = node.closest("div");
    if (block) {
      const badge = (block.innerText || "").slice(0, 80);
      if (/(^|\n|\s)(广告|廣告|Sponsored|Ad)(\s|\n|$)/.test(badge) && node.closest("#tads, #tadsb, #tvcap, #taw, [data-text-ad]")) {
        return true;
      }
    }
    return false;
  }

  function isInsidePeopleAlsoAsk(node) {
    return !!(node && node.closest && node.closest(PAA_SELECTORS));
  }

  function isInsideOurPanel(node) {
    return !!(node && (node.closest("#" + HOST_ID) || (shadow && shadow.contains(node))));
  }

  function citeToUrl(cite) {
    if (!cite) return null;
    const dtld = cite.getAttribute && cite.getAttribute("data-dtld");
    const raw = U.normalizeKeyword(dtld || cite.innerText || cite.textContent || "");
    if (!raw) return null;
    if (/^https?:\/\//i.test(raw)) {
      const first = U.splitUrlCandidates(raw)[0] || raw.split(/\s+/)[0];
      const unwrapped = U.unwrapGoogleUrl(first, location.href);
      if (unwrapped && !U.isGoogleClickTracker(unwrapped, location.href) && !U.isGoogleSearchQueryUrl(unwrapped, location.href)) {
        return unwrapped;
      }
    }
    const domain = (U.splitUrlCandidates(raw)[0] || raw.split(/\s+/)[0]).replace(/^https?:\/\//i, "").replace(/[\/,].*$/, "").replace(/^[\/]+/, "");
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) return null;
    if (U.isGoogleSearchHost(domain)) return null;
    return "https://" + domain;
  }

  function readCiteFallback(anchor) {
    let node = anchor;
    for (let i = 0; i < 14 && node && node.querySelector; i++) {
      const cite = i === 0 ? null : node.querySelector("cite, [data-dtld]");
      const found = citeToUrl(cite);
      if (found) return found;
      if (node.id === "rso" || node.id === "center_col" || node === document.body || node === document.documentElement) break;
      node = node.parentElement;
    }
    return null;
  }

  function readPingOrDataUrl(anchor) {
    const values = [];
    if (anchor.getAttribute("ping")) values.push.apply(values, U.splitUrlCandidates(anchor.getAttribute("ping")));
    let node = anchor;
    for (let i = 0; i < 8 && node && node.getAttribute; i++) {
      ["data-href", "data-url", "data-lpage", "data-pcu"].forEach(function (attr) {
        const v = node.getAttribute(attr);
        if (v) values.push.apply(values, U.splitUrlCandidates(v));
      });
      node = node.parentElement;
    }
    for (let i = 0; i < values.length; i++) {
      const unwrapped = U.unwrapGoogleUrl(values[i], location.href);
      if (unwrapped && !U.isGoogleClickTracker(unwrapped, location.href) && !U.isGoogleSearchQueryUrl(unwrapped, location.href)) {
        return unwrapped;
      }
    }
    return null;
  }

  function readOrganicDestination(anchor) {
    const href = U.unwrapGoogleUrl(anchor.href, location.href);
    if (href && !U.isGoogleClickTracker(href, location.href) && !U.isGoogleSearchQueryUrl(href, location.href)) {
      return href;
    }
    return readPingOrDataUrl(anchor) || readCiteFallback(anchor);
  }

  function readAdDestination(anchor) {
    const holders = [anchor, anchor.closest("[data-pcu]"), anchor.closest("[data-rw]")];
    for (const holder of holders) {
      if (!holder) continue;
      const pcu = holder.getAttribute("data-pcu");
      if (pcu) {
        const parts = U.splitUrlCandidates(pcu);
        for (let i = 0; i < parts.length; i++) {
          const unwrapped = U.unwrapGoogleUrl(parts[i], location.href);
          if (unwrapped && !U.isGoogleSearchQueryUrl(unwrapped, location.href) && !U.isGoogleClickTracker(unwrapped, location.href)) {
            return unwrapped;
          }
        }
        for (let i = 0; i < parts.length; i++) {
          const unwrapped = U.unwrapGoogleUrl(parts[i], location.href);
          if (unwrapped && !U.isGoogleSearchQueryUrl(unwrapped, location.href)) return unwrapped;
        }
      }
    }
    return readOrganicDestination(anchor);
  }

  function isTitleLink(anchor) {
    if (!anchor) return false;
    if (anchor.querySelector("h3, [role='heading']")) return true;
    if (anchor.closest("h3")) return true;
    return false;
  }

  /**
   * 从当前结果页读取主结果网址（带标题的主链接），广告单独标注。
   * 不发明排名分数；序号只是这一页上的出现顺序。
   * 主栏选择器在 Google 改版后可能失效。
   */
  function extractSerp() {
    const root = document.querySelector(SERP_ROOT_SELECTORS);
    if (!root) {
      const onResultsPath = location.pathname === "/search" || location.pathname.startsWith("/search");
      return {
        items: [],
        error: onResultsPath
          ? "当前页面没有找到搜索结果区域。可能是 Google 页面结构有变化，或结果还没有加载完成。"
          : "当前不是搜索结果页。请先在 Google 搜索一个词，等到出现结果后再导出网址。",
      };
    }

    const anchors = Array.from(root.querySelectorAll("a[href]"));
    const items = [];
    const seen = new Set();

    for (const anchor of anchors) {
      if (isInsideOurPanel(anchor)) continue;
      if (isInsidePeopleAlsoAsk(anchor)) continue;
      if (!isTitleLink(anchor)) continue;
      if (!isRendered(anchor) && !isRendered(anchor.querySelector("h3, [role='heading']") || anchor)) {
        continue;
      }

      const ad = isInsideAd(anchor);
      const href = ad ? readAdDestination(anchor) : readOrganicDestination(anchor);
      if (!href) continue;
      if (U.isGoogleSearchQueryUrl(href, location.href)) continue;
      if (U.isGoogleClickTracker(href, location.href)) continue;

      const key = href.replace(/\/+$/, "");
      if (seen.has(key)) continue;
      seen.add(key);

      const heading = anchor.querySelector("h3, [role='heading']") || anchor.closest("h3");
      const title = U.normalizeKeyword((heading && (heading.innerText || heading.textContent)) || "");
      items.push({
        type: ad ? "ad" : "organic",
        title: title,
        url: href,
      });
    }

    if (!items.length) {
      return {
        items: [],
        error: "在当前结果页里没有读到可导出的网址。可能是这一页还没有结果，或 Google 页面结构有变化。",
      };
    }
    return { items: items, error: null };
  }

  function summarizeSerp(items) {
    const organic = items.filter(function (item) { return item.type !== "ad"; }).length;
    const ads = items.filter(function (item) { return item.type === "ad"; }).length;
    const parts = [];
    if (organic) parts.push(organic + " 条搜索结果");
    if (ads) parts.push(ads + " 条广告");
    return parts.join("，") || "0 条";
  }

  async function addKeywords(incoming, source) {
    const result = U.mergeKeywords(keywords, incoming);
    if (!result.added.length) return result;
    keywords = result.list;
    await saveKeywords(keywords);
    renderList(result.added.map(function (item) { return U.keywordKey(item.text); }));
    if (source === "auto") {
      showToast("已自动收集 " + result.added.length + " 个新词，当前共 " + keywords.length + " 个");
    }
    return result;
  }

  function maybeAutoCollect() {
    if (!autoCollectEnabled) return;
    const found = collectVisibleSuggestions();
    if (found.status !== "ok") {
      if (found.status === "hidden") lastDropdownSignature = "";
      return;
    }
    const signature = found.items.join("\n");
    if (signature === lastDropdownSignature) return;
    lastDropdownSignature = signature;
    addKeywords(found.items, "auto");
  }

  function scheduleAutoCollect() {
    clearTimeout(collectTimer);
    collectTimer = setTimeout(maybeAutoCollect, 160);
  }

  function showToast(message, kind) {
    const toast = $("kc-toast");
    if (!toast) return;
    toast.hidden = false;
    toast.className = "kc-toast" + (kind === "error" ? " is-error" : "");
    toast.textContent = message;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toast.hidden = true;
    }, 3200);
  }

  function renderCount() {
    const count = $("kc-count");
    if (count) count.textContent = String(keywords.length);
  }

  function renderList(justAddedKeys) {
    const list = $("kc-list");
    if (!list) return;
    renderCount();
    const added = justAddedKeys ? new Set(justAddedKeys) : new Set();
    if (!keywords.length) {
      list.innerHTML = '<li class="kc-empty">还没有收集到关键词。点开搜索框，等建议出现后即可自动收集，也可以按「收集当前建议」。</li>';
      return;
    }
    const slice = keywords.slice().reverse();
    list.innerHTML = slice
      .map(function (item) {
        const isNew = added.has(U.keywordKey(item.text));
        const safe = escapeHtml(item.text);
        return '<li class="kc-item' + (isNew ? " is-new" : "") + '"><span>' + safe + "</span></li>";
      })
      .join("");
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function setMinimized(minimized) {
    const panel = $("kc-panel");
    if (!panel) return;
    panel.classList.toggle("is-min", !!minimized);
    const btn = $("kc-min");
    if (btn) {
      btn.textContent = minimized ? "展开" : "收起";
      btn.setAttribute("aria-label", minimized ? "展开 Keyword Catch" : "收起 Keyword Catch");
    }
  }

  async function handleCollectClick() {
    const found = collectVisibleSuggestions();
    if (found.status === "hidden") {
      showToast("请先点开搜索框，等下拉建议出现后再收集。", "error");
      return;
    }
    if (found.status === "empty") {
      showToast("看到了下拉列表，但没能读出建议。可能是 Google 页面结构有变化。", "error");
      return;
    }
    lastDropdownSignature = found.items.join("\n");
    const result = await addKeywords(found.items, "manual");
    if (!result.added.length) {
      showToast("这些建议已经在列表里了，当前共 " + keywords.length + " 个");
    } else {
      showToast("已收集 " + result.added.length + " 个新词，当前共 " + keywords.length + " 个");
    }
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
    a.rel = "noopener";
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
        area.style.position = "fixed";
        area.style.left = "-9999px";
        document.documentElement.appendChild(area);
        area.select();
        const ok = document.execCommand("copy");
        area.remove();
        return ok;
      } catch (err2) {
        return false;
      }
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
    lastDropdownSignature = "";
    await saveKeywords(keywords);
    renderList();
    showToast("已清空关键词列表");
  }

  async function handleExportSerp(action) {
    const result = extractSerp();
    if (result.error) {
      showToast(result.error, "error");
      return result;
    }
    const items = result.items;
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
    return result;
  }

  function bindPanelEvents() {
    $("kc-collect").addEventListener("click", function (event) {
      event.preventDefault();
      handleCollectClick();
    });
    $("kc-serp-copy").addEventListener("click", function (event) {
      event.preventDefault();
      handleExportSerp("copy");
    });
    $("kc-serp-txt").addEventListener("click", function (event) {
      event.preventDefault();
      handleExportSerp("txt");
    });
    $("kc-serp-csv").addEventListener("click", function (event) {
      event.preventDefault();
      handleExportSerp("csv");
    });
    $("kc-copy").addEventListener("click", function (event) {
      event.preventDefault();
      handleCopyKeywords();
    });
    $("kc-txt").addEventListener("click", function (event) {
      event.preventDefault();
      handleExportKeywords("txt");
    });
    $("kc-csv").addEventListener("click", function (event) {
      event.preventDefault();
      handleExportKeywords("csv");
    });
    $("kc-clear").addEventListener("click", function (event) {
      event.preventDefault();
      handleClear();
    });
    $("kc-auto").addEventListener("change", function (event) {
      autoCollectEnabled = event.target.checked;
      saveAutoCollect(autoCollectEnabled);
      if (autoCollectEnabled) {
        lastDropdownSignature = "";
        scheduleAutoCollect();
        showToast("已打开自动收集");
      } else {
        showToast("已关闭自动收集。仍可手动点「收集当前建议」。");
      }
    });
    $("kc-min").addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      const panel = $("kc-panel");
      const next = !panel.classList.contains("is-min");
      setMinimized(next);
      loadState().then(function (state) {
        const panelState = Object.assign({}, state.panelState, { minimized: next });
        savePanelState(panelState);
      });
    });
    enableDrag($("kc-drag"), $("kc-panel"));
  }

  function enableDrag(handle, panel) {
    if (!handle || !panel) return;
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let origLeft = 0;
    let origTop = 0;

    handle.addEventListener("pointerdown", function (event) {
      if (event.target && event.target.closest("button")) return;
      const rect = panel.getBoundingClientRect();
      dragging = true;
      startX = event.clientX;
      startY = event.clientY;
      origLeft = rect.left;
      origTop = rect.top;
      panel.style.right = "auto";
      panel.style.bottom = "auto";
      panel.style.left = origLeft + "px";
      panel.style.top = origTop + "px";
      handle.setPointerCapture(event.pointerId);
    });

    handle.addEventListener("pointermove", function (event) {
      if (!dragging) return;
      const maxLeft = Math.max(8, window.innerWidth - panel.offsetWidth - 8);
      const maxTop = Math.max(8, window.innerHeight - panel.offsetHeight - 8);
      const left = Math.min(maxLeft, Math.max(8, origLeft + (event.clientX - startX)));
      const top = Math.min(maxTop, Math.max(8, origTop + (event.clientY - startY)));
      panel.style.left = left + "px";
      panel.style.top = top + "px";
    });

    function endDrag(event) {
      if (!dragging) return;
      dragging = false;
      try { handle.releasePointerCapture(event.pointerId); } catch (err) {}
      const left = parseFloat(panel.style.left);
      const top = parseFloat(panel.style.top);
      loadState().then(function (state) {
        savePanelState(Object.assign({}, state.panelState, { left: left, top: top }));
      });
    }
    handle.addEventListener("pointerup", endDrag);
    handle.addEventListener("pointercancel", endDrag);
  }

  function applyPanelPosition(panel, state) {
    if (!panel || !state) return;
    if (typeof state.left === "number" && typeof state.top === "number") {
      const maxLeft = Math.max(8, window.innerWidth - panel.offsetWidth - 8);
      const maxTop = Math.max(8, window.innerHeight - panel.offsetHeight - 8);
      panel.style.right = "auto";
      panel.style.bottom = "auto";
      panel.style.left = Math.min(maxLeft, Math.max(8, state.left)) + "px";
      panel.style.top = Math.min(maxTop, Math.max(8, state.top)) + "px";
    }
  }

  function panelTemplate() {
    return (
      '<div id="kc-panel" class="kc-panel" role="dialog" aria-label="Keyword Catch 关键词收集">' +
        '<div class="kc-header" id="kc-drag">' +
          '<div class="kc-title">' +
            '<span class="kc-name">Keyword Catch</span>' +
            '<span class="kc-count" id="kc-count">0</span>' +
          "</div>" +
          '<button type="button" class="kc-icon-btn" id="kc-min" aria-label="收起 Keyword Catch">收起</button>' +
        "</div>" +
        '<div class="kc-body">' +
          '<label class="kc-toggle"><input type="checkbox" id="kc-auto" checked> 自动收集建议</label>' +
          '<div class="kc-actions">' +
            '<button type="button" class="kc-btn kc-btn-primary" id="kc-collect"><span>收集当前建议</span><kbd class="kc-shortcut" data-command="collect-suggestions" hidden></kbd></button>' +
          "</div>" +
          '<div class="kc-actions kc-actions-serp">' +
            '<button type="button" class="kc-btn" id="kc-serp-copy"><span>复制本页网址</span><kbd class="kc-shortcut" data-command="copy-serp-urls" hidden></kbd></button>' +
            '<button type="button" class="kc-btn" id="kc-serp-txt">下载 TXT</button>' +
            '<button type="button" class="kc-btn" id="kc-serp-csv">下载 CSV</button>' +
          "</div>" +
          '<div id="kc-toast" class="kc-toast" hidden></div>' +
          '<ul id="kc-list" class="kc-list"></ul>' +
          '<div class="kc-footer">' +
            '<button type="button" class="kc-btn" id="kc-copy">复制词</button>' +
            '<button type="button" class="kc-btn" id="kc-txt">词 TXT</button>' +
            '<button type="button" class="kc-btn" id="kc-csv">词 CSV</button>' +
            '<button type="button" class="kc-btn kc-btn-danger" id="kc-clear">清空</button>' +
          "</div>" +
        "</div>" +
      "</div>"
    );
  }

  let mounting = false;

  async function mountPanel() {
    if (document.getElementById(HOST_ID) || mounting) return;
    mounting = true;
    try {
      const state = await loadState();
      keywords = Array.isArray(state.keywords) ? state.keywords : [];
      autoCollectEnabled = state.autoCollect !== false;

      const host = document.createElement("div");
      host.id = HOST_ID;
      host.setAttribute("data-keyword-catch", "1");
      host.setAttribute("popover", "manual");
      host.style.cssText = "position:fixed;inset:auto;right:0;bottom:0;margin:0;border:none;padding:0;background:transparent;overflow:visible;z-index:2147483647;";
      document.documentElement.appendChild(host);
      shadow = host.attachShadow({ mode: "open" });

      if (!panelCssText) {
        try {
          const res = await fetch(chrome.runtime.getURL("src/panel.css"));
          panelCssText = await res.text();
        } catch (err) {
          panelCssText = "";
        }
      }
      const style = document.createElement("style");
      style.textContent = panelCssText;
      shadow.appendChild(style);
      const wrap = document.createElement("div");
      wrap.innerHTML = panelTemplate();
      shadow.appendChild(wrap);

      els = {
        "kc-panel": shadow.getElementById("kc-panel"),
        "kc-drag": shadow.getElementById("kc-drag"),
        "kc-count": shadow.getElementById("kc-count"),
        "kc-min": shadow.getElementById("kc-min"),
        "kc-auto": shadow.getElementById("kc-auto"),
        "kc-collect": shadow.getElementById("kc-collect"),
        "kc-serp-copy": shadow.getElementById("kc-serp-copy"),
        "kc-serp-txt": shadow.getElementById("kc-serp-txt"),
        "kc-serp-csv": shadow.getElementById("kc-serp-csv"),
        "kc-toast": shadow.getElementById("kc-toast"),
        "kc-list": shadow.getElementById("kc-list"),
        "kc-copy": shadow.getElementById("kc-copy"),
        "kc-txt": shadow.getElementById("kc-txt"),
        "kc-csv": shadow.getElementById("kc-csv"),
        "kc-clear": shadow.getElementById("kc-clear"),
      };

      $("kc-auto").checked = autoCollectEnabled;
      setMinimized(!!(state.panelState && state.panelState.minimized));
      applyPanelPosition($("kc-panel"), state.panelState);
      bindPanelEvents();
      refreshShortcuts();
      renderList();
      keepPanelOnTop(host);
    } finally {
      mounting = false;
    }
  }

  function keepPanelOnTop(host) {
    function raise() {
      if (!host.isConnected) return;
      if (host.parentElement !== document.documentElement) {
        document.documentElement.appendChild(host);
      } else if (host.nextSibling) {
        document.documentElement.appendChild(host);
      }
      if (typeof host.showPopover === "function") {
        try {
          if (!host.matches(":popover-open")) host.showPopover();
        } catch (err) {}
      }
    }
    raise();
    host.addEventListener("toggle", function (event) {
      if (event.newState === "closed") {
        setTimeout(raise, 0);
      }
    });
    if (!keepPanelOnTop._timer) {
      keepPanelOnTop._timer = setInterval(function () {
        const current = document.getElementById(HOST_ID);
        if (current) keepPanelOnTop(current);
      }, 2000);
    }
  }

  function observePage() {
    const observer = new MutationObserver(function () {
      if (!document.getElementById(HOST_ID)) {
        mountPanel();
      }
      scheduleAutoCollect();
    });
    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
    });
    document.addEventListener(
      "keyup",
      function (event) {
        const box = getSearchBox();
        if (box && event.target === box) scheduleAutoCollect();
      },
      true
    );
    document.addEventListener(
      "click",
      function () {
        scheduleAutoCollect();
      },
      true
    );
    window.addEventListener("focus", scheduleAutoCollect);
  }

  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area !== "local") return;
    if (changes.keywords) {
      keywords = Array.isArray(changes.keywords.newValue) ? changes.keywords.newValue : [];
      renderList();
    }
    if (changes.autoCollect) {
      autoCollectEnabled = changes.autoCollect.newValue !== false;
      const box = $("kc-auto");
      if (box) box.checked = autoCollectEnabled;
    }
  });

  chrome.runtime.onMessage.addListener(function (message, _sender, sendResponse) {
    if (!message || typeof message.type !== "string") return;
    if (message.type === "KC_PING") {
      sendResponse({ ok: true, page: location.href });
      return;
    }
    if (message.type === "KC_COLLECT_VISIBLE") {
      handleCollectClick().then(function () {
        sendResponse({ ok: true, total: keywords.length });
      });
      return true;
    }
    if (message.type === "KC_GET_SERP") {
      sendResponse(extractSerp());
      return;
    }
    if (message.type === "KC_COPY_SERP") {
      handleExportSerp("copy").then(function (result) {
        sendResponse(result || extractSerp());
      });
      return true;
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      mountPanel().then(function () {
        observePage();
        scheduleAutoCollect();
      });
    });
  } else {
    mountPanel().then(function () {
      observePage();
      scheduleAutoCollect();
    });
  }
})();
