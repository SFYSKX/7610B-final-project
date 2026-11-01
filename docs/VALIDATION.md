# 验证、恢复与问题排查

## 可重复执行的检查

在项目根目录完成 `npm ci` 后：

```text
npm test
npm run build
```

`npm test` 顺序运行架构检查、Hardhat 合约/部署测试、客户端测试和工具测试；合约测试使用自己的临时内存链，不是正在运行的 demo 或 Sepolia。以当前输出的实际数量与结果为准。

`npm run build` 编译并导出 ABI，再构建前端；不部署、不铸造。没有部署清单时构建本身仍可成功，但连接业务前必须先部署。编译显示 Nothing to compile 表示已有产物与源码一致，之后 ABI 导出成功即可。

本地完整配置验证：`npm run validate:deployment`。Sepolia 完成四项 Safe 初始化后：`npm run validate:sepolia`。验证会检查代码、API/owner、Router、金库/分账比例、准备金绑定、集合许可和 Keeper；通过不代表 Keeper 在线或所有用户功能都已测试。

`npm run gas:report` 使用临时测试链生成 Gas 参考。`npm run smoke:local` 使用当前配置的本地部署，会新增业务数据并快进 121 秒；只在可丢弃节点运行，不与手动时间边界测试共用链，也不能用于 Sepolia。

## 超时不等于交易失败

`ConnectTimeoutError`、`HeadersTimeoutError` 表示网络连接或响应等待失败。交易可能已经到达节点、甚至已经确认。先保存已有 hash、发送人和 nonce，查询 Sepolia Etherscan 或只读 RPC，再决定如何恢复。

| 操作 | 恢复方式 |
|---|---|
| 核心部署 | 保留清单，检查已记录交易的 receipt 和合约 code；已确认部分可复用，网络恢复后重跑部署继续；未记录 hash 的未知结果还需核对发送账户 nonce/交易 |
| NFT 集合部署 | 同请求 ID 读取检查点；prepared 无 hash 时核对原 nonce 和预期地址，确认原交易后才设置 NFT_DEPLOYMENT_TX；不可换 ID 绕过未知结果 |
| NFT 铸造 | 每次运行都会新增；先查现有编号、ownerOf、事件与待确认交易，确定缺额再补铸 |
| 网页交易 | 保存 pending，点击检查回执；无回执继续等待，不清除缓存假装已取消 |
| 钱包加速/取消 | 核对替换交易来自同一账户且 nonce 相同，再以最终回执和业务状态判断 |
| Keeper 结算 | 保留检查点；已知 hash 等回执，无 hash 的未知发送会停止等待人工核对 |

清单中的 `status=complete` 表示部署结束；它不表示 Safe 初始化完成。不要通过删除部署清单解决重复部署保护。要建立独立新实例，使用独立项目目录和新配置，并保留旧实例访问资料。

## 服务启动问题

- 端口占用：核对 PID 与完整命令行。可使用另一组 demo 端口，不能结束所有 node 进程。
- 找不到部署清单：新包没有预置清单，先完成本地 demo 或自己的 Sepolia 部署。确认在项目根目录执行命令。
- 网络/版本/owner 不匹配：核对钱包 chain ID、活动节点和清单中的部署身份。仅更改 SAFE_ADDRESS 不能改变已部署合约管理员。
- 自动结算等待：检查服务是否运行、KEEPER 地址与私钥是否匹配、账户余额和 RPC；配置验证通过不能证明服务在线。
- 残留 lock：读取锁文件中的 PID，核对原服务确已退出，备份检查点后才移除失效锁。不要删除仍在运行的服务锁。
- 资产未显示：确认账户与网络、集合清单及 Token ID。页面自动显示配置集合最近 60 件资产，旧资产可通过地址/编号操作。
- 预算无法执行：检查实时可分配余额、事故和申请状态、截止时间及累计批准；两票不能绕过这些条件。

## 单终端的可选前端后台启动（Windows CMD）

常规 Sepolia 流程使用两个终端，最便于观察日志。只使用一个终端时，可以把前端放到隐藏后台，再在前台运行 Keeper。下面命令在项目根目录执行，要求 15174 空闲：

```bat
if not exist reports mkdir reports
powershell -NoProfile -Command "$env:CI='true'; $env:FORCE_COLOR='0'; $entry=Join-Path (Get-Location).Path 'node_modules\vite\bin\vite.js'; $stdin=Join-Path (Get-Location).Path 'reports\vite.stdin'; Set-Content -LiteralPath $stdin -Value '' -NoNewline; $argsLine=('{0}{1}{0} --host 127.0.0.1 --port 15174 --strictPort' -f [char]34,$entry); $p=Start-Process -FilePath (Get-Command node.exe).Source -ArgumentList $argsLine -WorkingDirectory (Get-Location).Path -WindowStyle Hidden -RedirectStandardInput $stdin -RedirectStandardOutput 'reports\vite.out.log' -RedirectStandardError 'reports\vite.err.log' -PassThru; $p.Id | Set-Content 'reports\vite.pid'; Write-Host ('Frontend PID: '+$p.Id)"
type reports\vite.out.log
type reports\vite.err.log
```

打开 http://127.0.0.1:15174 。CI 设置使后台 Vite 不绑定键盘快捷键，标准输入也被隔离，因此不会与 CMD 抢输入。日志明确成功后，按 Sepolia 手册初始化和验证，再运行 `node scripts\settler.cjs --sepolia`。

需要输入其他命令时，先 Ctrl+C 正常退出 Keeper，再运行命令并恢复服务。停止后台前端时，以下命令只结束与记录 PID、程序路径和端口匹配的进程：

```bat
powershell -NoProfile -Command "$entry=Join-Path (Get-Location).Path 'node_modules\vite\bin\vite.js'; $vitePid=[int](Get-Content -LiteralPath 'reports\vite.pid'); $p=Get-CimInstance Win32_Process -Filter ('ProcessId='+$vitePid); if($p -and $p.Name -eq 'node.exe' -and $p.CommandLine.Contains($entry) -and $p.CommandLine -match '--port 15174(?:\s|$)'){Stop-Process -Id $vitePid; Remove-Item -LiteralPath 'reports\vite.pid'; Write-Host 'Frontend stopped.'}else{Write-Host 'Process identity mismatch; nothing stopped.'}"
```

不要重复启动或覆盖 PID 记录来处理端口冲突。停止本机服务后，Sepolia 上的资产和记录仍然保留。

## 验收记录模板

```text
网络与 chain ID：
源码版本/压缩包哈希：
Node/npm/操作系统/浏览器/钱包版本：
RPC 服务名称（不含密钥）：
自己部署的 Safe/合约/集合地址：
测试名称与账户角色：
Token、订单、拍卖、事故、权益 ID：
操作与输入：
预期结果：
实际结果：
交易 hash、区块、receipt status：
Gas 与业务金额分别记录：
结论：通过 / 失败 / 等待 / 未测试
截图与证据：
```

自动化断言、人工浏览器操作和真实 Sepolia/Safe 验收分别记录。UI 隐藏按钮只能证明显示规则，链上越权检查应通过对应合约测试验证。不要将未执行的分支标为通过。
