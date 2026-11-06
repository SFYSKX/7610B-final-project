import {formatEther} from 'ethers';
import {integer} from '../lib/control.mjs';
import {same} from '../lib/format.mjs';
import {loadMetadata} from './nftMetadata.mjs';

function checkCancelled(signal) {
  if (signal?.aborted) throw Error('凭证导出已取消。');
}

async function findEvent(s,contract,filter,from,to,signal) {
  const topics = await filter.getTopicFilter();
  let end = to, step = 2000;
  while (end >= from) {
    checkCancelled(signal);
    const start = Math.max(from,end-step+1);
    let logs;
    try {
      logs = await s.provider.getLogs({address:contract.target,topics,fromBlock:start,toBlock:end});
    } catch (error) {
      if (step <= 25) throw Error('链上事件读取失败，请检查 RPC 后重试。');
      step = Math.max(25,Math.floor(step/2));
      continue;
    }
    checkCancelled(signal);
    if (logs.length) return logs.at(-1);
    end = start-1;
  }
  return null;
}

export async function readTradeReceipt(s,kind,recordId,{signal,metadataLoader=loadMetadata}={}) {
  if (!['market','auction'].includes(kind)) throw Error('不支持的交易类型。');
  const id = integer(recordId,{min:1n});
  const chain = await s.provider.getNetwork();
  if (Number(chain.chainId) !== s.chainId) throw Error('网络已切换，请重新连接后导出。');
  const snapshot = await s.provider.getBlockNumber();
  const options = {blockTag:snapshot};
  const contract = kind === 'market' ? s.contracts.Marketplace : s.contracts.AuctionHouse;
  const row = kind === 'market' ? await contract.getListing(id,options) : await contract.getAuction(id,options);
  if (Number(row.status) !== 2 || (kind === 'auction' && row.highestBid === 0n)) {
    throw Error('只有已成交订单或有买家成交的已结算拍卖可以导出交易凭证。');
  }
  const filter = kind === 'market' ? contract.filters.SaleCompleted(id) : contract.filters.AuctionSettled(id);
  const from = Math.max(0,Number(s.config.deploymentBlock || 0));
  const log = await findEvent(s,contract,filter,from,snapshot,signal);
  if (!log) throw Error('当前部署范围内未找到成交事件，请核对部署清单和 RPC。');
  const event = contract.interface.parseLog(log).args;
  const [block,receipt] = await Promise.all([
    s.provider.getBlock(log.blockNumber),s.provider.getTransactionReceipt(log.transactionHash)
  ]);
  if (!block || !receipt || receipt.status !== 1 || receipt.blockHash !== block.hash || log.blockHash !== block.hash) {
    throw Error('成交回执或区块已变化，请同步后重新导出。');
  }
  const gross = kind === 'market' ? event.grossPrice : event.price;
  let recipient = kind === 'market' ? event.recipient : '';
  let deliveryHash = kind === 'market' ? log.transactionHash : '';
  if (kind === 'auction' && row.assetClaimed) {
    const delivery = await findEvent(s,contract,contract.filters.NFTClaimed(id),log.blockNumber,snapshot,signal);
    if (!delivery) throw Error('NFT 已领取，但当前 RPC 未返回交付事件，请重试。');
    recipient = contract.interface.parseLog(delivery).args.recipient;
    deliveryHash = delivery.transactionHash;
  }
  if (!same(event.seller,row.seller)) throw Error('成交事件与记录不一致。');
  let metadata = null;
  try {
    metadata = await metadataLoader({provider:s.provider,collection:row.collection,tokenId:row.tokenId,signal});
  } catch {
    checkCancelled(signal);
  }
  checkCancelled(signal);
  return {
    kind,chainId:s.chainId,market:contract.target,recordId:String(id),
    collection:row.collection,tokenId:String(row.tokenId),seller:event.seller,
    buyer:kind === 'market' ? event.buyer : event.winner,recipient,
    gross:formatEther(gross),fee:formatEther(event.fee),net:formatEther(gross-event.fee),
    hash:log.transactionHash,block:log.blockNumber,blockHash:block.hash,
    time:new Date(block.timestamp*1000).toISOString(),
    gasUsed:String(receipt.gasUsed),gasFee:formatEther(receipt.fee),gasPayer:receipt.from,
    deliveryHash,delivery:recipient ? '已交付' : '等待买家领取 NFT',
    metadata,metadataStatus:metadata ? '导出时读取的元数据' : '元数据读取失败，链上成交信息完整',
    snapshot,exportedAt:new Date().toISOString()
  };
}
