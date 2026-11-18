/**
 * Keyword Catch 后台：把快捷键转给当前标签页里的内容脚本。
 * 用户可在 chrome://extensions/shortcuts 自行修改按键组合。
 */
"use strict";

const COMMANDS = {
  "collect-suggestions": "KC_COLLECT_VISIBLE",
  "copy-serp-urls": "KC_COPY_SERP",
};

async function flashBadge(text, title) {
  try {
    await chrome.action.setBadgeBackgroundColor({ color: "#b91c1c" });
    await chrome.action.setBadgeText({ text: text || "!" });
    if (title) await chrome.action.setTitle({ title: title });
    setTimeout(function () {
      chrome.action.setBadgeText({ text: "" });
      chrome.action.setTitle({ title: "Keyword Catch" });
    }, 2600);
  } catch (err) {
    // 忽略徽章更新失败，不影响快捷键本身。
  }
}

chrome.commands.onCommand.addListener(function (command) {
  const type = COMMANDS[command];
  if (!type) return;

  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    const tab = tabs && tabs[0];
    if (!tab || tab.id == null) {
      flashBadge("!", "请先打开一个 Google 搜索页，再使用快捷键。");
      return;
    }
    chrome.tabs.sendMessage(tab.id, { type: type }, function (response) {
      const lastError = chrome.runtime.lastError;
      if (lastError || (response && response.ok === false && !response.items)) {
        flashBadge("!", "请在 Google 搜索页使用快捷键。当前页没有加载 Keyword Catch。");
      }
    });
  });
});

// Content scripts cannot access chrome.commands; return fresh bindings on request.
chrome.runtime.onMessage.addListener(function (message, _sender, sendResponse) {
  if (!message || message.type !== "KC_GET_SHORTCUTS") return;
  Promise.all([chrome.commands.getAll(), chrome.runtime.getPlatformInfo()])
    .then(function (results) {
      sendResponse({ commands: results[0], platform: results[1].os });
    }).catch(function () {
      sendResponse({ commands: [], platform: "" });
    });
  return true;
});
