import {useEffect,useState} from 'react';
import {createRefresh} from '../lib/control.mjs';
import {snapshot,unavailableSnapshot} from '../services/queries/index.mjs';

/** A stopped session cannot publish late results into the next account's UI. */
export default function useSnapshot(s,refreshRef) {
  const [state,setState]=useState(null);
  useEffect(()=>{
    if(!s){setState(null);return;}
    const publish=data=>setState({session:s,data});
    const controller=createRefresh(()=>snapshot(s),publish,()=>publish(unavailableSnapshot(s)));
    refreshRef.current=controller;
    controller.request();
    const timer=setInterval(()=>controller.request(),s.mode==='local'?2000:5000);
    const focus=()=>controller.request();
    window.addEventListener('focus',focus);
    return()=>{
      clearInterval(timer);controller.stop();window.removeEventListener('focus',focus);
      if(refreshRef.current===controller)refreshRef.current=null;
    };
  },[s,refreshRef]);
  // Account changes render before effect cleanup; never expose the old snapshot.
  return state?.session===s?state.data:null;
}
