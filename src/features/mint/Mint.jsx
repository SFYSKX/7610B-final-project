import React,{useState} from 'react';
import {Contract,encodeBase64,toUtf8Bytes} from 'ethers';
import {ABIS} from '../../lib/abis.mjs';
import {address,integer} from '../../lib/control.mjs';
import {same} from '../../lib/format.mjs';
import {Form,Empty,f} from '../../components/common.jsx';

export default function Mint({s,data,tx,guarded,disabled}){
 const collections=data.mintable||[],[choice,setChoice]=useState('');
 const selected=collections.find(c=>same(c.address,choice))||collections[0];
 if(!selected)return <Empty>当前账户没有已配置 NFT 集合的铸造权限。铸造权限由 NFT 合约 owner 决定。</Empty>;
 return <section className="panel"><h2>NFT 铸造管理</h2>
  <p>当前账户是所选 NFT 集合的发行者。填写接收地址和数量，在钱包确认后即可铸造。</p>
  <label>发行集合<select aria-label="发行集合" value={selected.address} disabled={disabled} onChange={event=>setChoice(event.target.value)}>{collections.map(c=><option value={c.address} key={c.address}>{c.name||'测试 NFT'} · {c.address}</option>)}</select></label>
  <p className="small">集合地址：<code>{selected.address}</code><br/>发行者：<code>{selected.owner}</code><br/>最近已发行编号：{String(selected.nextTokenId)}</p>
  <Form key={selected.address} fields={[f('recipient','接收钱包地址',s.account),f('count',`铸造数量（1–${selected.limit}）`,'1')]} submit="确认铸造 NFT" disabled={disabled} note={selected.limit===1?'该集合使用原版单件铸造接口，每次可铸造 1 件。':'一次交易最多铸造 10 件；交易失败时整批回滚。'} onSubmit={values=>guarded(()=>{
   const recipient=address(values.recipient),count=integer(values.count,{min:1n,max:BigInt(selected.limit)});
   const nft=new Contract(selected.address,ABIS.DemoNFT,s.provider);
   const uri='data:application/json;base64,'+encodeBase64(toUtf8Bytes(JSON.stringify({name:'Ledger Market test object',description:'Test-only NFT. No real-world rights or value promised.'})));
   return count===1n?tx('铸造 NFT',nft,'mint',[recipient,uri]):tx('批量铸造 NFT',nft,'mintBatch',[recipient,count,uri]);
  })}/>
  <p className="muted small">确认后可在“我的资产”或链上事件中核对编号和接收人。未知结果或待确认时先检查回执，不重复铸造。</p>
 </section>;
}
