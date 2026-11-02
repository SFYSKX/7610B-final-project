import React,{useState,useEffect} from 'react';
import {id,ZeroAddress} from 'ethers';
import {eth,same} from '../../lib/format.mjs';
import {previewManagement} from '../../lib/preflight.mjs';
import {address,amount,integer,tokenId} from '../../lib/control.mjs';
import {Form,TxLink,State,Empty,f,download} from '../../components/common.jsx';
import AdminCharts from './AdminCharts.jsx';

const adminActions={
  marketToken:{label:'市场：禁用或恢复单件 NFT',target:'Marketplace',method:'setTokenBlocked',fields:[f('collection','NFT 集合地址'),f('token','Token ID'),f('blocked','禁用 true / 恢复 false','true')],args:v=>[address(v.collection),tokenId(v.token),boolean(v.blocked)]},
  auctionToken:{label:'拍卖：禁用或恢复单件 NFT',target:'AuctionHouse',method:'setTokenBlocked',fields:[f('collection','NFT 集合地址'),f('token','Token ID'),f('blocked','禁用 true / 恢复 false','true')],args:v=>[address(v.collection),tokenId(v.token),boolean(v.blocked)]},
  keeper:{label:'拍卖：设置专用自动结算账户',target:'AuctionHouse',method:'setSettlementKeeper',fields:[f('keeper','专用结算账户地址')],args:v=>[address(v.keeper)]},
  settle:{label:'拍卖：多签应急结算',target:'AuctionHouse',method:'settleAuction',fields:[f('id','已到期拍卖 ID')],args:v=>[integer(v.id,{min:1n})]},
  marketCollection:{label:'市场：启用或停用整个集合（全部 NFT）',target:'Marketplace',method:'setCollection',fields:[f('collection','集合地址'),f('enabled','启用 true / false','true')],args:v=>[address(v.collection),boolean(v.enabled)]},
  auctionCollection:{label:'拍卖：启用或停用整个集合（全部 NFT）',target:'AuctionHouse',method:'setCollection',fields:[f('collection','集合地址'),f('enabled','启用 true / false','true')],args:v=>[address(v.collection),boolean(v.enabled)]},
  marketFee:{label:'市场：未来订单费率',target:'Marketplace',method:'setFeeBps',fields:[f('bps','费率 bps（100 = 1%）','100')],args:v=>[integer(v.bps,{max:500n})]},
  auctionFee:{label:'拍卖：未来拍卖费率',target:'AuctionHouse',method:'setFeeBps',fields:[f('bps','费率 bps','100')],args:v=>[integer(v.bps,{max:500n})]},
  marketPause:{label:'市场：暂停新增交易',target:'Marketplace',method:'setPaused',fields:[f('paused','暂停 true / false','true')],args:v=>[boolean(v.paused)]},
  auctionPause:{label:'拍卖：暂停创建与出价',target:'AuctionHouse',method:'setPaused',fields:[f('paused','暂停 true / false','true')],args:v=>[boolean(v.paused)]},
  reservePause:{label:'准备金：暂停新增风险',target:'RiskReserve',method:'setPaused',fields:[f('paused','暂停 true / false','true')],args:v=>[boolean(v.paused)]},
  bind:{label:'路由：一次性绑定准备金',target:'FeeRouter',method:'setReserveOnce',fields:[f('reserve','准备金地址')],args:v=>[address(v.reserve)]},
  incident:{label:'准备金：登记事故预算',target:'RiskReserve',method:'openIncident',fields:[f('policy','政策正文或说明（计算 hash）'),f('budget','事故预算 ETH（不得超过当前可分配余额）',''),f('claim','申请窗口分钟','60'),f('review','审核窗口分钟（大于申请窗口）','120')],args:(v,d)=>{
    const claim=integer(v.claim,{min:1n,max:500000n});
    const review=integer(v.review,{min:1n,max:525600n});
    if(!v.policy.trim())throw Error('请填写政策说明');
    if(amount(v.budget)>d.available)throw Error(`事故预算超过当前可分配准备金 ${eth(d.available)} ETH。请先注资或归集手续费。`);
    if(review<=claim)throw Error('审核窗口必须大于申请窗口');
    return [id(v.policy),amount(v.budget),BigInt(d.time)+claim*60n,BigInt(d.time)+review*60n];
  }},
  entitlement:{label:'准备金：登记受影响权益',target:'RiskReserve',method:'registerEntitlement',fields:[f('incident','事故 ID'),f('key','唯一损失标识（市场+订单+账户+损失类型）'),f('beneficiary','受影响账户'),f('max','最大净损失 ETH','0.01')],args:v=>[integer(v.incident,{min:1n}),id(v.key),address(v.beneficiary),amount(v.max)]},
  approve:{label:'准备金：批准申请',target:'RiskReserve',method:'approveClaim',fields:[f('claim','权益 / 申请 ID'),f('amount','批准金额 ETH','0.01')],args:v=>[integer(v.claim,{min:1n}),amount(v.amount)]},
  reject:{label:'准备金：拒绝申请',target:'RiskReserve',method:'rejectClaim',fields:[f('claim','申请 ID'),f('reason','拒绝理由（计算 hash）')],args:v=>[integer(v.claim,{min:1n}),id(v.reason)]}
};

