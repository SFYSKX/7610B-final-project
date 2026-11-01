import React from 'react';
import ModuleBoundary from './ModuleBoundary.jsx';
import {isReady,queryLabels} from '../services/queryState.mjs';

export default function FeatureHost({feature,retry,...props}) {
  if(!feature||(feature.adminOnly&&!props.data.isAdmin))return null;
  const failed=feature.dependencies.filter(key=>!isReady(props.data,key));
  if(failed.length)return <section className="panel" role="alert">
    <h2>{feature.label}暂时不可用</h2>
    <p>{failed.map(key=>queryLabels[key]).join('、')}数据读取失败。此模块的操作已暂停，避免使用不完整的余额或状态。</p>
    <button className="secondary" onClick={retry}>重新读取</button>
    <p className="muted">其他已成功读取的模块仍可使用。链上资产不受页面读取失败影响。</p>
  </section>;
  const Component=feature.Component;
  return <ModuleBoundary key={feature.key} label={feature.label}><Component {...props}/></ModuleBoundary>;
}
