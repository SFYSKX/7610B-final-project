import React,{useState,useEffect,useRef} from 'react';
import TradeReceipt from '../../components/TradeReceipt.jsx';
import {history} from '../../services/history.mjs';
import {short} from '../../lib/format.mjs';
import {address,tokenId,csvCell} from '../../lib/control.mjs';
import {Form,CardArt,TxLink,State,Empty,f,date,download} from '../../components/common.jsx';
export default function History({s,guarded,isAdmin=false}){
 const [query,setQuery]=useState(null),[result,setResult]=useState(null),[loading,setLoading]=useState(false);const run=useRef(0);
 useEffect(()=>{run.current++;setResult(null);setQuery(null);return()=>{run.current++;};},[s,isAdmin]);
 async function load(q,end){const g=++run.current;setLoading(true);try{await guarded(async()=>{const r=await history(s,q.collection,q.token,end,isAdmin);if(g!==run.current)return;setQuery(q);setResult(prev=>end!=null&&prev?{...r,to:prev.to,rows:[...prev.rows,...r.rows]}:r);});}finally{if(g===run.current)setLoading(false);}}
 return <section className="panel"><div className="section-head"><h2>资产履历（普通账户只显示本人参与的记录）</h2>{result&&<button className="secondary" onClick={()=>download('nft-history.csv','\uFEFF'+[['区块','时间','类型','来源','接收方','ETH价格','交易哈希'],...result.rows.map(r=>[r.block,date(r.time),r.kind,r.from,r.to,r.price,r.hash])].map(row=>row.map(csvCell).join(',')).join('\r\n'),'text/csv;charset=utf-8')}>导出 CSV</button>}</div><Form fields={[f('collection','NFT 合约',s.config.collections[0]?.address||''),f('token','Token ID','1')]} submit={loading?'查询中…':'查询最近区块'} disabled={loading} onSubmit={v=>guarded(()=>load({collection:address(v.collection),token:tokenId(v.token).toString()}))}/><p className="muted">每次扫描最多 2,000 个区块，可继续向前加载。只识别当前部署市场成交价；外部转移不推断价格。重新查询会重新读取链上事件。</p>{result&&<><State>范围 {result.from} — {result.to} · {result.rows.length} 条事件</State><div className="timeline">{result.rows.map(r=><div className="timeline-item" key={r.key}><span className="timeline-dot"/><div><strong>{r.kind}</strong><small>{date(r.time)} · 区块 {r.block}</small><p>{short(r.from)} → {short(r.to)} {r.price&&<b> · {r.price} ETH</b>}</p><TxLink s={s} hash={r.hash}/>{r.tradeKind&&<TradeReceipt s={s} kind={r.tradeKind} recordId={r.recordId}/>}</div></div>)}</div>{!result.rows.length&&<Empty>当前范围没有记录，可向前查询。</Empty>}{result.next!==null&&<button disabled={loading} onClick={()=>load(query,result.next)}>加载更早 2,000 个区块</button>}</>}</section>;
}

