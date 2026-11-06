# 使用自己的账户部署到 Sepolia

首次独立部署可先按 [每人独立部署指南](INDEPENDENT_DEPLOYMENT.md) 确认账户、目录和执行顺序，再查阅本文的跨终端命令与详细说明。多人独立部署时，各自使用自己的 Safe 和合约清单；都连接 Sepolia 不代表共用一个平台。

部署前请先阅读 [项目介绍与业务流程](PROJECT_OVERVIEW.md)，确认各角色、资金流和 Keeper 的运行责任，并建议先完成一次本地演示。

本包不含任何现成部署清单或管理地址。以下流程会在接收者的 Safe 下部署独立平台。所有地址从自己的钱包、Safe 和部署输出取得。

## 1. 准备钱包和 RPC

按 [账户文档](ACCOUNTS.md) 分配 DEPLOYER、三名 ADMIN、SELLER、两名 BUYER 和 KEEPER。DEPLOYER 可以兼任一名管理员。每个发交易的账户都需要 SepoliaETH；领取款项和自动结算同样需要 Gas。

从自己的 RPC 服务商取得 Ethereum Sepolia HTTPS 接口，chain ID 必须为 **11155111**。例如 Alchemy 的接口形状为 `https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY`；`YOUR_API_KEY` 必须替换为自己的值。也可以使用其他支持 Sepolia 的服务。MetaMask 网络显示的域名可能不是可直接用于脚本的完整接口。

MetaMask 管理用户交易；部署脚本和 Keeper 使用本机配置签名。只导出这两个专用测试账户的 EVM 私钥到自己的 `.env`，其他钱包私钥无需写入项目。不要上传 `.env` 或将秘密放入 `VITE_` 变量。

## 2. 创建自己的 Safe

从 https://app.safe.global/ 进入，连接自己的 ADMIN_1，创建 Sepolia Safe。添加 ADMIN_1、ADMIN_2、ADMIN_3，门槛选 2/3。实际完成 Safe 的部署交易；仅生成待部署地址不够。检查网络、owner 列表和门槛，复制新 Safe 合约的 `0x...` 地址。

Safe 的创建与本项目合约的部署分别进行。Safe owner 可在钱包中签名，但普通 signer 地址不能代替 Safe 地址配置为平台管理员。Keeper 无需加入 Safe owners。

## 3. 配置自己的环境

先在项目根目录执行 `npm ci`。Windows CMD：

```bat
if not exist .env copy .env.example .env
notepad .env
```

