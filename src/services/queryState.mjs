export const queryLabels=Object.freeze({
  market:'交易市场',auction:'公开拍卖',reserve:'准备金与赔付',assets:'NFT 资产',
  identity:'管理身份',governance:'共同管理提案',fees:'手续费归集'
});
export function isReady(data,key){return data?.modules?.[key]?.status==='ready';}
