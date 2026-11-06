import {createTableFile} from './tabularExport.mjs';

export function receiptRows(receipt) {
  const metadata = receipt.metadata;
  return [
    ['字段','内容'],
    ['交易类型',receipt.kind === 'market' ? '定价成交' : '拍卖成交'],
    ['网络 Chain ID',String(receipt.chainId)],['交易合约',receipt.market],
    ['订单 / 拍卖 ID',receipt.recordId],['NFT 集合地址',receipt.collection],['Token ID',receipt.tokenId],
    ['NFT 名称',metadata?.name || ''],['NFT 描述',metadata?.description || ''],
    ['图片地址',metadata?.image || ''],['属性',metadata ? JSON.stringify(metadata.attributes) : ''],
    ['tokenURI',metadata?.uri || ''],['元数据状态',receipt.metadataStatus],
    ['卖家地址',receipt.seller],['买家地址',receipt.buyer],['NFT 接收地址',receipt.recipient || '尚未领取'],
    ['成交金额 ETH',receipt.gross],['平台手续费 ETH',receipt.fee],['卖家净收入 ETH',receipt.net],
    ['成交交易哈希',receipt.hash],['成交区块',String(receipt.block)],['区块哈希',receipt.blockHash],
    ['成交时间 UTC',receipt.time],['成交交易 Gas 用量',receipt.gasUsed],
    ['成交交易 Gas 费用 ETH',receipt.gasFee],['Gas 支付账户',receipt.gasPayer],
    ['NFT 交付状态',receipt.delivery],['NFT 交付交易哈希',receipt.deliveryHash],
    ['读取快照区块',String(receipt.snapshot)],['导出时间 UTC',receipt.exportedAt]
  ];
}

export function createReceiptFile(receipt,format) {
  const base = `trade-${receipt.chainId}-${receipt.kind}-${receipt.recordId}-${receipt.hash.slice(2,10)}`;
  return createTableFile(receiptRows(receipt),format,{base,sheetName:'交易凭证',widths:[27,94]});
}
