import React,{useEffect,useRef,useState} from 'react';
import {State,TxLink,download} from '../../components/common.jsx';
import {createJournalFile} from '../../lib/journalExport.mjs';
import {friendly} from '../../lib/control.mjs';

export default function Activity({s,journal,isAdmin=false}) {
  const [format,setFormat] = useState('csv');
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState('');
  const pending = useRef(null);
  useEffect(() => {
    setBusy(false);setMessage('');
    return () => {pending.current = null;};
  },[s,isAdmin]);

  async function exportJournal() {
    if (pending.current || !journal.length) return;
    const request = {};
    pending.current = request;
    setBusy(true);setMessage('');
    try {
      const file = await createJournalFile(journal,format,s.chainId);
      if (pending.current !== request) return;
      download(file.name,file.content,file.type);
      setMessage(`已导出 ${journal.length} 条操作记录。`);
    } catch (error) {
      if (pending.current === request) setMessage(friendly(error));
    } finally {
      if (pending.current === request) {pending.current = null;setBusy(false);}
    }
  }

  return <section className="panel">
    <div className="section-head"><h2>本账户操作记录</h2>
      <div className="journal-export-actions">
        <label>日志格式<select aria-label="日志格式" value={format} disabled={busy} onChange={event => setFormat(event.target.value)}>
          <option value="csv">CSV</option><option value="xlsx">Excel (.xlsx)</option>
        </select></label>
        <button className="secondary" disabled={busy || !journal.length} onClick={exportJournal}>{busy ? '正在导出…' : '导出日志'}</button>
      </div>
    </div>
    <p className="muted">仅显示当前网络、当前部署的记录。未标记账户的旧日志不展示。最多保留 100 条，不远程上传。交易回执与合约状态是最终依据。</p>
    <p className="muted small">日志导出包含操作、状态、账户、交易哈希和错误信息。资产、成交金额及手续费可在已成交订单或拍卖的“导出交易凭证”中查看。</p>
    {message && <p role="status" className="small">{message}</p>}
    {journal.map((entry,index) => <div className="row" key={index}><span>{entry.action}<small>{entry.at}</small></span>
      <State>{entry.state}</State>{entry.hash ? <TxLink s={s} hash={entry.hash}/> : <span className="small">{entry.detail}</span>}
    </div>)}
  </section>;
}