PowerShell：

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
notepad .env
```

macOS/Linux：

```sh
test -f .env || cp .env.example .env
```

用文本编辑器填写这些字段，右侧说明必须替换为实际值：

```dotenv
SEPOLIA_RPC_URL=自己的Ethereum_Sepolia_HTTPS_RPC地址
SEPOLIA_PRIVATE_KEY=自己的DEPLOYER私钥
SAFE_ADDRESS=自己的已部署Safe合约地址
CONFIRM_TESTNET_DEPLOY=yes
SETTLER_PRIVATE_KEY=自己的KEEPER私钥
```

Safe 地址去掉 `sep:` 前缀。私钥可以使用 `0x` 加 64 位十六进制字符的格式；不是公开地址、钱包密码或助记词。配置模板默认部署确认值为 `no`，由操作者确认后修改。

可先只读检查 RPC：

```text
node --env-file=.env -e "fetch(process.env.SEPOLIA_RPC_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'eth_chainId',params:[]})}).then(r=>r.json()).then(d=>console.log(d.result ? 'Chain ID: '+Number(d.result) : 'RPC returned an error')).catch(()=>console.log('RPC connection failed'))"
```

正确结果是 `Chain ID: 11155111`。该查询不发送交易。

## 4. 部署自己的业务合约和测试集合

逐条执行，每条成功后再继续：

```text
npm run compile
npm run deploy:sepolia
npm run deploy:test-assets:sepolia
```

核心合约由 DEPLOYER 部署，管理员直接设为自己的 Safe。脚本生成 `deployments/11155111.json` 和 `public/deployments/11155111.json`；前者供脚本使用，后者供前端使用。保存合约地址和部署交易哈希。

查看公开字段：

```text
node -e "const d=require('./deployments/11155111.json'); console.log(JSON.stringify({chainId:d.chainId,admin:d.admin,contracts:d.contracts,collections:d.collections},null,2))"
```

NFT 集合部署默认请求名为 `demo-v1`，同请求重跑会复用已确认集合。重复铸造不具备这种语义。部署超时、结果未知或提示已有部署时，先按 [恢复说明](VALIDATION.md) 查询，不能删除清单强行重新发交易。

## 5. 给自己的 SELLER 铸造资产

NFT owner 可在网页“铸造管理”填写接收地址和数量，无需命令。下列 CLI 仍可用，记录每个 Token ID 和哈希。Windows CMD：

```bat
set /p "NFT_RECIPIENT=Enter your SELLER public address: "
set "NFT_MINT_COUNT=1"
npm run mint:sepolia
```

PowerShell：

```powershell
$env:NFT_RECIPIENT = Read-Host 'Enter your SELLER public address'
$env:NFT_MINT_COUNT = '1'
npm run mint:sepolia
```

POSIX shell：

```sh
printf 'Enter your SELLER public address: '
read NFT_RECIPIENT
export NFT_RECIPIENT
export NFT_MINT_COUNT=1
npm run mint:sepolia
```

成功后可再次运行，直到有足够测试资产；同集合可用 token 1–6 安排用例，但以实际编号为准。数量范围是 1–10。超时必须先核对链上 `nextTokenId()`、`ownerOf()`、铸造事件和发行账户待确认交易，再决定补铸数量。当前 DemoNFT 的 `nextTokenId()` 保存的是最近已分配编号，初始为 0。

完成后清除临时变量：CMD 用 `set NFT_RECIPIENT=` 和 `set NFT_MINT_COUNT=`；PowerShell 用 `Remove-Item Env:NFT_RECIPIENT,Env:NFT_MINT_COUNT`；POSIX 用 `unset NFT_RECIPIENT NFT_MINT_COUNT`。

## 6. 启动前端并进行 Safe 初始化

终端一运行 `npm run dev` 并保持运行。浏览器打开实际输出的 URL，用 ADMIN_1 连接 MetaMask，确认 Sepolia。可以在初始化前打开共同管理页面。

以下四项分别生成 Safe JSON 并执行：

| DApp 管理操作 | 填写自己的地址 |
|---|---|
| 路由：一次性绑定准备金 | `contracts.RiskReserve` |
| 市场：启用或停用整个集合（全部 NFT） | `collections` 中本次测试 NFT 地址；启用 `true` |
| 拍卖：启用或停用整个集合（全部 NFT） | 同一个 NFT 地址；启用 `true` |
| 拍卖：设置专用自动结算账户 | 自己的 KEEPER 公开地址 |

每项依次：填写参数 → 生成操作预览 → 核对目标合约、参数、value=0 → 下载 JSON → 在自己的 Safe 的 Transaction Builder 导入 → ADMIN_1 与另一名 owner 批准 → Execute → 等待链上成功 → 回到 DApp 同步。

两名 owner 审核的是同一份交易，不是分别重复导入创建两份。绑定准备金只能执行一次；地址来自自己的部署清单。确认签名数不代表交易已经执行。JSON 包含 calldata，可以在尚未验证源码的合约上使用。

## 7. 验证和启动 Keeper

终端二在同一项目目录中运行：

```text
npm run validate:sepolia
```

只有四项初始化均成功后，严格验证才应通过。核对 Safe owners、门槛、双市场集合许可、准备金绑定、Keeper 和暂停状态都符合自己的安排。

然后在终端二运行：

```text
node scripts/settler.cjs --sepolia
```

保持服务在线，确认日志网络为 11155111、账户为自己的 KEEPER。服务每约 3 秒扫描，到期后支付自己的 Gas 并提交结算；到账仍需要区块确认。Ctrl+C 停止后等命令提示符恢复，再执行其他脚本。

## 8. 用自己的钱包进行业务验收

流程参考 [本地测试](LOCAL_TESTS.md)，但角色全部替换为自己的 MetaMask 账户，NFT 使用自己的实际编号；不使用本地账户下拉框，不调用本地时间快进。

建议顺序：SELLER 定价挂牌/调价 → BUYER_1 购买 → SELLER 领取卖款 → 另件资产撤单 → 15 分钟两人竞拍 → 被超价者退款 → Keeper 到期结算 → 赢家领取 NFT → 卖家领取拍卖卖款 → 无人竞拍/取消 → 管理员归集费用 → 模拟事故与赔付 → 单件禁用、暂停、费率和记录隔离。

Sepolia 事故可设置预算 `0.005`、注资 `0.01`、申请窗口 180 分钟、审核窗口 360 分钟；BUYER_1 在“我的申诉”自主申请 `0.002`，管理员批准 `0.0015`。事故预算、批准/拒绝必须实际通过 Safe 执行，不再登记用户资格，受益人自己提交和领取。仅在审核截止后测试预算释放。

每项保存交易哈希、账户角色、业务 ID、预期与实际结果。失败预检或钱包拒签不代表已产生链上回滚交易。测试网 Gas 和平台成交费分开记录。

## 9. 交给其他参与者

其他普通用户只需前端地址、Sepolia 钱包和测试 ETH，无需拿到 DEPLOYER 私钥。共同调试同一部署时，操作者可共享公开 ABI 与已审阅的部署清单；管理员权限由 Safe 当前 owners 决定。

若另一团队需要独立管理，重新按本文创建自己的 Safe 和部署，而不是用本团队清单直接更换 `SAFE_ADDRESS`。合约的 owner 已固定，修改本地配置不会改变它。
