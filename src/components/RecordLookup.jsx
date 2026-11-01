import React,{useEffect,useRef,useState} from 'react';
import {integer,friendly} from '../lib/control.mjs';
import {Form,f} from './common.jsx';

// Refresh the requested record on every snapshot block and invalidate old-account responses.
export default function RecordLookup({s,block,label,read,children}){
 const [requested,setRequested]=useState(null),[row,setRow]=useState(null),[loading,setLoading]=useState(false),[error,setError]=useState('');
 const generation=useRef(0),reader=useRef(read);reader.current=read;
 useEffect(()=>{setRequested(null);setRow(null);setError('');},[s]);
 useEffect(()=>{
  const current=++generation.current;setRow(null);
  if(requested===null){setLoading(false);return;}
  setLoading(true);setError('');
  Promise.resolve().then(()=>reader.current(requested.id,{blockTag:block})).then(value=>{
   if(current===generation.current)setRow({id:requested.id,...value});
  }).catch(e=>{if(current===generation.current)setError(friendly(e));}).finally(()=>{if(current===generation.current)setLoading(false);});
  return()=>{generation.current++;};
 },[s,requested,block]);
 function query(values){
  try{const id=integer(values.id,{min:1n});setError('');setRequested({id});}
  catch(e){setError(friendly(e));}
 }
 return <section className="panel"><h2>{label}</h2><p className="muted">不受近期 40 条限制。输入链上记录 ID，确认状态后操作。</p>
  <Form fields={[f('id','记录 ID')]} submit="按 ID 查询" onSubmit={query}/>
  {loading&&<p role="status">正在读取记录…</p>}{error&&<p role="alert">{error}</p>}
  {row&&!loading&&children(row)}
 </section>;
}
