"""Package the built app for GitHub download, with Mac and Windows launchers."""
from pathlib import Path
import zipfile

root = Path(__file__).resolve().parent.parent
if not (root / 'dist' / 'index.html').is_file():
    raise SystemExit('Run npm run build first.')
out = root / 'releases' / 'longun-finance-desk.zip'
out.parent.mkdir(exist_ok=True)
mac = '''#!/bin/bash
cd -- "$(dirname -- "$0")" || exit 1
if command -v python3 >/dev/null 2>&1; then
  python3 launch.py
else
  echo "Please install Python 3 from https://www.python.org/downloads/macos/"
fi
echo "Press Return to close this window."
read -r
'''
windows = '@echo off\r\ncd /d "%~dp0"\r\npy -3 launch.py\r\npause\r\n'
readme = '''朗冠财务工作台

1. 将压缩包完整解压到一个固定文件夹。
2. 安装 Python 3：https://www.python.org/downloads/
3. Mac 双击 Start-Mac.command；Windows 双击 Start-Windows.bat。
   Mac 也可打开终端，输入 python3 和空格，将 launch.py 拖入终端后按回车。
4. 浏览器将自动打开系统，使用期间保留启动窗口。
5. 每张 A4 两份单据；发票每张 A4 四份。打印请选择 A4、实际大小 100%。

请保留整个 dist 文件夹。下次启动时使用同一个浏览器，才能继续读取草稿和发票。
数据只保存在当前浏览器，清除浏览器数据将删除记录；重要文件请导出 PDF 备份。
本版本无账号、云同步或线上审批，也不识别发票金额。

网站发布：可将 dist 整个文件夹上传到静态网站托管服务，或者通过 GitHub 仓库导入 Netlify。
'''
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    for p in sorted((root / 'dist').rglob('*')):
        if p.is_file():
            z.write(p, 'longun-finance-desk/' + str(p.relative_to(root)))
    z.write(root / 'scripts' / 'launch.py', 'longun-finance-desk/launch.py')
    entry = zipfile.ZipInfo('longun-finance-desk/Start-Mac.command')
    entry.create_system = 3
    entry.external_attr = 0o100755 << 16
    entry.compress_type = zipfile.ZIP_DEFLATED
    z.writestr(entry, mac)
    z.writestr('longun-finance-desk/Start-Windows.bat', windows)
    z.writestr('longun-finance-desk/使用说明.txt', readme)
with zipfile.ZipFile(out) as z:
    assert z.testzip() is None
    assert 'longun-finance-desk/dist/index.html' in z.namelist()
    assert (z.getinfo('longun-finance-desk/Start-Mac.command').external_attr >> 16) & 0o111
print(f'Package verified: {out.name} ({out.stat().st_size:,} bytes)')
