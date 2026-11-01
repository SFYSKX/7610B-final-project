import React from 'react';
import {eth,short,same} from '../../lib/format.mjs';
import {address,amount,integer,tokenId} from '../../lib/control.mjs';
import {Form,CardArt,State,Empty,f,date} from '../../components/common.jsx';
import RecordLookup from '../../components/RecordLookup.jsx';

export function AuctionCard({s,data,tx,guarded,disabled,v}){
 const a=s.contracts.AuctionHouse;
 return <article className="asset-card"><CardArt tokenId={v.tokenId} collection={v.collection}/><div className="card-body">
  <h3>拍卖 #{String(v.id)} · NFT #{String(v.tokenId)}</h3><p className="muted">卖方 {short(v.seller)} · {date(v.endTime)}</p>
  <div className="price">{eth(v.highestBid||v.reservePrice)} <span>ETH</span></div>
  <p className="small">{v.highestBid>0n?'最高出价 '+short(v.highestBidder):'尚无出价 / 当前显示底价'}</p>
  <State>{['未知','进行中','已结算','已取消'][Number(v.status)]}{Number(v.status)===1&&data.time>=Number(v.endTime)?' / 待结算':''}</State>
  {Number(v.status)===1&&data.time<Number(v.endTime)&&!same(v.seller,s.account)&&<Form fields={[f('bid','完整出价 ETH',eth(v.highestBid?v.highestBid+v.minIncrement:v.reservePrice))]} submit="提交出价" disabled={disabled||data.pausedA||same(v.highestBidder,s.account)} onSubmit={x=>guarded(()=>tx('拍卖出价',a,'bid',[v.id],{value:amount(x.bid)}))}/>}
  {Number(v.status)===1&&data.time>=Number(v.endTime)&&<p role="status">已截止，等待后台自动结算。若长时间未完成，请联系管理员检查结算服务。</p>}
  {Number(v.status)===1&&same(v.seller,s.account)&&v.highestBid===0n&&<button className="secondary block" disabled={disabled} onClick={()=>tx('取消拍卖',a,'cancelAuction',[v.id])}>取消无出价拍卖</button>}
  {same(v.entitledRecipient,s.account)&&!v.assetClaimed&&<Form fields={[f('recipient','NFT 接收地址',s.account)]} submit="领取 NFT" disabled={disabled} onSubmit={x=>guarded(()=>tx('领取 NFT',a,'claimNFT',[v.id,address(x.recipient)]))}/>}
 </div></article>;
}
export default function Auctions({s,data,tx,guarded,disabled}){
 const a=s.contracts.AuctionHouse,common={s,data,tx,guarded,disabled};
 return <>
 <section className="panel"><div className="section-head"><h2>公开竞价</h2><State>{data.pausedA?'新竞价已暂停':'OPEN AUCTIONS'}</State></div>
  <div className="cards">{data.auctions.map(v=><AuctionCard key={v.id} {...common} v={v}/>)}</div>
  {!data.auctions.length&&<Empty>尚无拍卖。先在资产页授权给拍卖合约，再在下方创建。</Empty>}
 </section>
 <RecordLookup s={s} block={data.block} label="查询任意拍卖 ID" read={async(id,options)=>{const v=await a.getAuction(id,options);if(v.status===0n)throw Error('拍卖不存在');return v.toObject();}}>{v=><AuctionCard {...common} v={v}/>}</RecordLookup>
 <div className="two-col"><section className="panel"><h2>创建拍卖</h2>
  <Form fields={[f('collection','NFT 合约',data.collections[0]?.address||''),f('token','Token ID'),f('reserve','底价 ETH','0.01'),f('increment','最小加价 ETH','0.001'),f('minutes','持续分钟','10')]} submit="托管并创建拍卖" disabled={disabled||data.pausedA} onSubmit={v=>guarded(()=>tx('创建拍卖',a,'createAuction',[address(v.collection),tokenId(v.token),amount(v.reserve),amount(v.increment),BigInt(data.time)+integer(v.minutes,{min:1n,max:43200n})*60n]))}/>
 </section><section className="panel"><h2>我的拍卖资金</h2><p>可退竞价款：{eth(data.refund)} ETH</p>
  <button disabled={disabled||data.refund===0n} onClick={()=>tx('领取竞价退款',a,'withdrawRefund',[s.account])}>退回到当前账户</button><p>可领取卖款：{eth(data.as)} ETH</p>
  <button disabled={disabled||data.as===0n} onClick={()=>tx('领取拍卖卖款',a,'withdrawSellerCredit',[s.account])}>领取拍卖卖款</button><p className="muted small">退款不收平台费，领取需要 Gas。合约也支持本人指定其他可收款地址。</p>
 </section></div></>;
}
