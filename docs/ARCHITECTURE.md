# 模块架构与维护

## 系统组成

系统由静态 React 前端、独立 Solidity 合约和 Node.js 自动结算服务组成，没有数据库或传统业务后端。MetaMask 承担公共网络签名，RPC 提供读写链接口。部署脚本根据当前网络生成公开配置，前端按 chain ID 加载。

```text
App / 会话与导航
  ├─ features 注册表 → FeatureHost → ModuleBoundary → 业务页面
  ├─ useSnapshot → 分模块只读查询 → ethers / RPC
  └─ 交易接口 → 校验与模拟 → 钱包签名 → 待确认恢复 → 刷新

独立 Keeper → 授权检查与到期扫描 → AuctionHouse
业务合约 → ERC-721 托管 / 资金负债 / 固定费用路由 / 事故预算
```

| 路径 | 责任 |
|---|---|
| `src/App.jsx` | 钱包事件、会话、导航、提示与任务组装 |
| `src/services/session.mjs` | 本地/钱包连接，网络、部署身份、API 版本和管理员检查 |
| `src/hooks/useSnapshot.jsx` | 刷新生命周期，避免旧会话响应覆盖新账户 |
| `src/services/queries/` | 市场、拍卖、准备金、资产、身份、提案、费用查询 |
| `src/services/queryState.mjs` | 模块读取状态与中文名称 |
| `src/services/transactions.mjs` | 预检、提交、回执、pending 和替换交易恢复 |
| `src/services/journal.mjs` | 浏览器操作日志及账户过滤 |
| `src/services/history.mjs` | 分页事件扫描与交易分类 |
| `src/features/registry.jsx` | 功能组件、导航、权限和数据依赖声明 |
| `src/components/FeatureHost.jsx` | 依赖未就绪时限制相关功能 |
| `src/features/admin/AdminCharts.jsx` | 管理员图表；按最新快照展示最近 40 条挂牌/拍卖状态与准备金、待归集费用 |
| `src/components/ModuleBoundary.jsx` | 页面组件错误边界与重试 |
| `src/lib/` | ABI、格式化、校验、错误翻译和业务预检 |
| `contracts/` | 权限、托管、资金隔离和业务状态机 |
| `scripts/` | 部署、资产、验证、本地演示和 Keeper |

`src/lib/client.mjs` 是兼容导出入口。新内部代码应使用具体模块。`npm run check:architecture` 检查循环依赖、基础层反向依赖 UI、功能间直接耦合和兼容入口使用。

## 接口约定

会话 `connect(mode, index)` 返回 provider、signer、account、chainId、config、contracts、accounts 和 mode。切换账户/网络应建立新会话；旧请求不能覆盖新会话数据。

只读查询接口为 `read(session, {block, options})`。一轮查询使用统一 `options.blockTag`，子查询继续传递。各模块负责独立字段：市场 listings/ms/mFee，拍卖 auctions/as/refund/settlementKeeper，准备金 incidents/claims/available/reserved，资产 inventory/collections，身份 isAdmin/isCouncilSigner，治理 proposals/approvals，费用 mp/ap/tr/rr/binding。

快照用 `modules[key]` 标记 ready/error、区块和提示。失败的未知余额不能显示成零或保留为新的成功值。查询超时限制为本地 8 秒、钱包模式 15 秒；迟到结果被忽略，底层 RPC 未必可取消。一轮刷新会等待各模块结果，一个慢模块仍可能影响整体发布时机。

页面写操作统一调用 `tx(label, contract, method, args, options)`。`submitTransaction(request, ports)` 通过注入的会话、存储、门闩、日志与刷新接口运行，便于测试替换依赖。顺序为：账户/网络确认 → 业务预检 → staticCall → estimateGas → 签名广播 → 保存哈希/nonce → 等待回执 → 刷新。业务页面不应绕过统一入口直接发送交易。

功能注册项为 key、label、order、Component、dependencies 和可选 adminOnly。页面接收 s/data/tx/guarded/disabled，私有表单状态保留在模块内。`adminOnly` 只控制显示，链上合约必须自行检查权限。

## 故障范围

准备金读取失败时，准备金和依赖预算的管理页面受限，市场与拍卖可继续。市场读取失败时，资产页挂牌受限，但独立授权和资产查看可继续。身份未知时管理入口隐藏，按普通用户显示记录。页面渲染错误由该模块的错误边界处理。

RPC、钱包和 App 外壳属于共享依赖；首次连接需要所有核心合约版本和 owner 正确，所以不能保证任意故障都完全隔离。手续费路由、预算余额和交易资金也存在真实业务依赖。

## 添加或删除功能

1. 在 `src/features/<feature>/` 添加页面，不直接依赖其他业务页面的内部实现。
2. 新增轮询数据时添加独立查询函数，注册 reader 和字段状态，保持同区块读取。
3. 在功能注册表声明依赖；准备好数据才启用操作。
4. 写操作走统一 tx 接口；中文错误维护在 errors，业务预检维护在 preflight。
5. 为行为和权限边界增加相关测试，运行 `npm test`、`npm run build`，涉及链上流程时使用独立本地节点验收。
6. 下架页面可删除注册项，但旧资金和授权不会消失。保留用户已有权益的退出入口。

修改 Solidity 接口后运行 `npm run compile` 导出 ABI，检查页面调用和部署参数。合约不可原地升级，需要新部署和新清单；旧链状态不会自动迁移。仅前端修改通常无需重新部署合约。

## 安全配置边界

私钥与带密钥 RPC URL 仅保存在操作者本机 `.env`。不要使用 VITE_ 前缀或把它们写入 public 文件。公开部署清单只用于地址发现，不能授予管理员权限。共享源码时排除 `.env`、reports、IDE 元数据、构建和本地节点日志。
