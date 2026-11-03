import React from 'react';
import {eth} from '../../lib/format.mjs';

const asBigInt=value=>{
  try{return typeof value==='bigint'?value:BigInt(value??0);}
  catch{return 0n;}
};
const asEthNumber=value=>{
  const number=Number(eth(asBigInt(value)));
  return Number.isFinite(number)?number:0;
};
const formatEth=value=>`${asEthNumber(value).toLocaleString('zh-CN',{maximumFractionDigits:4})} ETH`;
const ratio=(value,total)=>total>0n?Number(value*10000n/total)/100:0;

function StatusBars({items}){
  const max=Math.max(1,...items.map(item=>item.value));
  return <div className="chart-bars" role="img" aria-label="最近读取订单和拍卖状态统计">
    {items.map(item=><div className="chart-bar-row" key={item.label}>
      <span className="chart-bar-label">{item.label}</span>
      <div className="chart-bar-track"><span className={`chart-bar-fill ${item.tone||''}`} style={{width:`${item.value?Math.max(3,item.value/max*100):0}%`}}/></div>
      <strong className="chart-bar-value">{item.value}</strong>
    </div>)}
  </div>;
}

function ReserveDonut({balance,available,reserved}){
  const total=asBigInt(available)+asBigInt(reserved);
  const availablePct=ratio(asBigInt(available),total);
  const reservedPct=ratio(asBigInt(reserved),total);
  const circumference=2*Math.PI*48;
  const availableArc=circumference*availablePct/100;
  const reservedArc=circumference*reservedPct/100;
  return <div className="reserve-chart-layout">
    <div className="reserve-donut" role="img" aria-label={`准备金余额 ${formatEth(balance)}，可用 ${availablePct.toFixed(1)}%，预留 ${reservedPct.toFixed(1)}%`}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r="48" className="donut-track"/>
        {total>0n&&<>
          <circle cx="60" cy="60" r="48" className="donut-available" strokeDasharray={`${availableArc} ${circumference}`} />
          <circle cx="60" cy="60" r="48" className="donut-reserved" strokeDasharray={`${reservedArc} ${circumference}`} strokeDashoffset={-availableArc}/>
        </>}
        <text x="60" y="56" className="donut-center-value">{total>0n?'100%':'—'}</text>
        <text x="60" y="72" className="donut-center-label">资金结构</text>
      </svg>
    </div>
    <div className="reserve-legend">
      <div><span className="legend-dot available"/><span>尚可分配</span><strong>{formatEth(available)}</strong><small>{availablePct.toFixed(1)}%</small></div>
      <div><span className="legend-dot reserved"/><span>事故预留</span><strong>{formatEth(reserved)}</strong><small>{reservedPct.toFixed(1)}%</small></div>
      <p>准备金链上余额：<strong>{formatEth(balance)}</strong></p>
    </div>
  </div>;
}

function FeeBars({items}){
  const values=items.map(item=>asEthNumber(item.value));
  const max=Math.max(0,...values);
  return <div className="fee-chart" role="img" aria-label="当前待归集手续费金额">
    {items.map(item=>{
      const value=asEthNumber(item.value);
      const width=max>0?Math.max(value>0?3:0,value/max*100):0;
      return <div className="fee-chart-row" key={item.label}>
        <div className="fee-chart-heading"><span>{item.label}</span><strong>{formatEth(item.value)}</strong></div>
        <div className="chart-bar-track"><span className={`chart-bar-fill ${item.tone||''}`} style={{width:`${width}%`}}/></div>
      </div>;
    })}
  </div>;
}

export default function AdminCharts({data}){
  const now=Number(data.time??0);
  const listings=Array.isArray(data.listings)?data.listings:[];
  const auctions=Array.isArray(data.auctions)?data.auctions:[];
  const statusItems=[
    {label:'有效挂牌',value:listings.filter(row=>Number(row.status)===1&&Number(row.expiresAt)>now).length,tone:'green'},
    {label:'已成交挂牌',value:listings.filter(row=>Number(row.status)===2).length,tone:'blue'},
    {label:'已撤销挂牌',value:listings.filter(row=>Number(row.status)===3).length,tone:'muted'},
    {label:'进行中拍卖',value:auctions.filter(row=>Number(row.status)===1&&Number(row.endTime)>now).length,tone:'green'},
    {label:'待结算拍卖',value:auctions.filter(row=>Number(row.status)===1&&Number(row.endTime)<=now).length,tone:'amber'},
    {label:'已结算拍卖',value:auctions.filter(row=>Number(row.status)===2).length,tone:'blue'}
  ];
  const feeItems=[
    {label:'市场待归集',value:asBigInt(data.mp),tone:'green'},
    {label:'拍卖待归集',value:asBigInt(data.ap),tone:'blue'},
    {label:'准备金待入账',value:asBigInt(data.rr),tone:'amber'},
    {label:'经营收入待领取',value:asBigInt(data.tr),tone:'muted'}
  ];
  return <section className="admin-analytics" aria-label="管理员数据图表">
    <div className="admin-analytics-heading">
      <div><span className="eyebrow">ON-CHAIN OVERVIEW</span><h2>经营数据概览</h2></div>
      <span className="analytics-snapshot">区块 #{data.block??'—'}</span>
    </div>
    <div className="admin-chart-grid">
      <section className="panel chart-panel chart-panel-wide">
        <div className="chart-heading"><div><h3>业务状态分布</h3><p className="muted small">挂牌与拍卖的当前状态</p></div><span className="chart-caption">最近读取记录</span></div>
        <StatusBars items={statusItems}/>
        <p className="chart-footnote">挂牌和拍卖各统计最近最多 40 条链上记录；不代表全量历史累计值。</p>
      </section>
      <section className="panel chart-panel">
        <div className="chart-heading"><div><h3>准备金资金结构</h3><p className="muted small">可用余额与事故预算预留</p></div></div>
        <ReserveDonut balance={data.rb} available={data.available} reserved={data.reserved}/>
      </section>
      <section className="panel chart-panel">
        <div className="chart-heading"><div><h3>待归集手续费</h3><p className="muted small">按当前合约账户余额分布</p></div></div>
        <FeeBars items={feeItems}/>
        <p className="chart-footnote">各项资金处于不同归集阶段，请以链上余额及交易回执为准。</p>
      </section>
    </div>
  </section>;
}
