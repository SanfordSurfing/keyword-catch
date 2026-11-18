[English](#english) | [中文](#中文)

# Contributing / 参与贡献

## English

Thank you for helping improve Keyword Catch. Open an [Issue](https://github.com/SanfordSurfing/keyword-catch/issues) for bugs or suggestions. Include your Chrome version, operating system, whether it happened on Google Search, steps to reproduce, and expected versus actual behavior. Remove personal searches, exported URLs, account details, and secrets from any examples or screenshots.

For a pull request, fork the repository, clone your fork, and make a focused change on a branch. For a larger change, discuss the idea in an Issue first. Explain the problem, the change, and how you tested it in the PR. Update both README languages when behavior or instructions change.

Keep the first version's scope: collect only search suggestions and result URLs already visible on the current page. Do not add bulk crawling, background searches, or automatic cursor movement. Keep collected data local; do not add reporting of user data.

Run `node tests/run.mjs` from the repository folder; no dependency installation is needed. Automated tests do not replace testing in real Chrome. Use [docs/manual-testing.md](docs/manual-testing.md), and describe which browser checks you performed and any checks you could not perform. Do not claim unperformed checks passed.

## 中文

欢迎一起改进 Keyword Catch。发现问题或有建议，可以提 [Issue](https://github.com/SanfordSurfing/keyword-catch/issues)。请写明 Chrome 版本、操作系统、是否发生在 Google 搜索页、复现步骤，以及预期和实际结果。示例和截图请先去掉个人搜索、导出网址、账号资料和密钥。

提交 Pull Request 时，先 Fork 仓库，克隆自己的副本，在分支中做一项集中的修改。较大的改动先提 Issue 讨论。PR 中说明问题、改了什么、怎样测试。行为或使用步骤变更时，请同步更新 README 的中英文。

保持第一版范围：只收集当前页上已经能看到的搜索建议和结果网址。不要加入批量抓取、后台搜索或自动移动光标。收集的数据保留在本机，不加入用户数据上报。

在仓库目录运行 `node tests/run.mjs`，不需要安装依赖。自动化测试不能代替真实 Chrome 试用，请按 [docs/manual-testing.md](docs/manual-testing.md) 自测，并说明做了哪些浏览器检查、哪些没有条件检查。没有执行的检查不要写成通过。
