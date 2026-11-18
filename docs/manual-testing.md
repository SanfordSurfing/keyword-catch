[English](#english) | [中文](#中文)

# Manual testing / 手动测试

## English

Use this checklist in real Chrome after changes. Prepare a text editor for clipboard checks and use non-sensitive test queries such as `coffee shop`. This is a procedure, not a record of completed tests. Record your Chrome version, OS, extension version, pass/fail/not-tested status, and any errors. Do not publish personal searches, exports, or unredacted screenshots.

1. **Install:** Open `chrome://extensions`, enable Developer mode, and load the folder containing `manifest.json`. Expect Keyword Catch to appear enabled. Record the exact error if loading fails.
2. **Suggestions:** Open Google Search and type a test query without submitting it. Expect a Simplified Chinese panel at the bottom right. With automatic collection enabled (the default), visible suggestions join the list, the count increases, new words are briefly highlighted, and a message reports additions. Open the toolbar popup and check that it shows the same list. Copy keywords to a text editor: one keyword per line, readable text.
3. **Deduplication and cursor:** Keep the list and move the cursor yourself to another position in the query. If suggestions change, expect only new words to be appended. Collect the unchanged batch again: no duplicates or count increase. The extension must not move the cursor.
4. **Manual collection:** Turn off automatic collection and type a new query. The saved list should not grow until you click `收集当前建议` (collect current suggestions) or use its shortcut. Check keyword TXT and CSV exports against the saved list.
5. **Result URLs:** Submit the search, wait for results, then click `复制本页网址` (copy this page's URLs). Paste into the editor: one URL per line, detected ads prefixed with `[广告]`, no two URLs glued together. URLs should normally be destination addresses rather than Google redirect wrappers. Result and ad counts should match the exported entries. Open two or three ordinary result URLs to check that they lead to the expected pages. If no ads appear, mark the ad check as not tested.
6. **URL downloads and page changes:** Download result TXT and CSV and compare with copied results. CSV should contain type, title, and URL columns, with `广告` for ads. Change the search or results page and export again: output should reflect the current page, without automatically collecting other pages.
7. **Persistence and clearing:** With automatic collection off and the suggestion dropdown closed, reload the page and restart Chrome: saved keywords should remain. Click clear and cancel first: the list should remain. Clear again and confirm: count becomes zero. Reload the page and reopen the popup: cleared words should not return.
8. **Layout:** Check both the panel and popup. Collection, URL copying, TXT/CSV download buttons, and status messages must be fully readable. The two action buttons show their actual shortcut labels; long labels may wrap. Other buttons should not have invented shortcuts. Collapse the panel to a small bar, then expand it again.
9. **Shortcuts:** Verify bindings at `chrome://extensions/shortcuts`. Defaults are Alt+Shift+K / Alt+Shift+L on Windows/Linux and Option+Shift+K / Option+Shift+L on Mac (Option is Alt, not Command). With suggestions visible, the first collects them; on a results page, the second copies URLs with correct counts and one URL per line. If a default is unassigned because of a conflict, assign it before testing.
10. **Changed and missing bindings:** Set another accepted combination in Chrome's shortcuts page. Reopen the popup and return focus to the Google tab: both labels should update, and the new shortcuts should perform the same actions. Command should appear only if actually bound. Remove a binding: its label should disappear while the button remains usable. Restore your preferred bindings afterward.
11. **Failure handling:** On a non-Google page, try the popup actions: expect a clear failure message. If Google suggestions or results cannot be read, record the error and a sanitized description; do not treat an empty export as a pass.

Firefox, store installation, search-volume data, People Also Ask, and bottom-of-page related searches are outside this version's scope. Note missing special result modules (such as video carousels or knowledge panels) separately. Run `node tests/run.mjs` too; it cannot replace these browser checks.

## 中文

改动后请在真实 Chrome 里按本清单自测。准备记事本检查复制内容，使用 `coffee shop` 等不含隐私的测试词。本文件是测试步骤，不代表已执行通过。记录 Chrome 版本、操作系统、插件版本、各项通过／失败／未测试状态和报错，不公开个人搜索、导出文件或未经遮盖的截图。

1. **安装：** 打开 `chrome://extensions`，开启开发者模式，加载包含 `manifest.json` 的文件夹。应出现 Keyword Catch 且处于启用状态；加载失败请记录完整报错。
2. **建议收集：** 打开 Google 搜索，输入测试词但不提交。右下角应出现简体中文面板。默认开启自动收集，可见建议应进入列表、数字增加、新词短暂高亮，并提示新增数量。工具栏小窗口应显示同一份列表。复制关键词到记事本，应一行一个词、文字正常。
3. **去重与光标：** 保留列表，自己把光标移到查询词另一位置。建议变化后应只追加新词。同一批再次收集不应重复或增加数量。插件不能替你移动光标。
4. **手动收集：** 关闭自动收集，输入新词，列表不应自动增加；点「收集当前建议」或按对应快捷键后才加入。导出关键词 TXT 和 CSV，核对与列表一致。
5. **结果网址：** 提交搜索，等结果加载后点「复制本页网址」。粘贴到记事本，应一行一个网址，识别到的广告前有 `[广告]`，不能把两个网址粘在一起。一般应是目标网站地址，而不是 Google 跳转包装。结果及广告计数应与导出条目一致。打开两三个普通结果网址核对目标页面。没出现广告时，将广告检查记为未测试。
6. **网址下载与换页：** 下载结果 TXT 和 CSV，与复制内容核对。CSV 应包含类型、标题和网址列，广告类型为「广告」。换搜索词或结果页后重新导出，应反映当前页，不会自动收集其他页。
7. **保存与清空：** 关闭自动收集并收起搜索建议下拉框，刷新页面和重启 Chrome，已存关键词应保留。点清空后先取消，列表应保留；再清空并确认，数字应归零。刷新页面、重开小窗口，已清空的词不应恢复。
8. **布局：** 面板和小窗口都检查。收集、复制网址、下载 TXT / CSV 按钮与状态提示应完整可读。两个对应按钮显示真实快捷键，长组合可换行，其他按钮没有编造的快捷键。面板应能收起为小横条，再展开恢复。
9. **快捷键：** 到 `chrome://extensions/shortcuts` 核对绑定。Windows/Linux 默认为 Alt+Shift+K / Alt+Shift+L；Mac 为 Option+Shift+K / Option+Shift+L（Option 即 Alt，不是 Command）。建议可见时第一组能收集；结果页第二组能复制网址，计数正确且一行一个网址。默认组合因冲突未绑定时，先手动指定再测。
10. **修改与解绑：** 在 Chrome 快捷键页改为另一组允许的组合。重开小窗口并切回 Google 标签页恢复焦点，两处标注应更新，新组合仍执行对应操作。只有实际绑定含 Command 时才显示 Command。解除绑定后，对应标注消失，按钮仍可点击。测完恢复自己习惯的组合。
11. **失败提示：** 在非 Google 页尝试小窗口操作，应明确提示失败。Google 建议或结果读不出来时，记录报错与去除隐私后的情况说明，不要将空导出当作通过。

Firefox、商店安装、搜索量、「大家还在问」和底部相关搜索不属于本版范围。视频横滑模块、知识面板等特殊结果遗漏可单独记录。另外运行 `node tests/run.mjs`，但它不能代替上述浏览器检查。
