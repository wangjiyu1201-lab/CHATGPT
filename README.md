# 朗冠 · 财务工作台

根据朗冠（上海）广告有限公司提供的三份 PDF 模板开发的本地财务填单系统。原始模板位于 `public/templates/`，导出直接在原 PDF 上叠加文字，不重绘原表格。

## 直接运行打包版本

打开 [运行包文件页面](https://github.com/wangjiyu1201-lab/CHATGPT/blob/main/releases/longun-finance-desk.zip)，点击 **Download raw file（下载原始文件）**。注意：仓库首页的 **Code → Download ZIP** 下载的是源码，不能代替这个已构建的运行包。

解压下载的 `longun-finance-desk.zip` 到固定文件夹。电脑安装 [Python 3](https://www.python.org/downloads/) 后：

- **Mac**：双击 `Start-Mac.command`。也可以打开终端，输入 `python3` 和一个空格，将 `launch.py` 拖进终端，再按回车。
- **Windows**：双击 `Start-Windows.bat`。
- **Linux**：在解压目录执行 `python3 launch.py`。

浏览器将自动打开系统，使用期间保留启动窗口。已包含构建文件，无需安装 Node.js 或下载依赖。请保留整个 `dist` 文件夹。若 Mac 提示无法验证启动文件，可使用上面的终端方式启动 `launch.py`。

启动器只监听本机固定端口 8765；固定地址用于在下次启动时继续读取同一浏览器中的草稿和发票。不提供公共网络访问。

## 让同事通过网址使用

本仓库已包含 `netlify.toml`。在 Netlify 登录后选择导入 GitHub 项目，选择本仓库与 `main` 分支，构建命令为 `npm run build`，发布目录为 `dist`。Netlify 构建成功后提供网站地址，可发给同事。也可以将运行包内的 `dist` 文件夹上传到 Netlify Drop，或部署到公司的 HTTPS 静态网站服务器。

仓库上传与网站发布是两个操作；本仓库不包含自动公开发布网站的工作流。网站没有登录控制，同事各自在自己的浏览器保存数据，彼此不能查看或审批单据。

## 从源码启动

需要 Node.js 20.19+（本环境已用 Node.js 24 验证）。

```sh
cd CHATGPT
npm ci
npm run dev -- --port 5173
```

打开开发服务器显示的地址。生产版本执行 `npm run build`，将 `dist/` 部署到任意支持 HTTPS 的静态服务器即可。无需数据库、API 密钥或后端服务。使用 HTTP 本机地址或 HTTPS，以支持浏览器安全上下文中的文件处理和 UUID 功能。

## 功能

- 现金报销、支付申请、预支申请三种表单，实时预览。
- A4 每页两张，默认上下联同步，可关闭同步分别填写。
- 报销最多五项明细（与原模板一致），整数分计算，自动合计、张数合计和人民币大写。金额最多六位整数、两位小数，超出容量请另建单据。
- 原模板 PDF 导出、打印。打印选择 A4、实际大小（100%），不要缩放。
- 发票支持 PDF、JPG、PNG、WebP；多页 PDF 逐页拆分。每文件最多 30 MB，每 PDF 最多 80 页，最多同时保留 120 张。支持排序、旋转和删除。
- 发票按照左上、右上、左下、右下四格自动分页，等比缩放、不裁切。PDF 页面以矢量形式嵌入，保留页面方向及裁剪边界；图片最长边限制为 2600 像素，以高质量 JPEG 排版。不执行发票识别或金额提取。
- 草稿保存到 localStorage（最多最近 100 份），发票保存到 IndexedDB。

这是单设备版本，没有用户登录、云端同步或线上审批。清除浏览器数据会删除本地记录，重要资料请及时导出 PDF；不同浏览器或网址的本地记录相互独立。文件不传到服务器。

## 验证

```sh
npm test
npm run build
npm run test:e2e
```

端到端检查使用 Playwright 与系统 `/usr/bin/chromium`，可通过 `CHROMIUM_PATH` 指定浏览器路径。覆盖三类 PDF 导出、报销合计、独立两联、草稿恢复、手机宽度、多页 PDF、图片上传、旋转排序与发票分页。测试生成的样例文件写入 `/tmp/longun-*.pdf`，不包含真实业务数据。

`scripts/prepare-font.py` 是可选的字体资产生成工具，需要 Python fonttools[woff] 和系统 Noto CJK 字体，正常安装和启动无需执行。其将 CFF 轮廓转为 TrueType，并保留原字体的全部 Unicode 字符映射。PDF 完整嵌入中文字体以保证阅读器兼容性，单据文件约 7.5 MB；原始模板、线条和文字仍为矢量。派生字体遵循 `public/fonts/LICENSE.txt` 中的 SIL OFL 1.1。

先执行 `npm run build`，再执行 `python3 scripts/package.py`，可以刷新 `releases/longun-finance-desk.zip`。测试截图、样例业务单据、缓存、依赖目录不提交到仓库。
