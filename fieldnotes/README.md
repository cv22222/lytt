# 间记
一个可以自己维护的中文对话与状况记录本。前台放在 GitHub Pages，独立 Node 服务处理站主登录校验、记录修改和访问日志。SQLite 保存内容。

## 先在电脑上试用
安装 Node.js 24 或以上版本。Windows 双击「启动本机预览.cmd」，也可以在项目目录运行 `node server/main.mjs`。浏览器打开 `http://127.0.0.1:8787`，点击管理后台，粘贴终端显示的本次管理密钥。保持窗口打开。首次启动是空记录本，点击「新建记录」，写完将可见性改为「发布到前台」，再保存。以后重启数据仍在本地 data 目录，临时密钥会变化。请勿将 data 上传到公开仓库。

## 发布到 github.io
1. 登录 GitHub，右上角 + → New repository，填写「用户名.github.io」，替换成你自己的用户名，选择 Public。
2. 将本项目文件放入仓库根目录，保留 docs 和 server 两个目录。用网页上传时，在仓库页面选择 Add file → Upload files，然后提交。只上传源码，不上传真实记录、密钥或运行产生的 data 目录。
3. 在 Settings → Pages → Build and deployment 中选 Deploy from a branch，选择 main 和 /docs，点击 Save。等待 Pages 显示站点地址。名为「用户名.github.io」的仓库发布在 https://用户名.github.io/，普通仓库则位于 https://用户名.github.io/仓库名/。
4. 未配置后台时，线上页面展示 sample.json 里的两条示例，管理入口会提示连接后台。

## 连接正式后台
需要一台可以运行 Node 24、有持久磁盘和 HTTPS 的主机。把 server、docs 放到主机上，设置环境变量后运行 `node server/main.mjs`，由进程管理器保持服务运行。
- ADMIN_KEY 填写用密码管理器随机生成的长密钥，至少 24 位，仅保存在服务器环境。
- DB_PATH 提供持久磁盘上 SQLite 文件的绝对路径，目录须可写。停服务后备份整个数据目录。
- SITE_ORIGIN 填 Pages 前台的来源，例如 https://你的用户名.github.io ，不含路径、结尾斜杠。HOST 默认 127.0.0.1，PORT 默认 8787。
- 推荐在同机用 HTTPS 反向代理转发给 127.0.0.1:8787，且限制后台端口只能本机访问。直连时日志取连接对端 IP；若使用同机 Nginx，配置其覆盖请求头 `proxy_set_header X-Real-IP $remote_addr;`，再设置 TRUST_LOCAL_PROXY=1。多层代理需要按实际网络配置可信来源，否则会显示代理 IP。
- 把 docs/config.js 的 JOURNAL_API 改为后台 HTTPS 地址，例如 https://api.example.com，重新提交到 GitHub。前台和管理页都会读取此地址。管理密钥在管理页登录时输入，只留在页面内存。不要写进 config.js。
- 验收：登录管理页，新建并发布一条记录。用另一个浏览器打开前台并展开它，返回管理页查看访问日志。改为草稿后刷新前台，应看不到这条记录。

## 以后怎么改
日常写作、发布、撤回、删除及修改站名、简介均可在管理页完成。新增功能可直接修改源码。docs/index.html 和 app.js 控制阅读界面，docs/admin.html 和 admin.js 控制管理操作，docs/style.css 控制样式，server/main.mjs 提供 API 和数据表。修改服务端后需要重启后台，已有数据表结构的变更应编写迁移。
日志按请求记录首页加载和正文展开，保留当时的标题、时间、IP，管理页显示最近 200 条。IP 可以被多人共用，不能识别具体个人。
