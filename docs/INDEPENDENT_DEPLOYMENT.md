# 每人独立部署：先读这份指南

本包提供 NFT 定价交易、拍卖、手续费分配和多签赔付的源码。用途与功能见 [项目介绍](PROJECT_OVERVIEW.md)。本指南说明每位接收者如何使用自己的账户运行和调试，包括管理员功能。

## 1. 独立部署到底分开什么

每个人使用同一个源码包和 Ethereum Sepolia 网络（chain ID 11155111），但各自部署自己的 Safe、业务合约和 NFT 集合。合约地址、资产、订单、余额、预算和管理权限属于各自实例。一个人的暂停或赔付操作不会修改另一个人的平台。

独立部署包故意不提供现成 `11155111.json`。连接 MetaMask 只授予网页使用所选钱包的权限，不会自动创建 Safe、业务合约或部署清单。第一次解压后直接点“连接 MetaMask”，提示缺少配置是尚未部署的结果。

不必为本地测试先部署 Sepolia。本地 demo 会为每个人在自己的电脑上建立可丢弃链，并提供全部测试角色。开发过程中先本地测试，准备好后再做一次独立 Sepolia 部署。

## 2. 在一个新目录中开始

将包解压到新目录，进入包含 `package.json` 的文件夹。在该文件夹打开终端，后续命令均从这里执行。Node.js 必须为 22.x；IDE 的 Node 运行时和终端版本也要一致。

```text
node --version
npm --version
npm ci
npm test
npm run build
```

不能把这个包覆盖到别人的运行目录后仅更改 `.env`。新目录不应带有别人的 `.env`、部署 JSON、运行日志、构建产物或 Keeper 检查点。

可先运行 `npm run demo`，访问终端给出的网页并点击“本地演示”。停止 demo 后再准备 Sepolia；本地链和公共测试网的资产、账户及配置各自独立。详细本地步骤见 [安装说明](SETUP.md) 和 [测试手册](LOCAL_TESTS.md)。

## 3. 每个人准备自己的七个测试账户

下表为便于全面测试的角色分配，不要求沿用任何作者的钱包或账户名称。

| 角色 | 用途 |
|---|---|
| ADMIN_1 / DEPLOYER | Safe 第一名 owner，同时部署业务合约、发行测试 NFT |
| ADMIN_2 | Safe 第二名 owner |
| ADMIN_3 | Safe 第三名 owner |
| SELLER | 接收 NFT、授权、挂牌和发起拍卖 |
| BUYER_1 | 购买、出价、退款以及赔付测试 |
| BUYER_2 | 第二竞价者，也可持有和出售 NFT |
| KEEPER | 独立的自动结算账户 |

每个发送交易的账户准备 SepoliaETH。专用 Keeper 不加入 Safe owners。独立测试者可以自己控制三个不同的测试管理账户、轮流签名，这是角色模拟；实际多人治理应由不同成员各自控制私钥。不要把自己的私钥或助记词交给组员。

## 4. 创建自己的 Sepolia Safe

在 https://app.safe.global/ 连接自己的 ADMIN_1，选择 Ethereum Sepolia 创建 Safe，owners 填自己的 ADMIN_1、ADMIN_2、ADMIN_3，门槛选 2/3。完成实际部署交易并等待确认，不能只停留在生成地址的步骤。

确认 Safe 的网络、三个 owner 和门槛，保存合约地址。地址如带 `sep:` 前缀，填环境配置时去掉前缀。Safe 地址与任何一个 owner 地址都不同。

本项目部署脚本要求 Safe 已有链上代码、至少三个 owners、门槛至少为二。本流程统一使用 2/3。即使独立测试由一个人执行，也要用三个不同地址模拟该规则，不能改成 1/1 后直接沿用本指南。

## 5. 配置本机 .env

取得自己的 Ethereum Sepolia HTTPS RPC。Windows CMD 中执行：

```bat
if not exist .env copy .env.example .env
notepad .env
```

保留其他模板内容，将以下字段填写为自己的真实配置：

```dotenv
SEPOLIA_RPC_URL=自己的Sepolia_HTTPS_RPC
SEPOLIA_PRIVATE_KEY=自己的DEPLOYER私钥
SAFE_ADDRESS=自己的已部署Safe合约地址
CONFIRM_TESTNET_DEPLOY=yes
SETTLER_PRIVATE_KEY=自己的KEEPER私钥
```

这里的中文是说明，必须替换，不是可以直接运行的值。其他管理员和用户通过 MetaMask 签名，不需要把其私钥写入项目。RPC 密钥和私钥不放进 `public` 或 `VITE_` 变量。PowerShell 和 macOS/Linux 的配置命令见 [Sepolia 手册](SEPOLIA.md)。

## 6. 部署业务合约与自己的 NFT 集合

按顺序执行，每条成功后才继续：

```text
npm run compile
npm run deploy:sepolia
npm run deploy:test-assets:sepolia
```

