import {recent} from './records.mjs';
export async function readAuction(s,{options:o}) {
  const a=s.contracts.AuctionHouse;
  const [count,as,refund,pausedA,aFee,settlementKeeper]=await Promise.all([
    a.auctionCount(o),a.sellerCredit(s.account,o),a.refundCredit(s.account,o),
    a.paused(o),a.feeBps(o),a.settlementKeeper(o)
  ]);
  return {auctions:await recent(count,id=>a.getAuction(id,o)),as,refund,pausedA,aFee,settlementKeeper,counts:{auctions:count}};
}
