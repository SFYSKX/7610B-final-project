import {recent} from './records.mjs';
export async function readMarket(s,{options:o}) {
  const m=s.contracts.Marketplace;
  const [count,ms,pausedM,mFee]=await Promise.all([
    m.listingCount(o),m.sellerCredit(s.account,o),m.paused(o),m.feeBps(o)
  ]);
  return {listings:await recent(count,id=>m.getListing(id,o)),ms,pausedM,mFee,counts:{listings:count}};
}
