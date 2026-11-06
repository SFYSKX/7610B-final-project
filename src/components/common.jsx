import React from 'react';
import {short} from '../lib/format.mjs';
export const date=t=>new Date(Number(t)*1000).toLocaleString('zh-CN',{hour12:false});
export function download(name,content,type='text/plain'){const u=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),2000);}
export function Form({fields,submit,onSubmit,disabled=false,note,children}){return <form className="form" onSubmit={e=>{e.preventDefault();onSubmit(Object.fromEntries(new FormData(e.currentTarget)));}}><div className="fields">{fields.map(f=><label key={f.name}>{f.label}<input name={f.name} placeholder={f.placeholder||''} defaultValue={f.value??''} required={f.required!==false} type={f.type||'text'} autoComplete="off"/></label>)}</div>{children}{note&&<p className="muted small">{note}</p>}<button disabled={disabled} type="submit">{submit}</button></form>;}
export const f=(name,label,value='',placeholder='')=>({name,label,value,placeholder});
export function CardArt({tokenId,collection}){return <div className={'art art-'+Number(BigInt(tokenId||0)%4n)}><span className="art-caption">DIGITAL OBJECT</span><div className="orb"/><strong>#{String(tokenId).padStart(3,'0')}</strong><span>{short(collection)}</span></div>;}
export function TxLink({s,hash}){return s?.chainId===11155111?<a target="_blank" rel="noreferrer" href={`https://sepolia.etherscan.io/tx/${hash}`}>{short(hash)} ↗</a>:<code title={hash}>{short(hash)}</code>;}
export function State({children}){return <span className="badge">{children}</span>;}
export function Empty({children}){return <div className="empty">{children}</div>;}

