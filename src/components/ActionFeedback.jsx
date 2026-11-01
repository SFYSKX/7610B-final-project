import React,{useEffect,useState} from 'react';
import {createPortal} from 'react-dom';
// Place feedback beside the form/button that actually initiated the async operation.
export default function ActionFeedback({feedback,onClose}){
 const [host,setHost]=useState(null);
 useEffect(()=>{
  if(!feedback?.anchor?.isConnected){setHost(null);return;}
  const node=document.createElement('div');
  node.className='action-feedback-slot';
  feedback.anchor.insertAdjacentElement('afterend',node);setHost(node);
  return()=>node.remove();
 },[feedback]);
 if(!host||!feedback?.anchor?.isConnected)return null;
 return createPortal(<div className="notice error action-error" role="alert">{feedback.text}<button type="button" className="text-btn" onClick={onClose}>关闭</button></div>,host);
}
