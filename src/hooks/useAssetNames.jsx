import {useEffect,useState} from 'react';
import {loadMetadata} from '../services/nftMetadata.mjs';
import {assetKey} from '../lib/catalog.mjs';

export default function useAssetNames(s, rows, enabled) {
  const [state,setState] = useState(null);
  const [retry,setRetry] = useState(0);
  const keys = [...new Set(rows.map(assetKey))].sort().join('|');
  useEffect(() => {
    if (!enabled) return;
    let active = true, next = 0, failed = 0;
    const controller = new AbortController();
    const assets = keys ? keys.split('|') : [];
    const names = {};
    setState({session:s,keys,names:{},loading:assets.length > 0,failed:0});
    async function worker() {
      while (active && next < assets.length) {
        const key = assets[next++];
        const [collection,tokenId] = key.split(':');
        try {
          const metadata = await loadMetadata({provider:s.provider,collection,tokenId,signal:controller.signal});
          names[key] = metadata.name;
        } catch {
          failed++;
        }
        if (active) setState({session:s,keys,names:{...names},loading:true,failed});
      }
    }
    Promise.all(Array.from({length:Math.min(4,assets.length)},worker)).then(() => {
      if (active) setState({session:s,keys,names:{...names},loading:false,failed});
    });
    return () => {active = false;controller.abort();};
  },[s,keys,enabled,retry]);
  const current = state?.session === s && state.keys === keys ? state : null;
  return {
    names:current?.names || {}, loading:enabled && (!current || current.loading),
    failed:enabled ? current?.failed || 0 : 0, retry:() => setRetry(value => value + 1)
  };
}
