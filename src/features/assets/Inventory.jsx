import React,{useState,useEffect} from 'react';
import {same} from '../../lib/format.mjs';
import {address,amount,integer,tokenId} from '../../lib/control.mjs';
import {Form,CardArt,State,f} from '../../components/common.jsx';
import {isReady} from '../../services/queryState.mjs';
import NFTApproval from './NFTApproval.jsx';
export default function Inventory({s,data,tx,guarded,disabled}){
 const marketReady=isReady(data,'market');
 const defaultCollection=data.collections[0]?.address||'';const [selected,setSelected]=useState(null);const col=selected?.collection||defaultCollection;
 useEffect(()=>setSelected(null),[s]);
 return <><section className="panel"><h2>我的已知资产</h2><p className="muted">自动列出配置的测试集合最近 60 件资产中的持有项。外部集合可通过下方地址与编号操作，不宣称扫描全部 NFT。</p><div className="cards">{data.inventory.filter(t=>same(t.owner,s.account)).map(t=><article className={'asset-card'+(same(selected?.collection,t.collection)&&String(selected?.tokenId)===String(t.tokenId)?' asset-selected':'')} key={t.collection+t.tokenId}><CardArt {...t}/><div className="card-body"><h3>{t.name} #{t.tokenId}</h3><button className="secondary" aria-pressed={same(selected?.collection,t.collection)&&String(selected?.tokenId)===String(t.tokenId)} onClick={()=>setSelected(t)}>{same(selected?.collection,t.collection)&&String(selected?.tokenId)===String(t.tokenId)?'已选择此资产':'选择此资产'}</button></div></article>)}</div></section>
 {selected&&<p className="notice" role="status">已选择 NFT #{String(selected.tokenId)}。下方授权与挂牌表单已填入，可直接选择授权用途。</p>}
 <div className="two-col"><NFTApproval key={'approve'+col+selected?.tokenId} {...{s,data,selected,tx,guarded,disabled}} defaultCollection={defaultCollection}/>
 <section className="panel" key={'list'+col+selected?.tokenId}><h2>02 / 定价挂牌</h2>{!marketReady&&<p role="status">交易市场状态暂不可用，挂牌已暂停；仍可查看资产和管理 NFT 授权。</p>}<Form fields={[f('collection','NFT 合约地址',col),f('token','Token ID',selected?.tokenId??''),f('price','价格 ETH','0.01'),f('hours','有效小时','24')]} submit="托管 NFT 并挂牌" disabled={disabled||!marketReady||data.pausedM} onSubmit={v=>guarded(()=>tx('创建挂牌',s.contracts.Marketplace,'createListing',[address(v.collection),tokenId(v.token),amount(v.price),BigInt(data.time)+integer(v.hours,{min:1n,max:8760n})*3600n]))}/></section></div>
 <section className="panel"><h2>支持的集合</h2>{data.collections.map(c=><div className="row" key={c.address}><span>{c.name}<small>{c.address}</small></span><State>市场 {c.marketAllowed==null?'读取失败':c.marketAllowed?'已启用':'未启用'} / 拍卖 {c.auctionAllowed==null?'读取失败':c.auctionAllowed?'已启用':'未启用'}</State></div>)}</section></>;
}

