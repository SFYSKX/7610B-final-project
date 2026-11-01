import React from 'react';
import {eth} from '../lib/format.mjs';
import {isReady} from '../services/queryState.mjs';
export default function DashboardStats({data}) {
  const ready=key=>isReady(data,key);
  return <div className="stats">
    <div><span>链上订单</span><strong>{ready('market')?String(data.counts.listings):'暂不可用'}</strong><small>近期 40 条可浏览</small></div>
    <div><span>公开拍卖</span><strong>{ready('auction')?String(data.counts.auctions):'暂不可用'}</strong><small>按链上时间结算</small></div>
    {data.isAdmin?<div><span>可用准备金</span><strong>{ready('reserve')?<>{eth(data.available)} <em>ETH</em></>:'暂不可用'}</strong><small>扣除事故预留</small></div>:
      <div><span>当前身份</span><strong>{ready('identity')?'交易用户':'身份待核验'}</strong><small>交易记录按当前账户显示</small></div>}
    <div><span>我的待领资金</span><strong>{ready('market')&&ready('auction')?<>{eth(data.ms+data.as+data.refund)} <em>ETH</em></>:'暂不可用'}</strong><small>卖款及竞价退款</small></div>
  </div>;
}
