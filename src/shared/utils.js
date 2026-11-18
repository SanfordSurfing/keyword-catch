/**
 * Keyword Catch — 纯函数工具，不依赖 Chrome API。
 * 浏览器和 Node 测试共用这份文件。
 */
(function (root) {
  "use strict";

  function normalizeKeyword(text) {
    return String(text || "").replace(/\s+/g, " ").trim();
  }

  function keywordKey(text) {
    return normalizeKeyword(text).toLowerCase();
  }

  /**
   * 把新词合并进已有列表。按忽略大小写、去掉多余空格去重，保留先出现的写法。
   * incoming 可以是字符串，或带 text 字段的对象。
   * 返回 { list, added }，added 只包含这一次新加入的词。
   */
  function mergeKeywords(existing, incoming, addedAt) {
    const at = typeof addedAt === "number" ? addedAt : Date.now();
    const list = Array.isArray(existing) ? existing.slice() : [];
    const seen = new Set();
    for (const item of list) {
      const key = keywordKey(item && item.text);
      if (key) seen.add(key);
    }
    const added = [];
    const source = Array.isArray(incoming) ? incoming : [];
    for (const raw of source) {
      const text = normalizeKeyword(typeof raw === "string" ? raw : raw && raw.text);
      if (!text) continue;
      const key = keywordKey(text);
      if (seen.has(key)) continue;
      seen.add(key);
      const item = { text: text, addedAt: at };
      list.push(item);
      added.push(item);
    }
    return { list: list, added: added };
  }

  /**
   * 判断是不是 Google 搜索站本身（www.google.com、google.com.sg、google.co.jp 等）。
   * 不会把 mail.google.com、accounts.google.com 算进去。
   */
  function isGoogleSearchHost(hostname) {
    if (!hostname) return false;
    const host = String(hostname).toLowerCase().replace(/\.$/, "");
    const stripped = host.replace(/^(www|ipv6)\./, "");
    return /^google(\.[a-z]{2,3}){1,2}$/.test(stripped);
  }

  /**
   * 把可能被逗号或空白粘在一起的多个网址拆开。
   * 只在逗号/空白后面接着新的 http(s) 网址时拆，避免切断同一地址里的路径。
   */
  function splitUrlCandidates(value) {
    const text = String(value == null ? "" : value).trim();
    if (!text) return [];
    return text.split(/[,\s]+(?=https?:\/\/)/i).map(function (part) {
      return part.trim();
    }).filter(Boolean);
  }

  /**
   * 安全解开 Google 的 /url?q= 跳转包装。
   * 只接受 http/https 目标；解不开或目标不安全时返回 null，不要把包装地址当成结果。
   */
  function unwrapGoogleUrl(href, base) {
    if (!href || typeof href !== "string") return null;
    const trimmed = href.trim();
    if (!trimmed || trimmed.toLowerCase().startsWith("javascript:")) return null;

    let url;
    try {
      url = new URL(trimmed, base || "https://www.google.com/");
    } catch (err) {
      return null;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;

    if (isGoogleSearchHost(url.hostname) && isGoogleTrackerPath(url.pathname)) {
      const target = url.searchParams.get("url") || url.searchParams.get("q");
      if (!target || !/^https?:\/\//i.test(target)) return null;
      try {
        const inner = new URL(target);
        if (inner.protocol !== "http:" && inner.protocol !== "https:") return null;
        return inner.href;
      } catch (err) {
        return null;
      }
    }
    return url.href;
  }

  /**
   * Google 搜索页上的点击跟踪路径。/goto 的 url 参数是密文，解不开，必须从页面上的网址标注另取。
   */
  function isGoogleTrackerPath(pathname) {
    const path = String(pathname || "").replace(/\/+$/, "") || "/";
    return path === "/url" || path === "/goto" || path === "/aclk" || path.startsWith("/aclk/");
  }

  function isGoogleClickTracker(href, base) {
    if (!href) return false;
    let url;
    try {
      url = new URL(href, base || "https://www.google.com/");
    } catch (err) {
      return false;
    }
    const host = url.hostname.replace(/\.$/, "");
    if (/googleadservices\.com$/i.test(host) || /^adservice\./i.test(host)) return true;
    if (isGoogleSearchHost(url.hostname) && isGoogleTrackerPath(url.pathname)) return true;
    return false;
  }

  /**
   * 搜索结果里指向“再搜一次”的链接（/search?q=...），不是外部结果页，导出时应跳过。
   */
  function isGoogleSearchQueryUrl(href, base) {
    const unwrapped = unwrapGoogleUrl(href, base);
    const raw = unwrapped || href;
    let url;
    try {
      url = new URL(raw, base || "https://www.google.com/");
    } catch (err) {
      return false;
    }
    if (!isGoogleSearchHost(url.hostname)) return false;
    const path = url.pathname;
    return path === "/" || path === "/search" || path === "/webhp" || path === "/imghp" || path === "/sch" || path.startsWith("/search");
  }

  /**
   * 下拉列表底部的举报、清除记录等按钮，不是候选关键词。
   */
  function isSkippableSuggestion(text) {
    const value = normalizeKeyword(text);
    if (!value) return true;
    if (value.length > 200) return true;
    const patterns = [
      /^举报不当/,
      /^檢舉不當/,
      /^报告不当/,
      /^report inappropriate/i,
      /^signaler des prédictions/i,
      /^unangemessene vorhersagen/i,
      /^segnala previsioni/i,
      /^denunciar predicciones/i,
      /^不適切な予測/,
      /^부적절한 예측/,
      /^ลบประวัติ/,
      /不当预测/,
      /inappropriate predictions/i,
      /^删除(搜索)?记录/,
      /^清除(搜索)?记录/,
      /^clear (all )?search history$/i,
      /^remove history item$/i,
      /^删除纪录/,
      /^查看更多$/,
      /^see more$/i,
      /^discover more$/i,
      /^了解更多$/,
      /^反馈$/,
      /^feedback$/i,
    ];
    return patterns.some(function (re) { return re.test(value); });
  }

  function escapeCsvCell(value) {
    const text = String(value == null ? "" : value);
    if (/[",\n\r]/.test(text)) return '"' + text.replace(/"/g, '""') + '"';
    return text;
  }

  function toCsv(rows) {
    return rows
      .map(function (row) {
        return row.map(escapeCsvCell).join(",");
      })
      .join("\r\n");
  }

  function formatStamp(ms) {
    const d = new Date(typeof ms === "number" ? ms : Date.now());
    const pad = function (n) { return String(n).padStart(2, "0"); };
    return (
      d.getFullYear() +
      "-" + pad(d.getMonth() + 1) +
      "-" + pad(d.getDate()) +
      " " + pad(d.getHours()) +
      ":" + pad(d.getMinutes()) +
      ":" + pad(d.getSeconds())
    );
  }

  function keywordsToTxt(list) {
    return (list || []).map(function (item) { return item.text; }).join("\n");
  }

  function keywordsToCsv(list) {
    const rows = [["关键词", "加入时间"]];
    (list || []).forEach(function (item) {
      rows.push([item.text, formatStamp(item.addedAt)]);
    });
    return "\uFEFF" + toCsv(rows);
  }

  function serpToTxt(items) {
    return (items || [])
      .map(function (item) {
        return item.type === "ad" ? "[广告] " + item.url : item.url;
      })
      .join("\n");
  }

  function serpToCsv(items) {
    const rows = [["序号", "类型", "标题", "网址"]];
    (items || []).forEach(function (item, index) {
      rows.push([
        String(index + 1),
        item.type === "ad" ? "广告" : "搜索结果",
        item.title || "",
        item.url,
      ]);
    });
    return "\uFEFF" + toCsv(rows);
  }

  // Chrome supplies the actual binding, never substitute a default for an empty one.
  function formatShortcut(shortcut, platform) {
    const isMac = /mac/i.test(platform || "");
    return String(shortcut || "").split("+").map(function (key) {
      key = key.trim();
      if (/^(alt|option)$/i.test(key)) return isMac ? "Option" : "Alt";
      if (/^(command|cmd|meta)$/i.test(key)) return "Command";
      if (/^shift$/i.test(key)) return "Shift";
      if (/^(ctrl|control)$/i.test(key)) return "Ctrl";
      return key;
    }).filter(Boolean).join(" + ");
  }

  const api = {
    formatShortcut: formatShortcut,
    normalizeKeyword: normalizeKeyword,
    keywordKey: keywordKey,
    mergeKeywords: mergeKeywords,
    isGoogleSearchHost: isGoogleSearchHost,
    splitUrlCandidates: splitUrlCandidates,
    unwrapGoogleUrl: unwrapGoogleUrl,
    isGoogleClickTracker: isGoogleClickTracker,
    isGoogleSearchQueryUrl: isGoogleSearchQueryUrl,
    isSkippableSuggestion: isSkippableSuggestion,
    escapeCsvCell: escapeCsvCell,
    toCsv: toCsv,
    formatStamp: formatStamp,
    keywordsToTxt: keywordsToTxt,
    keywordsToCsv: keywordsToCsv,
    serpToTxt: serpToTxt,
    serpToCsv: serpToCsv,
  };

  root.KeywordCatchUtils = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
