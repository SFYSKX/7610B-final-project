# 安装与启动

首次接触项目，请先阅读 [项目介绍与业务流程](PROJECT_OVERVIEW.md)，了解交易、拍卖、费用分配和赔付的用途。本文负责把这些功能运行起来，逐项操作见 [本地测试](LOCAL_TESTS.md)。

## 必要环境

- Node.js 22.x 与 npm；`package.json` 要求 `>=22 <23`。
- 能运行现代 JavaScript 的浏览器。
- 首次 `npm ci` 需要访问 npm 软件源。
- Sepolia 操作额外需要 MetaMask、Ethereum Sepolia RPC、测试 ETH 和自己的 Safe。

Python、Conda、数据库、Docker 和全局 Hardhat 均不是必要依赖。使用项目内锁定的 Hardhat、Vite 和 Solidity 编译器。

解压后，在文件管理器中进入包含 `package.json` 的文件夹，再打开终端。Windows CMD、PowerShell 和 macOS/Linux 终端都可以运行基本 npm 命令。不要在 ZIP 内直接运行。

```text
node --version
npm --version
npm ci
```

版本不符时安装 Node.js 22，并重开终端检查 PATH。不要直接删掉锁文件解决安装问题。

可选使用 Conda：`environment.yml` 不绑定环境名称。下面名称可按接收者偏好替换：

```text
conda env create --name ledger-market-dev --file environment.yml
conda activate ledger-market-dev
node --version
npm ci
```

## 一键本地演示

确认端口空闲后运行：

```text
npm run demo
```

默认 RPC 为 `http://127.0.0.1:8545`，网页为 `http://127.0.0.1:5173`。如有其他服务占用，可以使用另一组预设端口：

```text
npm run demo -- --isolated
```

这时 RPC 为 `http://127.0.0.1:18545`、网页为 `http://127.0.0.1:15173`。以终端输出为准。`--strictPort` 使 demo 在端口占用时退出，不会自动换端口或结束其他服务。

Windows 可用 `netstat -ano | findstr LISTENING | findstr ":8545 :5173 :18545 :15173"` 查看监听者，然后核对 PID 的完整命令行。仅看 `node.exe` 名称不能判断是否属于本项目。

启动后点击网页的“本地演示”。整个 demo 只需一个终端；自动结算已经包含在编排中，不要再启动第二份结算服务。Ctrl+C 停止本次 demo；关闭后检查其子进程和端口是否退出。

启动新内存链时，脚本会归档已有本地部署清单；归档清单不包含链数据。重新启动产生的新链需要重新部署和创建测试数据，demo 会完成这些步骤。确认是新链后再处理浏览器中的旧 pending 记录，不能将该操作用于取消公共链交易。

## 手动本地流程

需要观察每一步时使用三个终端，均打开在项目根目录。

终端一：

```text
npm run chain
```

终端二，仅在新链首次初始化时逐条执行：

```text
npm run compile
npm run deploy:local
npm run deploy:test-assets
npm run seed:local
npm run validate:deployment
npm run settle:local
```

终端三：

```text
npm run dev
```

手动流程默认连接 8545。要连接其他本地端口，在执行部署、seed、验证和结算的终端设置 `LOCAL_RPC_URL`；Windows CMD 使用 `set "LOCAL_RPC_URL=http://127.0.0.1:18545"`，PowerShell 使用 `$env:LOCAL_RPC_URL='http://127.0.0.1:18545'`，POSIX shell 使用 `export LOCAL_RPC_URL=http://127.0.0.1:18545`。节点本身也必须监听该端口。

已有部署且链上合约仍在时，复用并验证它，不重复运行核心部署。`seed:local` 只允许 31337，只在集合还没有 token 时创建初始六件资产。

## 构建与共享前端

```text
npm run build
npm run preview
```

构建前先完成希望连接的网络部署。构建会将 `public/deployments` 中的公开清单复制到 `dist/deployments`。部署后修改清单，需要重新构建前端。构建过程不创建合约或铸造资产。

向其他用户提供前端时，可将 `dist` 发布到 HTTPS 静态托管服务。提供公开 ABI 和部署清单即可，不提供部署者或结算账户私钥。远程用户通过自己的钱包操作 Sepolia；本地 demo 的 loopback RPC 仅用于本机实验。
