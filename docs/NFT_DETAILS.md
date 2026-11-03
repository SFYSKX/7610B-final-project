# NFT 详情展示

在“我的已知资产”、市场订单和拍卖卡片中显示 NFT 元数据图片，展开“查看 NFT 详情”可查看名称、描述、属性、完整集合地址、Token ID，以及可用的原始元数据链接。

通过 ERC721 `tokenURI` 读取元数据；支持 HTTP(S)、IPFS（默认公共网关 `https://ipfs.io/ipfs/`）、URL 编码与 Base64 编码的 JSON data URI。图片支持 HTTP(S)、IPFS、相对元数据地址和常见 image data URI。描述以纯文本展示，不执行 HTML。

元数据读取独立于资产和交易状态：10 秒超时、1 MB JSON 上限、切换会话或资产时丢弃旧结果。请求不携带浏览器凭据。图片失败显示原占位图，元数据失败可重试。远程服务需要允许浏览器跨域读取；IPFS 网关故障或未固定的内容也可能无法加载。

无需修改或重新部署合约，也不会发起钱包交易或支付 gas。现有 NFT 若没有提供 `image`、`description` 等字段，页面会显示缺失提示，不会为其编造内容。图片来自 NFT 发布者，展示不代表平台认可其内容。

修改文件：
- `src/features/assets/Inventory.jsx`
- `src/features/market/Market.jsx`
- `src/features/auction/Auctions.jsx`
- `src/style.css`
- `test-client/ui.test.mjs`

新增文件：
- `src/components/NFTDetails.jsx`
- `src/services/nftMetadata.mjs`
- `test-client/nftMetadata.test.mjs`
- `docs/NFT_DETAILS.md`

验证：架构检查、元数据读取及异常测试、组件渲染测试、原有前端回归测试和 Vite 构建。没有修改管理员批量分支。
