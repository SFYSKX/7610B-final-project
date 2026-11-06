import React from 'react';
import {eth,short,same} from '../../lib/format.mjs';
import {address,amount} from '../../lib/control.mjs';
import {claimArguments,claimRecord} from '../../lib/claims.mjs';
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
 return <div className="claim"><div className="section-head"><h3>申诉 #{String(c.id)} / 事故 #{String(c.incidentId)}</h3><State>{['未知','旧版登记','待审核','已批准','已拒绝','已支付'][Number(c.state)]}</State></div>
  <p>申请人：<code>{c.beneficiary}</code> · 申请 {eth(c.maxLoss)} ETH · 批准 {eth(c.amount)} ETH</p>
  {c.statement&&<p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{c.statement}</p>}
  <p className="small">证据摘要：{c.evidenceHash}</p>
  {Number(c.state)===4&&<p className="small">拒绝理由摘要：{c.reasonHash}</p>}
  {same(c.beneficiary,s.account)&&Number(c.state)===3&&<Form fields={[f('recipient','赔付接收地址',s.account)]} submit="领取赔付" disabled={disabled} onSubmit={v=>guarded(()=>tx('领取赔付',r,'claimPayout',[c.id,address(v.recipient)]))}/>}
 </div>;
}
export function MyClaims({s,data,tx,guarded,disabled}){
 if(data.isAdmin)return null;
 const props={s,data,tx,guarded,disabled};
 const open=data.incidents.filter(i=>!i.closed&&data.time<Number(i.claimDeadline));
 return <><section className="panel claim-submission"><h2>用户申诉</h2>

   <p>针对管理员已开放的事故自主提交，无需先登记赔付资格。每个账户对同一事故只可提交一次；提交不表示已获赔。</p>
   <p className="muted">下方关联记录、原因和证据说明将公开上链，合计最多 1024 个 UTF-8 字节。证据事实与损失金额仍需管理员审核。</p>
   <div>{open.map(i=><p key={i.id}>可申请事故 #{String(i.id)} · 预算 {eth(i.budget)} ETH · 截止 {date(i.claimDeadline)}</p>)}{!open.length&&<p>暂无近期开放事故。已有事故可使用管理员公布的事故 ID；合约会检查有效期。</p>}</div>
   <Form fields={[f('incident','事故 ID',open[0]?.id??''),f('reference','关联订单 / 拍卖 / 交易记录'),f('requested','申请赔付金额 ETH',''),f('reason','申诉原因'),f('evidence','证据说明或链接')]} submit="提交申诉" disabled={disabled||data.pausedR} onSubmit={values=>guarded(()=>tx('提交申诉',s.contracts.RiskReserve,'submitClaim',claimArguments(values)))}/>
   {data.pausedR&&<p role="status">新增申诉已暂停；已批准的赔付仍可领取。</p>}
 </section><section className="panel"><h2>我的申诉与赔付</h2>{data.claims.filter(c=>same(c.beneficiary,s.account)).map(c=><ClaimCard key={c.id} {...props} c={c}/>)}<RecordLookup s={s} block={data.block} label="查询我的申诉 ID" read={async(id,o)=>{const c=await s.contracts.RiskReserve.getClaim(id,o);if(c.state===0n||!same(c.beneficiary,s.account))throw Error('当前账户没有这项申诉');return claimRecord(c);}}>{c=><ClaimCard {...props} c={c}/>}</RecordLookup></section></>;
}
export default function Reserve({s,data,tx,guarded,disabled}){
 const r=s.contracts.RiskReserve,common={s,data,tx,guarded,disabled};
 if(!data.isAdmin)return <Empty>此页面仅对管理员开放，请到“我的申诉”处理自己的申请。</Empty>;
 return <><section className="panel reserve-hero"><span className="eyebrow">VISIBLE FUNDS / LIMITED COVERAGE</span><h2>每笔预留，都有明确用途。</h2><p>独立准备金用于审核通过的限定事故。普通退款、卖款不进入准备金；不承保价格下跌、个人密钥泄露或普通失败交易 Gas。</p>
 <div className="stats"><div><span>总余额</span><strong>{eth(data.rb)}</strong></div><div><span>事故预留</span><strong>{eth(data.reserved)}</strong></div><div><span>尚可分配</span><strong>{eth(data.available)}</strong></div></div>
 <Form fields={[f('amount','注入测试 ETH','0.1')]} submit="向准备金注资" disabled={disabled} onSubmit={v=>guarded(()=>tx('准备金注资',r,'deposit',[],{value:amount(v.amount)}))}/></section>
 <section className="panel"><h2>公开事故预算</h2>{data.incidents.map(i=><IncidentRow key={i.id} {...common} i={i}/>)}{!data.incidents.length&&<Empty>暂无登记事故。测试时由多人审批创建模拟案例。</Empty>}</section>
 <RecordLookup s={s} block={data.block} label="查询任意事故 ID" read={async(id,options)=>{const i=await r.getIncident(id,options);if(i.budget===0n)throw Error('事故不存在');return i.toObject();}}>{i=><IncidentRow {...common} i={i}/>}</RecordLookup>
 <section className="panel"><h2>用户申诉审核</h2><p className="muted">用户自主提交，管理员在“共同管理”按申诉 ID 多签批准或拒绝。申请金额不代表已确认损失，累计批准金额仍受事故预算限制。</p>{data.claims.map(c=><ClaimCard key={c.id} {...common} c={c}/>)}{!data.claims.length&&<Empty>尚无用户申诉。</Empty>}</section>
 <RecordLookup s={s} block={data.block} label="查询任意申诉 ID" read={async(id,options)=>{const c=await r.getClaim(id,options);if(c.state===0n)throw Error('申诉不存在');return claimRecord(c);}}>{c=><ClaimCard {...common} c={c}/>}</RecordLookup>
 </>;
}
