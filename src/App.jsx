import React,{useState,useEffect,useRef} from 'react';
import {connect} from './services/session.mjs';
import {short} from './lib/format.mjs';
import {createGate,friendly} from './lib/control.mjs';
import {CardArt,Empty} from './components/common.jsx';
import ActionFeedback from './components/ActionFeedback.jsx';
import PendingPanel from './components/PendingPanel.jsx';
import FeatureHost from './components/FeatureHost.jsx';
import DashboardStats from './components/DashboardStats.jsx';
import useSnapshot from './hooks/useSnapshot.jsx';
import {features,visibleFeatures} from './features/registry.jsx';
import {isReady,queryLabels} from './services/queryState.mjs';
import {submitTransaction,pendingStore,inspectPending} from './services/transactions.mjs';
import {appendJournal,selectJournal,JOURNAL_KEY} from './services/journal.mjs';
const names=['管理签名者 1','管理签名者 2','管理签名者 3','卖方','买方','竞价者','账户 7','账户 8','账户 9','自动结算专用账户'];
const notifyError=e=>friendly(e);
export default function App(){
 const [s,setS]=useState(null),[tab,setTab]=useState('market'),[localIndex,setLocalIndex]=useState(3),[busy,setBusy]=useState(false),[connecting,setConnecting]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState(''),[pending,setPending]=useState(null),[journal,setJournal]=useState([]),[watch,setWatch]=useState([]);
 const session=useRef(null),generation=useRef(0),refresh=useRef(null),gate=useRef(createGate());
 const data=useSnapshot(s,refresh);
 const store=pendingStore(localStorage);
 const [feedback,setFeedback]=useState(null);const actionAnchor=useRef(null);
 function captureAction(e){const target=e.target.closest?.('form')||e.target.closest?.('button');if(target){actionAnchor.current=target;setFeedback(null);}}
 function report(e,anchor=actionAnchor.current,context={}){const text=friendly(e,context);if(anchor?.isConnected)setFeedback({anchor,text});else setError(text);}
 useEffect(()=>{setFeedback(null);actionAnchor.current=null;},[s,tab]);
 function log(entry){setJournal(prev=>{const next=appendJournal(prev,session.current,entry);try{localStorage.setItem(JOURNAL_KEY,JSON.stringify(next));}catch{}return next;});}
 useEffect(()=>{try{setJournal(JSON.parse(localStorage.getItem(JOURNAL_KEY)||'[]'));const saved=JSON.parse(localStorage.getItem('ledger-local-session')||'null');if(saved&&Number.isInteger(saved.index)&&saved.index>=0&&saved.index<10){setLocalIndex(saved.index);start('local',saved.index);}}catch{}return()=>{generation.current++;refresh.current?.stop();session.current?.provider.destroy();};},[]);
 async function start(mode,index=localIndex){if(gate.current.busy)return;const g=++generation.current;refresh.current?.stop();session.current?.provider.destroy();session.current=null;setS(null);setConnecting(true);setError('');setPending(null);try{const next=await connect(mode,index);if(g!==generation.current){next.provider.destroy();return;}session.current=next;setS(next);try{if(mode==='local')localStorage.setItem('ledger-local-session',JSON.stringify({index}));else localStorage.removeItem('ledger-local-session');setPending(store.get(next));setWatch(JSON.parse(localStorage.getItem(`ledger-watch:${next.chainId}:${next.account}`)||'[]'));}catch{setWatch([]);}setMessage('已连接。链上状态将自动同步。');}catch(e){if(g===generation.current)setError(notifyError(e));}finally{if(g===generation.current)setConnecting(false);}}
 useEffect(()=>{if(s?.mode!=='wallet'||!window.ethereum)return;const reconnect=()=>{if(!gate.current.busy)start('wallet');else setError('账户或网络已改变，请等待交易结果后重新连接。');};window.ethereum.on('accountsChanged',reconnect);window.ethereum.on('chainChanged',reconnect);return()=>{window.ethereum.removeListener('accountsChanged',reconnect);window.ethereum.removeListener('chainChanged',reconnect);};},[s]);
 function savePending(current,value){store.save(current,value);if(session.current===current)setPending(value);}
 async function checkPending(replacement){
  const current=s;
  try{
   if(!current||!pending)return;
   const {hash,state}=await inspectPending(current,pending,replacement,value=>savePending(current,value));
   if(session.current!==current)return;
   if(state==='pending'){setMessage('尚无回执。请在钱包中查看加速、取消或替换交易。');return;}
   savePending(current,null);log({action:pending.action,state,hash});
   setMessage(state==='success'?'交易已确认，正在刷新':'交易已回滚，未重发');refresh.current?.request();
  }catch(e){if(session.current===current)setError(friendly(e));}
 }
 async function tx(label,contract,method,args=[],options={}){
  const anchor=actionAnchor.current;
  try{
   setError('');
   return await submitTransaction({label,contract,method,args,options,session:s},{
    gate:gate.current,getSession:()=>session.current,store,
    onPending:(current,value)=>{if(session.current===current)setPending(value);},
    log,onMessage:setMessage,onBusy:setBusy,refresh:()=>refresh.current?.request(),locks:navigator.locks
   });
  }catch(e){report(e,anchor,{method});log({action:label,state:'error',detail:friendly(e,{method}).slice(0,300)});}
 }
 async function guarded(fn){const anchor=actionAnchor.current;setError('');try{return await fn();}catch(e){report(e,anchor);}}
 function toggleWatch(collection,tokenId){if(!s)return;const key=`${collection.toLowerCase()}:${tokenId}`;const next=watch.includes(key)?watch.filter(k=>k!==key):[...watch,key];setWatch(next);localStorage.setItem(`ledger-watch:${s.chainId}:${s.account}`,JSON.stringify(next));}
 const disabled=busy||!!pending||connecting;
 const common={s,data,tx,guarded,disabled};
 const isAdmin=!!data?.isAdmin;
 const visibleJournal=selectJournal(journal,s,isAdmin);
 const visibleTabs=visibleFeatures(isAdmin);
 const activeFeature=features.find(feature=>feature.key===tab);
 const failedModules=data?Object.keys(data.modules).filter(key=>!isReady(data,key)):[];
 useEffect(()=>{if(activeFeature?.adminOnly&&!isAdmin)setTab('market');},[isAdmin,activeFeature]);
 return <div className="layout" onClickCapture={captureAction} onSubmitCapture={captureAction}><aside><a className="brand" href="#" onClick={e=>{e.preventDefault();setTab('market');}}><span className="brand-mark">L</span><span>Ledger<span className="brand-light"> Market</span></span></a><div className="workspace">NFT EXCHANGE / TESTNET</div><nav>{visibleTabs.map(({key,label,order:n})=><button key={key} className={tab===key?'nav active':'nav'} onClick={()=>setTab(key)}><span>{label}</span><small>{n}</small></button>)}</nav><div className="sidebar-note"><span className="dot"/>资产与规则，链上可查<p>定价交易 · 公开竞价<br/>多方审批 · 独立准备金</p><small>课程测试网项目 / v2.0</small></div></aside><main>
 <header><div><span className="eyebrow">OPEN ASSETS. VISIBLE RULES.</span><h1>{activeFeature?.label}</h1></div><div className="connections">{s?.mode==='local'&&<select aria-label="本地账户" value={localIndex} disabled={disabled} onChange={e=>{const n=Number(e.target.value);setLocalIndex(n);start('local',n);}}>{s.accounts.slice(0,10).map((a,i)=><option key={a} value={i}>{names[i]} · {short(a)}</option>)}</select>}<button className="secondary" disabled={disabled} onClick={()=>start('local')}>本地演示</button><button disabled={disabled} onClick={()=>start('wallet')}>连接 MetaMask</button></div></header>
 <div className="network-row"><span className="dot"/>{s?`${s.chainId===31337?'LOCAL 31337':'SEPOLIA'} · ${short(s.account)} · 区块 ${data?.block??'读取中'}`:'尚未连接 · 请选择本地演示或 MetaMask'}{s&&<button className="text-btn" onClick={()=>refresh.current?.request()}>同步</button>}</div>
 {error&&<div className="notice error" role="alert">{error}<button className="text-btn" onClick={()=>setError('')}>关闭</button></div>}{message&&<div className="notice" role="status">{busy&&<span className="spinner"/>}{message}</div>}
 <PendingPanel s={s} pending={pending} onCheck={checkPending}/>
 {!s?<section className="hero"><div><span className="eyebrow">A MARKET YOU CAN VERIFY</span><h2>每一次流转，<br/>都有可查的记录。</h2><p>购买独立数字资产，参与公开竞价，查看手续费与准备金去向。</p><button onClick={()=>start('local')}>进入本地演示 →</button></div><CardArt tokenId={1} collection="0x0000000000000000000000000000000000000000"/></section>:!data?<Empty>正在读取同一区块的资产与资金状态…</Empty>:<>
 {failedModules.length>0&&<div className="notice error" role="status">部分状态暂不可用：{failedModules.map(key=>queryLabels[key]).join('、')}。未读取的余额不会计为零；管理身份未核验时管理入口隐藏。<button className="text-btn" onClick={()=>refresh.current?.request()}>重试读取</button></div>}
 <DashboardStats data={data}/>
 <FeatureHost key={`${generation.current}:${tab}`} feature={activeFeature} retry={()=>refresh.current?.request()} {...common}
  isAdmin={isAdmin} watch={watch} toggleWatch={toggleWatch} journal={visibleJournal}/>
 </>}
 <ActionFeedback feedback={feedback} onClose={()=>setFeedback(null)}/>
 <footer>Ledger Market · ERC-721 / ETH · NFT 图片不代表版权或价值承诺 · 测试资产无真实价值</footer></main></div>;
}

