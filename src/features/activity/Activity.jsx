import React from 'react';
import {State,TxLink,download} from '../../components/common.jsx';
export default function Activity({s,journal}) {
  return <section className="panel">
    <div className="section-head"><h2>本账户操作记录（管理员可查看本浏览器全部账户）</h2>
      <button className="secondary" onClick={()=>download('diagnostics.json',JSON.stringify(journal,null,2),'application/json')}>导出日志</button>
    </div>
    <p className="muted">仅显示当前网络、当前部署的记录。未标记账户的旧日志不展示。最多保留 100 条，不远程上传。交易回执与合约状态是最终依据。</p>
    {journal.map((v,i)=><div className="row" key={i}><span>{v.action}<small>{v.at}</small></span>
      <State>{v.state}</State>{v.hash?<TxLink s={s} hash={v.hash}/>:<span className="small">{v.detail}</span>}
    </div>)}
  </section>;
}