function boolean(value){
  if(!['true','false'].includes(value))throw Error('请输入 true 或 false');
  return value==='true';
}

export default function Admin({s,data,tx,guarded,disabled}){
  const [choice,setChoice]=useState('incident');
  const [prepared,setPrepared]=useState(null);
  useEffect(()=>setPrepared(null),[s]);
  const action=adminActions[choice];
  const council=s.contracts.LocalCouncil;

  if(!data.isAdmin)return <Empty>此页面仅对当前管理员开放。</Empty>;

  function decode(proposal){
    for(const [name,contract] of Object.entries(s.contracts)){
      if(!same(contract.target,proposal.target))continue;
      try{
        const decoded=contract.interface.parseTransaction({data:proposal.data});
        return `${name}.${decoded.name}(${Array.from(decoded.args).map(value=>String(value)).join(', ')})`;
      }catch{}
    }
    return proposal.data;
  }

  return <>
    <section className="panel admin-overview">
      <div className="section-head admin-overview-heading">
        <div><span className="eyebrow">ADMIN CONTROL CENTER</span><h2>{council?'本地 2/3 审批演示':'Safe 多签管理'}</h2></div>
        {!council&&<a className="button-link" href={`https://app.safe.global/home?safe=sep:${s.config.admin}`} target="_blank" rel="noreferrer">打开 Safe ↗</a>}
      </div>
      <p className="muted">{council?'LocalCouncil 仅限本地，不是 Safe，不具备生产安全审计。提案者自动批准一次，另一位签名者批准后才可执行。':'管理操作必须通过实际 Safe 达到签名门槛。下方生成目标地址和 calldata，审核后在 Safe Transaction Builder 中提交。'}</p>
      <div className="admin-meta-grid">
        <div className="admin-meta-card"><span>管理地址</span><code>{s.config.admin}</code></div>
        <div className="admin-meta-card"><span>专用自动结算账户</span><code>{data.settlementKeeper||'尚未读取'}</code></div>
        <div className="admin-meta-card"><span>当前可分配准备金</span><strong>{eth(data.available)} ETH</strong></div>
      </div>
      <p className="muted small admin-note">到期后由后台服务提交结算。账户已配置不代表服务正在运行；长时间待结算时，请检查结算终端、网络与 Gas 余额。设置结算账户仍需多签；服务停机时可由多签应急结算。</p>
      <p className="muted small">达到签名门槛后，仍须满足余额与截止时间等条件。单件禁用请选“禁用或恢复单件 NFT”。集合开关影响整个集合的新增托管。</p>
    </section>

    <AdminCharts data={data}/>

    <section className="panel admin-management-panel">
      <div className="section-head"><div><span className="eyebrow">MANAGEMENT ACTIONS</span><h2>管理操作</h2></div><span className="badge">预览后再提交</span></div>
      <div className="admin-action-field"><label>选择管理操作
        <select value={choice} onChange={event=>{setChoice(event.target.value);setPrepared(null);}}>
          {Object.entries(adminActions).map(([key,value])=><option value={key} key={key}>{value.label}</option>)}
        </select>
      </label></div>
      <Form key={choice} fields={action.fields} submit="生成操作预览" onSubmit={values=>guarded(async()=>{
        setPrepared(null);
        const latest=await s.provider.getBlock('latest');
        const available=await s.contracts.RiskReserve.available({blockTag:latest.number});
        const args=action.args(values,{...data,time:latest.timestamp,available});
        const target=s.contracts[action.target].target;
        const callData=s.contracts[action.target].interface.encodeFunctionData(action.method,args);
        await previewManagement(s,target,callData);
        setPrepared({target,data:callData,description:action.label,args:args.map(String),method:action.method});
      })}/>
      {prepared&&<div className="preview">
        <div className="section-head"><div><span className="eyebrow">TRANSACTION PREVIEW</span><h3>{prepared.description}</h3></div><State>待审核</State></div>
        <p>目标：<code>{prepared.target}</code></p>
        <p>参数：<span className="preview-args">{prepared.args.join(' / ')}</span></p>
        <p>ETH value：0</p>
        <textarea readOnly value={prepared.data} aria-label="管理调用 calldata"/>
        <div className="preview-actions">
          <button className="secondary" onClick={()=>download('safe-transaction.json',JSON.stringify({version:'1.0',chainId:String(s.chainId),createdAt:Date.now(),meta:{name:prepared.description,description:'Review target, value and calldata before signing.'},transactions:[{to:prepared.target,value:'0',data:prepared.data,contractMethod:null,contractInputsValues:null}]},null,2),'application/json')}>下载 Safe 交易 JSON</button>
          {council&&<button disabled={disabled||!data.isCouncilSigner} onClick={()=>guarded(async()=>{
            await previewManagement(s,prepared.target,prepared.data);
            return tx('提出管理提案',council,'propose',[prepared.target,prepared.data]);
          })}>提出提案（签名者）</button>}
        </div>
      </div>}
    </section>

    {council&&<section className="panel">
      <div className="section-head"><div><span className="eyebrow">LOCAL MULTISIG</span><h2>待审与已执行提案</h2></div><State>{data.proposals.length} 项提案</State></div>
      {data.proposals.map(proposal=><div className="claim proposal-card" key={proposal.id}>
        <div className="section-head"><h3>提案 #{proposal.id}</h3><State>{proposal.executed?'已执行':`${proposal.approvals}/2 批准`}</State></div>
        <code className="decoded">{decode(proposal)}</code>
        {!proposal.executed&&<div className="actions">
          <button disabled={disabled||!data.isCouncilSigner||data.approvals[proposal.id]} onClick={()=>tx('批准管理提案',council,'approve',[proposal.id])}>批准此提案</button>
          <button className="secondary" disabled={disabled||!data.isCouncilSigner||proposal.approvals<2n} onClick={()=>tx('执行管理提案',council,'execute',[proposal.id])}>执行已批准操作</button>
        </div>}
      </div>)}
      {!data.proposals.length&&<Empty>暂无管理提案。</Empty>}
    </section>}

    <section className="panel">
      <div className="section-head"><div><span className="eyebrow">FEE ROUTING</span><h2>手续费归集</h2></div></div>
      <p className="muted">仅当前管理员可触发固定方向归集；执行者承担 Gas。预算与业务设置仍需多签审批。用户卖款和竞价退款不在这些余额内。</p>
      <div className="fund-grid">
        {[
          ['市场待归集',data.mp,()=>tx('市场费用归集',s.contracts.Marketplace,'flushFees')],
          ['拍卖待归集',data.ap,()=>tx('拍卖费用归集',s.contracts.AuctionHouse,'flushFees')],
          ['待入准备金',data.rr,()=>tx('归集准备金',s.contracts.FeeRouter,'flushReserve')],
          ['经营收入待领',data.tr,()=>tx('经营收入支付至多签',s.contracts.FeeRouter,'withdrawTreasury')]
        ].map(([label,value,run])=><div key={label}>
          <span>{label}</span><strong>{eth(value)} ETH</strong>
          <button className="secondary" disabled={disabled||value===0n} onClick={run}>执行归集</button>
        </div>)}
      </div>
      <p className="small muted admin-binding">准备金绑定：{data.binding===ZeroAddress?'尚未绑定':data.binding}</p>
    </section>
  </>;
}
