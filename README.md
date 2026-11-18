[English](#english) | [中文](#中文)

# Keyword Catch

## English

Keyword Catch is an open-source Chrome extension for two repetitive parts of SEO keyword research: saving Google search suggestions and exporting URLs from the current search results page. The interface is mainly in Simplified Chinese. Current version: **0.1.3**.

### What it does—and its limits

- Collects the search box suggestions already visible on the current page. Automatic collection is on by default; you can turn it off and collect manually. New suggestions are highlighted and duplicates are skipped.
- Copies or downloads current-page result URLs as TXT or CSV. Detected ads are labeled `广告` (ad). Each entry has one URL; any row number is just its order on the page.
- Works only on Google Search pages, including supported regional domains such as google.com.sg and google.co.jp, not Gmail or Google Docs.
- Does not move your cursor. To see suggestions at another cursor position, move it yourself.
- Only collects content already visible on the current page. It does not search in the background, crawl in bulk, or fetch subsequent pages automatically.
- Does not collect People Also Ask or related searches at the bottom of the page, and does not provide search volume, competition data, or ranking scores. Some special result modules may not be included.
- Chrome only; Firefox is not supported. It is **not listed in the Chrome Web Store**.

Collected keywords and settings stay in your browser's local storage on your computer. Keywords remain after restarting Chrome until you clear them. The extension has no analytics or reporting and does not send collected data to a server. Copied or downloaded data stays under your control; be careful when sharing it.

### Install from GitHub

An extension adds a small tool to Chrome. “Load unpacked” lets Chrome load its files directly from a folder, without a store installation.

1. With Git installed, open a terminal and run:

   ```sh
   git clone https://github.com/SanfordSurfing/keyword-catch.git
   cd keyword-catch
   ```

   If you do not use Git, choose **Code → Download ZIP** on the [repository page](https://github.com/SanfordSurfing/keyword-catch), then extract it first.
2. Open Chrome and type `chrome://extensions` in the address bar.
3. Turn on **Developer mode** in the top right. You do not need to write code; this enables loading an extension folder.
4. Click **Load unpacked** and select the folder containing `manifest.json`, not an individual file.
5. Check that **Keyword Catch** appears and is enabled. You can pin it using Chrome's puzzle-piece Extensions menu.

There is no build step and no dependency installation. Keep the folder available while using the extension. After changing its files, click its reload icon at `chrome://extensions`, then refresh the Google page.

### Use it

**Save suggestions**

1. Open [Google Search](https://www.google.com) or a supported regional Google search page. A Keyword Catch panel appears at the bottom right. The toolbar icon opens a popup with the same saved list.
2. Type a keyword and wait for the suggestion dropdown. With `自动收集建议` (automatic collection) enabled, new suggestions join the list and a message shows how many were added.
3. Click `收集当前建议` (collect current suggestions) to collect the visible batch manually. With automatic collection off, only this action or its shortcut adds suggestions.
4. Move the cursor yourself to another position in the same query. When suggestions change, new words are appended without duplicates.
5. Copy the list, export TXT or CSV, or click `清空` (clear). Clearing asks for confirmation. The panel can be collapsed and expanded.

**Export result URLs**

1. Submit a Google search and wait for its results.
2. Click `复制本页网址` (copy this page's URLs), or download TXT / CSV in the panel or popup.
3. Paste into a text editor to check: one URL per line, with `[广告]` before detected ads. CSV includes type, title, and URL columns; ads have type `广告`. The reported counts should match the exported entries.
4. After changing the query or page, export again for that page. The extension does not collect other pages for you.

**Keyboard shortcuts**

| Action | Windows / Linux | Mac |
| --- | --- | --- |
| Collect current suggestions | Alt+Shift+K | Option+Shift+K |
| Copy current-page URLs | Alt+Shift+L | Option+Shift+L |

On Mac, Option is the Alt key, **not Command**. Change or assign shortcuts at `chrome://extensions/shortcuts` under Keyword Catch. A system conflict may leave a default unassigned.

The two action buttons show the actual assigned shortcuts in both the popup and panel. After changing a binding, reopen the popup and return focus to the Google tab to refresh the labels. Unassigned or unreadable bindings have no label; the buttons still work. Long labels can wrap.

### Troubleshooting and tests

Check that the extension is enabled and that you are on Google Search. After editing files, reload the extension and refresh the page. If suggestions or URLs cannot be read, Google may have changed its page structure; the panel should show a failure message rather than claim success.

With Node.js installed, run from the repository folder:

```sh
node tests/run.mjs
```

No npm install is needed. These checks cover rules such as deduplication, URL cleanup, export formatting, and shortcut handling. They do not replace trying the extension in real Chrome. Follow the [manual testing checklist](docs/manual-testing.md) for that.

### License and contributing

Released under the [MIT License](LICENSE), copyright 2026 Sanford Shawn. You may use, modify, and share it while keeping the license notice.

Issues and pull requests are welcome at [SanfordSurfing/keyword-catch](https://github.com/SanfordSurfing/keyword-catch). See [CONTRIBUTING.md](CONTRIBUTING.md). Keep changes within the first version's scope: visible current-page suggestions and result URLs, without bulk crawling or automatic cursor movement. Do not post personal searches or exported browsing data in reports.

## 中文

Keyword Catch 是一个开源 Chrome 浏览器插件，用来做 SEO 关键词研究里两件重复的事：收集 Google 搜索建议，以及导出当前搜索结果页的网址。界面主要是简体中文，当前版本为 **0.1.3**。

### 能做什么，有哪些限制

- 收集当前页面搜索框下拉列表里已经能看到的建议。默认开启自动收集，也可以关闭后手动收集；新词会高亮提示，重复词不会再次加入。
- 复制当前结果页的网址，或下载 TXT / CSV。识别到的广告会标成「广告」。每条只有一个网址；序号只是它在本页的出现顺序。
- 只在 Google 搜索页工作，支持 google.com.sg、google.co.jp 等地区域名，不用于 Gmail、Google 文档等产品。
- 不会替你移动光标。同一个词要看不同光标位置的建议，需要你自己移动。
- 只收集当前页已经能看到的内容，不会在后台搜索、批量抓取或自动翻页。
- 不收集「大家还在问」和页面底部「相关搜索」，不提供搜索量、竞争度或排名分数。某些特殊结果模块可能不包含在导出里。
- 目前只支持 Chrome，不支持 Firefox；**尚未上架 Chrome 网上应用店**。

收集的关键词和设置只保存在你电脑的浏览器本地存储中。关掉 Chrome 后关键词仍在，直到你自己清空。插件没有统计或上报功能，不会把收集的数据送到服务器。复制、下载的内容由你自己保管，分享时请留意其中的个人信息。

### 从 GitHub 安装

浏览器插件可以理解成给 Chrome 加一个小工具。「加载已解压的扩展程序」就是让 Chrome 直接读取文件夹里的插件，不需要从商店安装。

1. 如果已经安装 Git，在终端运行：

   ```sh
   git clone https://github.com/SanfordSurfing/keyword-catch.git
   cd keyword-catch
   ```

   不使用 Git 也可以：打开[仓库页面](https://github.com/SanfordSurfing/keyword-catch)，选择 **Code → Download ZIP**，下载后先解压。
2. 打开 Chrome，在地址栏输入 `chrome://extensions` 并回车。
3. 打开右上角的「开发者模式」。这不是让你写代码，只是允许从文件夹加载插件。
4. 点「加载已解压的扩展程序」，选中里面有 `manifest.json` 的文件夹本身，不要只选某个文件。
5. 列表里出现 **Keyword Catch**，开关是打开的，就装好了。可以通过工具栏拼图形状的「扩展程序」菜单把它固定到工具栏。

不需要构建或安装依赖。使用期间请保留这个文件夹。以后改过其中的文件，要到 `chrome://extensions` 点插件的重新加载图标，再刷新 Google 页面。

### 怎么用

**收集搜索建议**

1. 打开 [Google 搜索](https://www.google.com) 或支持的地区搜索页，右下角会出现 Keyword Catch 面板。工具栏图标也能打开小窗口，两处使用同一份列表。
2. 在搜索框输入关键词，等下拉建议出现。「自动收集建议」开启时，新词会加入列表，并提示新增了多少个。
3. 点「收集当前建议」可以手动收集当前这一批。关闭自动收集后，只有这个操作或对应快捷键才会添加建议。
4. 自己把光标移到同一个词的不同位置，建议变化后，新词会追加，已经有的不会重复加入。
5. 可以复制列表、导出 TXT / CSV，或点「清空」。清空前会再确认。页面面板也可以收起和展开。

**导出当前结果页的网址**

1. 在 Google 提交搜索，等结果页加载出来。
2. 在面板或工具栏小窗口里点「复制本页网址」，也可以下载 TXT / CSV。
3. 粘贴到记事本检查：一行一个网址，识别到的广告前面有 `[广告]`。CSV 包含类型、标题和网址列，广告类型写为「广告」。提示条数应和导出的条目数一致。
4. 换搜索词或翻页后，再导出一次才是新页面的数据；插件不会帮你收集其他页。

**快捷键**

| 操作 | Windows / Linux | Mac |
| --- | --- | --- |
| 收集当前建议 | Alt+Shift+K | Option+Shift+K |
| 复制本页网址 | Alt+Shift+L | Option+Shift+L |

Mac 的 Option 就是 Alt，**不是 Command**。想改组合，在地址栏打开 `chrome://extensions/shortcuts`，找到 Keyword Catch 后修改或指定。默认组合被系统占用时，Chrome 可能不会自动绑定。

工具栏小窗口和页面面板的两个对应按钮会显示实际快捷键。改完后重新打开小窗口、切回 Google 标签页或恢复焦点，标注会更新。未绑定或读取失败时不显示标注，按钮仍能点；长组合可以换行。

### 没反应时怎么办，以及如何测试

先确认插件已启用，而且你正在 Google 搜索页。改过文件后要重新加载插件并刷新页面。如果读不到建议或网址，可能是 Google 改了页面结构；面板应显示失败提示，而不会假装成功。

安装 Node.js 后，在仓库文件夹的终端运行：

```sh
node tests/run.mjs
```

不需要运行 npm install。自动检查涵盖去重、网址清理、导出格式和快捷键处理等规则，不能代替在真实 Chrome 里试用。浏览器自测步骤见[手动测试清单](docs/manual-testing.md)。

### 许可与参与

本项目使用 [MIT 许可证](LICENSE)，版权为 2026 Sanford Shawn。可以自由使用、修改和分享，请保留许可证说明。

欢迎在 [SanfordSurfing/keyword-catch](https://github.com/SanfordSurfing/keyword-catch) 提 Issue 或 Pull Request，具体见 [CONTRIBUTING.md](CONTRIBUTING.md)。改功能时保持第一版范围：当前页可见的搜索建议和结果网址，不加入批量抓取或自动移动光标。反馈时不要公开个人搜索或导出的浏览数据。
