import {Interface,formatEther} from 'ethers';
const custom=new Interface([
 'error ERC721InsufficientApproval(address operator,uint256 tokenId)',
 'error ERC721NonexistentToken(uint256 tokenId)',
 'error ERC721IncorrectOwner(address sender,uint256 tokenId,address owner)',
 'error ERC721InvalidReceiver(address receiver)',
 'error OwnableUnauthorizedAccount(address account)',
 'error AdminOnly()', 'error SettlementOnly()', 'error InvalidPolicy()', 'error InvalidBudget()',
 'error InsufficientBudget(uint256 requested,uint256 availableAmount)'
]);
const reasons={
 'Bid too low':'报价过低，请至少达到当前最低出价。',
 'Invalid budget/policy':'事故预算必须大于零且不超过当前可分配准备金，政策说明不能为空。请先注资或归集手续费，再重新检查预算。',
 'Invalid deadlines':'申请截止时间必须晚于当前链上时间，审核截止必须更晚，且不超过一年。旧提案过期后需要重新发起。',
 'Invalid price':'价格或最小加价必须大于零且不超过合约上限。',
 'Invalid end':'拍卖截止时间必须晚于当前链上时间，持续时间最多 30 天。',
 'Invalid expiry':'挂牌有效期必须晚于当前链上时间，且不超过一年。',
 'Auction not live':'该拍卖已截止、已取消或已结算，不能继续出价。',
 'Invalid bidder':'卖方和当前最高出价者不能参与本轮出价。',
 'Unsupported collection':'此 NFT 集合尚未启用，请联系管理员核对集合设置。',
 'NFT blocked':'这件 NFT 已被管理员禁用，不能新增挂牌、购买或出价。已托管资产仍可取消、结算和领取。',
 'Not NFT owner':'当前账户不是这件 NFT 的持有人，请切换到持有人账户。',
 'Only seller':'只有该订单或拍卖的卖方可以执行此操作。',
 'New business paused':'管理员已暂停新增业务，请稍后重试；已有可领取资金仍可领取。',
 'Not active':'订单已失效、成交或取消，请刷新后查看最新状态。',
 'Stale quote':'卖方已修改订单，请刷新并核对新价格后再购买。',
 'Self purchase':'不能购买自己出售的 NFT。',
 'Exact payment required':'支付金额与最新订单价格不一致，请刷新报价。',
 'Invalid recipient':'接收地址无效，请填写能接收该资产的有效地址。',
 'Payment failed':'接收地址未能收款，本次操作已回滚，原余额仍可领取。',
 'No credit':'当前没有可领取的卖款或经营收入。',
 'No refund':'当前没有可退还的竞价款。',
 'No fees':'当前没有待归集的手续费。',
 'Nothing to route':'暂无待转入准备金的费用，或准备金尚未绑定。',
 'Cannot cancel':'已有出价或拍卖已结束，不能取消。',
 'Not ready':'尚未达到操作时间，或该记录已处理。请同步链上状态。',
 'No NFT entitlement':'当前账户没有此 NFT 的领取权，或已经领取。',
 'No entitlement':'当前账户没有已批准的待领赔付。',
 'Not eligible':'只有登记的受益人可以提交一次申请。',
 'Registration closed':'事故申请期限已过或事故已关闭，不能新增权益。',
 'Invalid entitlement':'权益信息无效：请检查损失标识是否重复、受益人地址和最大损失是否超过事故预算。',
 'Invalid submission':'申请期限已过、事故已关闭或证据为空。',
 'Review closed':'申请不在待审核状态、已过审核期限或事故已关闭。',
 'Over budget':'批准金额超过受益人最大损失或事故剩余预算。',
 'Reason required':'请填写拒绝理由。',
 'Not signer':'只有当前管理员签名者可以执行此操作。',
 'Threshold/not active':'提案尚未达到两票，或已经执行。',
 'Invalid approval':'此账户已批准、提案已执行或提案不存在。',
 'Invalid collection':'集合地址必须是已部署的 NFT 合约地址。',
 'Not ERC721':'该合约不支持 ERC-721 NFT 标准。',
 'Invalid reserve':'准备金已经绑定，或目标合约地址无效。',
 'Fee too high':'手续费不能超过 5%（500 bps）。',
 'Zero amount':'金额必须大于零。',
 'Unexpected NFT':'该合约不接受直接转入 NFT，请使用挂牌或创建拍卖功能。',
 'Custody failed':'NFT 未能转入托管，请核对持有人与授权。'
};
export function friendly(e,context={}){
 const all=[e,e?.error,e?.info?.error,e?.cause].filter(Boolean);
 if(all.some(x=>x.code===4001||x.code==='ACTION_REJECTED'))return '你已取消钱包签名，本次操作未提交。';
 if(all.some(x=>x.code==='INSUFFICIENT_FUNDS'))return '账户 ETH 不足，无法支付本次金额和 Gas。';
 let parsed;
 for(const x of all){for(const data of [x.data,x.data?.data,x.data?.result]){if(typeof data==='string')try{parsed=custom.parseError(data);if(parsed)break;}catch{}}if(parsed)break;}
 const name=parsed?.name||e?.revert?.name,args=parsed?.args||e?.revert?.args||[];
 if(name==='InsufficientBudget')return `准备金不足：本次预算 ${formatEther(args[0])} ETH，当前可分配 ${formatEther(args[1])} ETH。请先注资或归集手续费，再重试；批准票数不会增加余额。`;
 if(name==='ERC721InsufficientApproval')return `尚未授权给${context.method==='createAuction'?'拍卖市场 AuctionHouse':context.method==='createListing'?'交易市场 Marketplace':'本次操作所需的合约'}。请到“我的资产”选择对应授权用途并完成授权；两种市场的授权不能互相替代。`;
 const named={ERC721NonexistentToken:'此集合中不存在该 Token ID，请核对 NFT 合约地址和编号。',ERC721IncorrectOwner:'NFT 持有人已改变，请刷新并核对当前账户。',ERC721InvalidReceiver:'接收地址不能接收 NFT，请改用有效钱包地址。',OwnableUnauthorizedAccount:'此操作必须由管理多签批准并执行。',AdminOnly:'只有当前管理员可以执行此操作。',SettlementOnly:'仅专用自动结算服务或管理多签可以结算拍卖。',InvalidPolicy:'政策说明不能为空。',InvalidBudget:'事故预算必须大于零。'};
 if(named[name])return named[name];
 const texts=all.flatMap(x=>[x.reason,x.shortMessage,x.message]).filter(x=>typeof x==='string');
 for(const [key,value]of Object.entries(reasons))if(texts.some(t=>t.includes(key)))return value;
 if(texts.some(t=>/invalid address|bad address checksum/i.test(t)))return '地址格式不正确，请粘贴完整的 0x 开头地址并核对大小写。';
 if(texts.some(t=>/fetch|network|timeout|connection|could not coalesce|missing response/i.test(t)))return '网络请求未完成，请检查节点连接；若已发送交易，请先核对回执，避免重复提交。';
 const chinese=texts.find(t=>/[\u4e00-\u9fff]/.test(t)&&!t.includes('execution reverted')&&t.length<350);
 return chinese||'操作未成功，链上状态或钱包请求未通过。请同步状态并核对输入后重试；不要重复发送待确认交易。';
}
