import React from 'react';
import {localAccounts} from '../lib/access.mjs';

export default function Login({role,localIndex,onRoleChange,onIndexChange,onConnect,onCancel,busy=false,phase='idle',error='',message=''}){
  const admin=role==='admin';
  const progress=phase==='connecting'?'正在连接账户…':phase==='verifying'?'正在核验链上身份…':phase==='loading'?'身份已核验，正在载入工作区…':'上一笔交易仍在处理中，请稍候…';
  return <main className="login-page">
    <header className="login-header">
      <a className="brand" href="#" onClick={event=>event.preventDefault()}><span className="brand-mark">L</span><span>Ledger<span className="brand-light"> Market</span></span></a>
      <span className="login-network"><span className="dot"/>本地 / Sepolia 测试网</span>
    </header>
    <div className="login-grid">
      <section className="login-intro" aria-labelledby="welcome-title">
        <span className="eyebrow">OPEN ASSETS. VISIBLE RULES.</span>
        <h1 id="welcome-title">每一次流转，<br/>从你的身份开始。</h1>
        <p className="login-lead">连接你的钱包，进入属于你的工作区。<br/>交易数字资产，或与其他管理员共同守护市场。</p>
        <div className="login-ledger" aria-hidden="true">
          <div className="login-ledger-top"><span>LEDGER MARKET</span><span>ERC-721</span></div>
          <div className="login-symbol">L<span>↗</span></div>
          <div className="login-ledger-bottom"><span>资产有归属<br/><strong>每笔流转，有迹可循。</strong></span><span className="login-seal">链上<br/>可查</span></div>
        </div>
        <div className="login-principles"><span>钱包自主控制</span><span>交易公开可查</span><span>管理多方审批</span></div>
      </section>
      <section className="login-panel" aria-labelledby="login-title" aria-busy={busy}>
        <span className="eyebrow">WELCOME TO LEDGER MARKET</span>
        <h2 id="login-title">选择你的入口</h2>
        <p className="login-description">连接 MetaMask，或展开下方“本地演示”直接体验。</p>
        <div className="login-roles" aria-label="选择登录身份">
          <button type="button" className={`login-role ${!admin?'selected':''}`} aria-pressed={!admin} disabled={busy} onClick={()=>onRoleChange('user')}>
            <span className="login-role-top"><span className="login-role-icon" aria-hidden="true">01</span><span className="login-choice" aria-hidden="true"/></span>
            <strong>用户入口</strong><span>管理资产、购买与竞拍<br/>查看记录、提交申诉</span>
          </button>
          <button type="button" className={`login-role ${admin?'selected':''}`} aria-pressed={admin} disabled={busy} onClick={()=>onRoleChange('admin')}>
            <span className="login-role-top"><span className="login-role-icon" aria-hidden="true">02</span><span className="login-choice" aria-hidden="true"/></span>
            <strong>管理员入口</strong><span>管理规则与风险准备金<br/>审核申诉、共同审批</span>
          </button>
        </div>
        {error&&<div className="notice error" role="alert">{error}</div>}
        {message&&!busy&&<div className="notice" role="status">{message}</div>}
        {busy&&<div className="login-progress" role="status"><span className="spinner"/>{progress}</div>}
        <button type="button" className="login-connect" disabled={busy} onClick={()=>onConnect('wallet')}>{admin?'连接管理钱包':'连接钱包进入'}<span aria-hidden="true">↗</span></button>
        <p className="login-permission">使用 MetaMask 当前选择的网络。{admin?'管理员身份将根据链上管理权限核验。':'登录只读取账户和链上身份，不发送交易。'}</p>
        <details className="login-demo">
          <summary>本地演示<span>无需 MetaMask</span></summary>
          <div className="login-demo-body">
            <label>演示账户<select aria-label="登录演示账户" value={localIndex} disabled={busy} onChange={event=>onIndexChange(Number(event.target.value))}>{localAccounts(role).map(account=><option key={account.index} value={account.index}>{account.label}</option>)}</select></label>
            <button type="button" className="secondary" disabled={busy} onClick={()=>onConnect('local')}>{admin?'进入管理员演示':'进入用户演示'}<span aria-hidden="true">→</span></button>
            <small>请先启动本地演示服务。此处使用虚拟 ETH 和测试 NFT。</small>
          </div>
        </details>
        {busy&&phase!=='transaction'&&<button type="button" className="text-btn login-cancel" onClick={onCancel}>返回身份选择</button>}
      </section>
    </div>
    <footer className="login-footer"><span>Ledger Market · 课程测试网项目</span><span>测试资产无真实价值</span></footer>
  </main>;
}
