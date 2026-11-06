import React,{useState,useEffect,useRef} from 'react';
import {connect} from './services/session.mjs';
import {verifyAccess} from './services/login.mjs';
import {localAccounts,LOCAL_ACCOUNTS,workspaceAccess} from './lib/access.mjs';
import {short} from './lib/format.mjs';
import {createGate,friendly} from './lib/control.mjs';
import Login from './components/Login.jsx';
import ActionFeedback from './components/ActionFeedback.jsx';
import PendingPanel from './components/PendingPanel.jsx';
import FeatureHost from './components/FeatureHost.jsx';
import DashboardStats from './components/DashboardStats.jsx';
import useSnapshot from './hooks/useSnapshot.jsx';
import {visibleFeatures} from './features/registry.jsx';
import {isReady,queryLabels} from './services/queryState.mjs';
import {submitTransaction,pendingStore,inspectPending} from './services/transactions.mjs';
import {appendJournal,selectJournal,JOURNAL_KEY} from './services/journal.mjs';

export default function App(){
  const [s,setS]=useState(null),[role,setRole]=useState('user'),[tab,setTab]=useState('market');
  const [localIndex,setLocalIndex]=useState(3),[busy,setBusy]=useState(false),[phase,setPhase]=useState('idle');
  const [message,setMessage]=useState(''),[error,setError]=useState(''),[pending,setPending]=useState(null);
  const [journal,setJournal]=useState([]),[watch,setWatch]=useState([]),[feedback,setFeedback]=useState(null);
  const session=useRef(null),candidate=useRef(null),generation=useRef(0),refresh=useRef(null),gate=useRef(createGate());
  const actionAnchor=useRef(null),access=useRef('checking');
  const data=useSnapshot(s,refresh),store=pendingStore(localStorage);
  const accessState=workspaceAccess(role,data);
  access.current=accessState;

  function captureAction(event){
    const target=event.target.closest?.('form')||event.target.closest?.('button');
    if(target){actionAnchor.current=target;setFeedback(null);}
  }
  function report(e,anchor=actionAnchor.current,context={}){
    const text=friendly(e,context);
    if(anchor?.isConnected)setFeedback({anchor,text});else setError(text);
  }
  function log(entry,current=session.current){
    setJournal(previous=>{
      const next=appendJournal(previous,current,entry);
      try{localStorage.setItem(JOURNAL_KEY,JSON.stringify(next));}catch{}
      return next;
    });
  }
  function clearSession(reason=''){
    generation.current++;
    refresh.current?.stop();
    // 已广播交易保留 provider，直到原交易回执处理结束。
    if(!gate.current.busy)session.current?.provider.destroy();
    candidate.current?.provider.destroy();
    candidate.current=null;session.current=null;access.current='checking';
    setS(null);setPhase('idle');setPending(null);setWatch([]);setMessage('');setError(reason);setFeedback(null);
  }
  useEffect(()=>{
    try{
      const saved=JSON.parse(localStorage.getItem(JOURNAL_KEY)||'[]');
      if(Array.isArray(saved))setJournal(saved);
      // 移除旧版自动登录偏好，保留按账户隔离的待确认交易记录。
      localStorage.removeItem('ledger-local-session');
    }catch{}
    return()=>{generation.current++;refresh.current?.stop();session.current?.provider.destroy();candidate.current?.provider.destroy();};
  },[]);
  useEffect(()=>{setFeedback(null);actionAnchor.current=null;},[s,tab]);

  async function start(mode,index=localIndex,entrance=role){
    if(gate.current.busy)return;
    clearSession();
    const g=generation.current;
    setRole(entrance);setLocalIndex(index);setPhase('connecting');
    let next;
    try{
      next=await connect(mode,index);
      if(g!==generation.current){next.provider.destroy();return;}
      candidate.current=next;setPhase('verifying');
      await verifyAccess(next,entrance);
      if(g!==generation.current){next.provider.destroy();return;}
      candidate.current=null;session.current=next;setS(next);setPhase('idle');
      setTab(entrance==='admin'?'admin':'market');
      try{setPending(store.get(next));}catch{setError('待确认交易记录读取失败，请先核对钱包交易记录。');}
      try{setWatch(JSON.parse(localStorage.getItem(`ledger-watch:${next.chainId}:${next.account}`)||'[]'));}catch{setWatch([]);}
      setMessage(entrance==='admin'?'已进入管理工作区。管理操作仍按原多签规则执行。':'已进入用户工作区。链上状态将自动同步。');
    }catch(e){
      next?.provider.destroy();
      if(g===generation.current){candidate.current=null;setError(friendly(e,{action:'login',mode}));setPhase('idle');}
    }
  }
  useEffect(()=>{
    const wallet=window.ethereum;
    if(!wallet?.on)return;
    const changed=()=>{
      if(session.current?.mode==='wallet'||candidate.current?.mode==='wallet'){
        clearSession('钱包账户、网络或连接状态已改变，请重新选择入口并核验身份。已提交交易的恢复记录已保留。');
      }
    };
    wallet.on('accountsChanged',changed);wallet.on('chainChanged',changed);wallet.on('disconnect',changed);
    return()=>{wallet.removeListener('accountsChanged',changed);wallet.removeListener('chainChanged',changed);wallet.removeListener('disconnect',changed);};
  },[s,phase]);
  useEffect(()=>{
    if(s&&accessState==='denied')clearSession('当前账户的管理员权限已失效，请切换管理钱包，或选择用户入口。');
  },[s,accessState]);

  function chooseRole(next){clearSession();setRole(next);setLocalIndex(next==='admin'?0:3);}
  function savePending(current,value){store.save(current,value);if(session.current===current)setPending(value);}
  async function checkPending(replacement){
    const current=s;
    try{
      if(!current||!pending)return;
      const {hash,state}=await inspectPending(current,pending,replacement,value=>savePending(current,value));
      if(session.current!==current)return;
      if(state==='pending'){setMessage('尚无回执。请在钱包中查看加速、取消或替换交易。');return;}
      savePending(current,null);log({action:pending.action,state,hash},current);
      setMessage(state==='success'?'交易已确认，正在刷新':'交易已回滚，未重发');refresh.current?.request();
    }catch(e){if(session.current===current)setError(friendly(e));}
  }
  async function tx(label,contract,method,args=[],options={}){
    const current=s,anchor=actionAnchor.current;
    try{
      setError('');
      return await submitTransaction({label,contract,method,args,options,session:current},{
        gate:gate.current,getSession:()=>access.current==='ready'?session.current:null,store,
        onPending:(account,value)=>{if(session.current===account)setPending(value);},
        log:entry=>log(entry,current),onMessage:text=>{if(session.current===current)setMessage(text);},
        onBusy:setBusy,refresh:()=>{if(session.current===current)return refresh.current?.request();},locks:navigator.locks
      });
    }catch(e){
      if(session.current===current)report(e,anchor,{method});
      log({action:label,state:'error',detail:friendly(e,{method}).slice(0,300)},current);
    }finally{if(current&&session.current!==current)current.provider.destroy();}
  }
  async function guarded(fn){
    const current=s,anchor=actionAnchor.current;setError('');
    try{return await fn();}catch(e){if(session.current===current)report(e,anchor);}
  }
  function toggleWatch(collection,tokenId){
    if(!s)return;
    const key=`${collection.toLowerCase()}:${tokenId}`;
    const next=watch.includes(key)?watch.filter(value=>value!==key):[...watch,key];
    setWatch(next);localStorage.setItem(`ledger-watch:${s.chainId}:${s.account}`,JSON.stringify(next));
  }

  const disabled=busy||!!pending||phase!=='idle';
  const isAdmin=!!data?.isAdmin,manageAccess=role==='admin'&&isAdmin;
  const visibleJournal=selectJournal(journal,s,manageAccess);
  const visibleTabs=visibleFeatures(isAdmin,!!data?.isIssuer,role);
  const activeFeature=visibleTabs.find(feature=>feature.key===tab);
  const failedModules=data?Object.keys(data.modules).filter(key=>!isReady(data,key)):[];
  useEffect(()=>{
    if(s&&accessState==='ready'&&!activeFeature)setTab(role==='admin'?'admin':'market');
  },[s,accessState,activeFeature,role]);

  if(!s||accessState!=='ready'){
    const loading=!!s&&accessState==='checking';
    const identityError=s&&accessState==='error'?'身份核验暂时失败，工作区已暂停访问。正在重新读取，你也可以重新连接。':'';
    return <Login role={role} localIndex={localIndex} onRoleChange={chooseRole} onIndexChange={index=>{clearSession();setLocalIndex(index);}}
      onConnect={mode=>start(mode)} onCancel={()=>clearSession()} busy={busy||phase!=='idle'||loading}
      phase={busy?'transaction':loading?'loading':phase} error={error||identityError} message={message}/>;
  }

  const accounts=localAccounts(role);
  if(!accounts.some(account=>account.index===localIndex)){
    const current=LOCAL_ACCOUNTS.find(account=>account.index===localIndex);
    if(current)accounts.unshift(current);
  }
  const common={s,data,tx,guarded,disabled};
  return <div className="layout" onClickCapture={captureAction} onSubmitCapture={captureAction}>
    <aside>
      <a className="brand" href="#" onClick={event=>{event.preventDefault();setTab(manageAccess?'admin':'market');}}><span className="brand-mark">L</span><span>Ledger<span className="brand-light"> Market</span></span></a>
      <div className="workspace">{manageAccess?'ADMIN WORKSPACE / 管理端':'USER WORKSPACE / 用户端'}</div>
      <nav aria-label={manageAccess?'管理员导航':'用户导航'}>{visibleTabs.map(({key,label,order})=><button key={key} className={tab===key?'nav active':'nav'} onClick={()=>setTab(key)}><span>{label}</span><small>{order}</small></button>)}</nav>
      <div className="sidebar-note"><span className="dot"/>{manageAccess?'共同管理，权限链上核验':'资产与规则，链上可查'}<p>定价交易 · 公开竞价<br/>多方审批 · 独立准备金</p><small>课程测试网项目 / v2.0</small></div>
    </aside>
    <main>
      <header>
        <div><span className="eyebrow">{manageAccess?'GOVERN TOGETHER. VERIFY ON CHAIN.':'OPEN ASSETS. VISIBLE RULES.'}</span><h1>{activeFeature?.label}</h1></div>
        <div className="connections">
          {s.mode==='local'&&<select aria-label="本地账户" value={localIndex} disabled={disabled} onChange={event=>start('local',Number(event.target.value))}>{accounts.filter(account=>s.accounts[account.index]).map(account=><option key={account.index} value={account.index}>{account.label} · {short(s.accounts[account.index])}</option>)}</select>}
          {isAdmin&&<button className="secondary" disabled={disabled} onClick={()=>start(s.mode,localIndex,manageAccess?'user':'admin')}>{manageAccess?'切换到用户端':'进入管理端'}</button>}
          <button className="secondary" disabled={busy} onClick={()=>clearSession()}>退出登录 / 切换身份</button>
        </div>
      </header>
      <div className="network-row"><span className="dot"/>{s.chainId===31337?'LOCAL 31337':'SEPOLIA'} · {short(s.account)} · 区块 {data.block}<span className="workspace-badge">{manageAccess?'管理员':'用户工作区'}</span><button className="text-btn" onClick={()=>refresh.current?.request()}>同步</button></div>
      {error&&<div className="notice error" role="alert">{error}<button className="text-btn" onClick={()=>setError('')}>关闭</button></div>}
      {message&&<div className="notice" role="status">{busy&&<span className="spinner"/>}{message}</div>}
      {isAdmin&&!manageAccess&&<div className="notice">当前钱包具有管理员权限，现处于用户工作区。管理功能请使用“进入管理端”；申诉资格仍按真实链上身份核验。</div>}
      <PendingPanel s={s} pending={pending} onCheck={checkPending}/>
      {failedModules.length>0&&<div className="notice error" role="status">部分状态暂不可用：{failedModules.map(key=>queryLabels[key]).join('、')}。未读取的余额不会计为零。<button className="text-btn" onClick={()=>refresh.current?.request()}>重试读取</button></div>}
      <DashboardStats data={data} isAdmin={manageAccess}/>
      <FeatureHost key={`${generation.current}:${tab}`} feature={activeFeature} retry={()=>refresh.current?.request()} {...common}
        isAdmin={manageAccess} watch={watch} toggleWatch={toggleWatch} journal={visibleJournal}/>
      <ActionFeedback feedback={feedback} onClose={()=>setFeedback(null)}/>
      <footer>Ledger Market · ERC-721 / ETH · NFT 图片不代表版权或价值承诺 · 测试资产无真实价值</footer>
    </main>
  </div>;
}
