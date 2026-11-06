import React,{useEffect,useRef,useState} from 'react';
import {readTradeReceipt} from '../services/tradeReceipt.mjs';
import {createReceiptFile} from '../lib/receiptExport.mjs';
import {friendly} from '../lib/control.mjs';
import {download} from './common.jsx';

export default function TradeReceipt({s,kind,recordId}) {
  const [format,setFormat] = useState('csv');
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState('');
  const request = useRef(null);
  useEffect(() => {
    setBusy(false);setMessage('');
    return () => {request.current?.abort();request.current = null;};
  },[s,kind,recordId]);
  async function exportReceipt() {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);setMessage('正在核对成交事件、回执和资产信息…');
    const timer = setTimeout(() => controller.abort(),60000);
    try {
      const cancelled = new Promise((_,reject) => controller.signal.addEventListener('abort',
        () => reject(Error('导出超时或会话已切换。')),{once:true}));
      const result = await Promise.race([cancelled,(async() => {
        const receipt = await readTradeReceipt(s,kind,recordId,{signal:controller.signal});
        const file = await createReceiptFile(receipt,format);
        return {receipt,file};
      })()]);
      const {receipt,file} = result;
      if (request.current !== controller) return;
      if (controller.signal.aborted) throw Error('导出超时，请检查 RPC 后重试。');
      download(file.name,file.content,file.type);
      setMessage(receipt.metadata ? '交易凭证已生成。' : '凭证已生成，元数据读取失败，文件中已标明。');
    } catch (error) {
      if (request.current === controller) setMessage(controller.signal.aborted
        ? '导出超时，请检查 RPC 后重试。'
        : friendly(error));
    } finally {
      clearTimeout(timer);
      if (request.current === controller) {request.current = null;setBusy(false);}
    }
  }
  return <div className="trade-receipt">
    <div className="receipt-actions">
      <label>凭证格式<select aria-label="凭证格式" value={format} disabled={busy} onChange={event => setFormat(event.target.value)}>
        <option value="csv">CSV</option><option value="xlsx">Excel (.xlsx)</option>
      </select></label>
      <button type="button" className="secondary" disabled={busy} onClick={exportReceipt}>{busy ? '正在导出…' : '导出交易凭证'}</button>
    </div>
    {message && <p className="small" role="status">{message}</p>}
  </div>;
}
