import React from 'react';
import {id} from 'ethers';
import {eth,short,same} from '../../lib/format.mjs';
import {address,amount} from '../../lib/control.mjs';
import {Form,State,Empty,f,date} from '../../components/common.jsx';
import RecordLookup from '../../components/RecordLookup.jsx';

export function IncidentRow({s,data,tx,disabled,i}){
 return <div className="row"><span>事故 #{String(i.id)}<small>申请截止 {date(i.claimDeadline)} · 审核截止 {date(i.reviewDeadline)}</small><small>政策摘要 {short(i.policyHash)}</small></span>
  <span>预算 {eth(i.budget)}<small>已批准 {eth(i.approved)} / 已支付 {eth(i.paid)} ETH</small></span><State>{i.closed?'已关闭':'开放'}</State>
  {data.isAdmin&&!i.closed&&data.time>=Number(i.reviewDeadline)&&<button disabled={disabled} onClick={()=>tx('关闭事故',s.contracts.RiskReserve,'closeIncident',[i.id])}>释放未批准预算</button>}
 </div>;
}
export function ClaimCard({s,data,tx,guarded,disabled,c}){
 const r=s.contracts.RiskReserve;
 return <div className="claim"><div className="section-head"><h3>权益 #{String(c.id)} / 事故 #{String(c.incidentId)}</h3><State>{['未知','已登记','待审核','已批准','已拒绝','已支付'][Number(c.state)]}</State></div>
  <p>{short(c.beneficiary)} · 上限 {eth(c.maxLoss)} ETH · 批准 {eth(c.amount)} ETH</p>
  {Number(c.state)===4&&<p className="small">拒绝理由摘要：{c.reasonHash}</p>}
  {same(c.beneficiary,s.account)&&Number(c.state)===1&&<Form fields={[f('evidence','证据说明摘要原文（本地计算 hash）')]} submit="提交申请" disabled={disabled||data.pausedR} onSubmit={v=>tx('提交赔付申请',r,'submitClaim',[c.id,id(v.evidence)])}/>}
  {same(c.beneficiary,s.account)&&Number(c.state)===3&&<Form fields={[f('recipient','赔付接收地址',s.account)]} submit="领取赔付" disabled={disabled} onSubmit={v=>guarded(()=>tx('领取赔付',r,'claimPayout',[c.id,address(v.recipient)]))}/>}
 </div>;
}
export function MyClaims({s,data,tx,guarded,disabled}){
 const props={s,data,tx,guarded,disabled};
 return <section className="panel"><h2>我的赔付申请与领取</h2><p>管理员登记受影响权益后，本人在这里提交证据并领取已批准的赔付。</p>{data.claims.filter(c=>same(c.beneficiary,s.account)).map(c=><ClaimCard key={c.id} {...props} c={c}/>)}<RecordLookup s={s} block={data.block} label="查询我的权益 ID" read={async(id,o)=>{const c=await s.contracts.RiskReserve.getClaim(id,o);if(c.state===0n||!same(c.beneficiary,s.account))throw Error('当前账户没有这项权益');return c.toObject();}}>{c=><ClaimCard {...props} c={c}/>}</RecordLookup></section>;
}
export default function Reserve({s,data,tx,guarded,disabled}){
 const r=s.contracts.RiskReserve,common={s,data,tx,guarded,disabled};
 if(!data.isAdmin)return <Empty>此页面仅对管理员开放，请到“我的赔付”处理自己的申请。</Empty>;
 return <><section className="panel reserve-hero"><span className="eyebrow">VISIBLE FUNDS / LIMITED COVERAGE</span><h2>每笔预留，都有明确用途。</h2><p>独立准备金用于审核通过的限定事故。普通退款、卖款不进入准备金；不承保价格下跌、个人密钥泄露或普通失败交易 Gas。</p>
 <div className="stats"><div><span>总余额</span><strong>{eth(data.rb)}</strong></div><div><span>事故预留</span><strong>{eth(data.reserved)}</strong></div><div><span>尚可分配</span><strong>{eth(data.available)}</strong></div></div>
 <Form fields={[f('amount','注入测试 ETH','0.1')]} submit="向准备金注资" disabled={disabled} onSubmit={v=>guarded(()=>tx('准备金注资',r,'deposit',[],{value:amount(v.amount)}))}/></section>
 <section className="panel"><h2>公开事故预算</h2>{data.incidents.map(i=><IncidentRow key={i.id} {...common} i={i}/>)}{!data.incidents.length&&<Empty>暂无登记事故。测试时由多人审批创建模拟案例。</Empty>}</section>
 <RecordLookup s={s} block={data.block} label="查询任意事故 ID" read={async(id,options)=>{const i=await r.getIncident(id,options);if(i.budget===0n)throw Error('事故不存在');return i.toObject();}}>{i=><IncidentRow {...common} i={i}/>}</RecordLookup>
 <section className="panel"><h2>赔付权益与申请</h2><p className="muted">只有登记的受影响账户能申请。政策与证据摘要不证明事实真实性，需线下审核并保留正文。</p>{data.claims.map(c=><ClaimCard key={c.id} {...common} c={c}/>)}{!data.claims.length&&<Empty>尚无权益登记。</Empty>}</section>
 <RecordLookup s={s} block={data.block} label="查询任意权益或申请 ID" read={async(id,options)=>{const c=await r.getClaim(id,options);if(c.state===0n)throw Error('权益不存在');return c.toObject();}}>{c=><ClaimCard {...common} c={c}/>}</RecordLookup>
 </>;
}
