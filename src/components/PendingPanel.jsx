import React from 'react';
import {Form,TxLink,f} from './common.jsx';
export default function PendingPanel({s,pending,onCheck}) {
  if(!pending)return null;
  return <section className="panel"><h3>待确认交易</h3>
    <p>{pending.action} · <TxLink s={s} hash={pending.hash}/></p>
    <button className="secondary" onClick={()=>onCheck()}>检查回执</button>
    <Form fields={[f('hash','钱包中的替换交易哈希')]} submit="核对替换交易" onSubmit={v=>onCheck(v.hash)}/>
    <p className="muted small">刷新页面不会重发。若钱包已加速或取消，可提供同 nonce 的替换哈希。</p>
  </section>;
}