完成后应生成两份自己的配置：

- `deployments/11155111.json`：本机脚本使用，也保留部署恢复信息。
- `public/deployments/11155111.json`：网页定位自己的平台合约。

核心部署完成表示四个业务合约已有地址，不表示 Safe 初始化已完成。不要手写或复制别人的地址来跳过部署。若 RPC 超时，保留清单，按 [恢复说明](VALIDATION.md) 核对交易；不要删除清单或盲目重复发送。

部署测试集合会复用同一请求 ID；铸造每次都会新增 NFT。以下 Windows CMD 命令向自己的 SELLER 铸造一件：

```bat
set /p "NFT_RECIPIENT=Enter your SELLER address: "
set "NFT_MINT_COUNT=1"
npm run mint:sepolia
```

每次成功后记录 Token ID 和交易哈希；确认无未知交易后可重复命令补充测试资产，也可更换接收者。NFT 合约发行权属于其 owner，通常是本次部署者，不因另一个钱包是 Safe owner 就自动获得铸造权。

## 7. 启动网页，并由自己的 Safe 初始化平台

终端一执行 `npm run dev`，保持运行。在浏览器打开实际输出的地址，MetaMask 选择 Sepolia，连接自己的 ADMIN_1。已有完整核心部署和集合后，可以进入“共同管理”进行初始化。

以下四项分别生成预览和 Safe JSON，由自己的 Safe 执行：

| 操作 | 参数来源 |
|---|---|
| 路由：一次性绑定准备金 | 自己清单中的 `contracts.RiskReserve` |
| 市场：启用整个集合 | 自己清单中测试 NFT 集合地址，启用值 `true` |
| 拍卖：启用整个集合 | 同一个自己的 NFT 集合地址，启用值 `true` |
| 拍卖：设置专用自动结算账户 | 自己的 KEEPER 公开地址 |

每一项都按“DApp 填参 → 生成预览 → 下载 JSON → 自己的 Safe Transaction Builder 导入 → 两名 owner 批准同一笔交易 → 执行 → 等待成功 → 回 DApp 刷新”的顺序完成。第二名 owner 批准已有交易，不要重复导入生成另一笔。签名达到门槛仍需要执行交易。

## 8. 验证自己的实例并开启自动结算

保持前端运行，在终端二执行：

```text
npm run validate:sepolia
```

应检查四个合约、自己的 Safe owners 和门槛、集合许可、准备金绑定以及 Keeper。只有四项初始化完成后才应通过严格验证。

随后在终端二运行并保持在线：

```text
npm run settle:sepolia
```

检查服务显示自己的 KEEPER 和 chain ID 11155111。每个平台只需一份结算服务；关闭网页不会代替关闭服务，关闭服务后到期拍卖也不会自动执行交易。只想使用一个终端时，见 [单终端启动说明](VALIDATION.md)，先把前端放到后台，再运行验证和 Keeper。

`npm run demo` 启动的是本地链和本地 Keeper，不能代替上述 Sepolia Keeper。

## 9. 怎样确认“管理员和普通用户都能测”

先用 ADMIN_1 连接，确认有“风险准备金”和“共同管理”；再切 SELLER / BUYER，确认管理页面隐藏，普通交易仍可使用。管理权限来自自己的 Safe，GitHub 账号、钱包显示名和 `.env` 里的文字标签都不能授予权限。

按 [本地测试手册](LOCAL_TESTS.md) 的业务顺序测试，但将所有角色、集合、Token ID 换成自己此次部署的值；Sepolia 不使用本地账户下拉框、不快进时间。先完成买卖，再测试两人竞价、退款、自动结算、领取、费用归集、预算与赔付。

每个人保留自己的 Safe / 合约 / NFT 地址与交易哈希表。共同排查问题时，先确认正在讨论哪一人的部署。不同实例的订单编号可能都从 1 开始，不能只凭编号混用。

## 10. 如何再次分享与更新代码

分享源码时保留 `contracts`、`src`、`scripts`、测试、文档、`package.json`、`package-lock.json`、配置模板和构建配置。移除真实 `.env`、所有部署 JSON 及部署归档、日志和检查点、依赖、构建输出、IDE/Git 元数据、私钥与钱包备份。仅保留部署目录的 `.gitkeep`。不要直接压缩已经跑过测试的整个目录；`.gitignore` 只影响 Git，并不会自动过滤手工压缩。

本包已经按上述范围筛选，并附有文件 SHA-256 清单。接收者应解压到新目录。后续修改文件后，旧 `SHA256SUMS.txt` 不再代表新版本，应重新生成，而不是宣称原校验仍有效。

更新 GitHub 时，只提交经过检查的源码和说明；每个人自己的 `.env`、部署清单与运行数据保留在本机。合约源码改变后不会自动更新链上旧合约，需要单独计划新部署；仅修正文档或连接提示不要求重部署已有合约。
