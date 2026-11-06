import React,{useState} from 'react';
import NFTDetails from '../../components/NFTDetails.jsx';
import CatalogFilters,{CatalogSort} from '../../components/CatalogFilters.jsx';
import TradeReceipt from '../../components/TradeReceipt.jsx';
import RecordLookup from '../../components/RecordLookup.jsx';
import useAssetNames from '../../hooks/useAssetNames.jsx';
import {emptyFilters,filterCatalog} from '../../lib/catalog.mjs';
import {eth,short,same} from '../../lib/format.mjs';
import {address,amount,integer} from '../../lib/control.mjs';
import {Form,State,Empty,f,date} from '../../components/common.jsx';

export default function Market({s,data,tx,guarded,disabled,watch,toggleWatch}) {
  const [only,setOnly] = useState('active');
  const [filters,setFilters] = useState({...emptyFilters});
  const m = s.contracts.Marketplace;
  const names = useAssetNames(s,data.listings,!!filters.name.trim());
  const scoped = data.listings.filter(row => only === 'all'
    || only === 'mine' && same(row.seller,s.account)
    || only === 'watch' && watch.includes(`${row.collection.toLowerCase()}:${row.tokenId}`)
    || only === 'active' && Number(row.status) === 1 && Number(row.expiresAt) > data.time);
  let filtered = [], error = '';
  try {filtered = filterCatalog(scoped,filters,{names:names.names});}
  catch (failure) {error = failure.message;}
  return <>
    <section className="panel">
      <h2>发现数字资产</h2><p className="muted">成交费从卖款扣除，当前新单费率 {Number(data.mFee)/100}%。旧订单按自己的快照执行。</p>
      <div className="catalog-toolbar">
        <CatalogSort kind="market" value={filters} onChange={setFilters}/>
        <label>订单范围<select aria-label="订单范围" value={only} onChange={event => setOnly(event.target.value)}>
          <option value="active">可购买</option><option value="mine">我的挂牌</option>
          <option value="watch">已关注</option><option value="all">全部近期订单</option>
        </select></label>
      </div>
      {data.pausedM && <p className="warning">新交易已暂停；撤单和领取卖款仍可进行。</p>}
      <div className="cards">{filtered.map(row => <article className="asset-card" key={row.id}>
        <NFTDetails s={s} tokenId={row.tokenId} collection={row.collection}/>
        <div className="card-body">
          <div className="section-head"><h3>Object #{String(row.tokenId)}</h3>
            <button className="star" aria-label="关注 NFT" onClick={() => toggleWatch(row.collection,row.tokenId)}>{watch.includes(`${row.collection.toLowerCase()}:${row.tokenId}`) ? '★' : '☆'}</button>
          </div>
          <p className="muted">订单 #{String(row.id)} · {short(row.seller)} · v{String(row.revision)}</p>
          <div className="price">{eth(row.price)} <span>ETH</span></div>
          <p className="small">手续费 {eth(row.price*row.feeBps/10000n)} · 卖方净额 {eth(row.price-row.price*row.feeBps/10000n)}</p>
          <p className="muted small">截止 {date(row.expiresAt)}</p>
          <State>{['未知','有效','已成交','已撤销'][Number(row.status)]}{Number(row.status) === 1 && Number(row.expiresAt) <= data.time ? ' / 已到期' : ''}</State>
          {Number(row.status) === 2 && <TradeReceipt s={s} kind="market" recordId={row.id}/>}
          {Number(row.status) === 1 && (same(row.seller,s.account) ? <>
            <button className="secondary block" disabled={disabled} onClick={() => tx('撤单',m,'cancelListing',[row.id,s.account])}>撤单并取回</button>
            {Number(row.expiresAt) > data.time && <details><summary>调整价格和有效期</summary>
              <Form fields={[f('price','新价格 ETH',eth(row.price)),f('hours','从现在起有效小时','24')]} submit="更新订单" disabled={disabled}
                onSubmit={values => guarded(() => tx('更新订单',m,'updateListing',[row.id,row.revision,amount(values.price),BigInt(data.time)+integer(values.hours,{min:1n,max:8760n})*3600n]))}/>
            </details>}
          </> : <button className="block" disabled={disabled || data.pausedM || Number(row.expiresAt) <= data.time}
            onClick={() => tx('购买 NFT',m,'buy',[row.id,row.revision,s.account],{value:row.price})}>以 {eth(row.price)} ETH 购买</button>)}
        </div>
      </article>)}</div>
      {!filtered.length && <Empty>{names.loading ? '正在读取名称，请稍候…' : '当前筛选没有订单。可调整条件或在“我的资产”创建挂牌。'}</Empty>}
    </section>
    <RecordLookup s={s} block={data.block} label="查询任意订单 ID"
      searchControls={<CatalogFilters kind="market" value={filters} onChange={setFilters} total={data.listings.length} count={filtered.length}
        loading={names.loading} failed={names.failed} onRetry={names.retry} error={error}/>}
      read={async(id,options) => {
          const row = await m.getListing(id,options);
          if (row.status === 0n) throw Error('订单不存在');
          return row.toObject();
        }}>{row => <div className="notice">
          #{String(row.id)} · {eth(row.price)} ETH · 状态 {String(row.status)} · 卖方 {short(row.seller)}
          {Number(row.status) === 2 && <TradeReceipt s={s} kind="market" recordId={row.id}/>}
          {Number(row.status) === 1 && (same(row.seller,s.account)
            ? <button disabled={disabled} onClick={() => tx('撤单',m,'cancelListing',[row.id,s.account])}>撤单</button>
            : <button disabled={disabled || data.pausedM || Number(row.expiresAt) <= data.time}
              onClick={() => tx('购买 NFT',m,'buy',[row.id,row.revision,s.account],{value:row.price})}>确认报价并购买</button>)}
        </div>}</RecordLookup>
    <section className="panel"><h2>我的卖款</h2><p>{eth(data.ms)} ETH 可领取，领取不会再次收取平台费。</p>
      <Form fields={[f('recipient','收款地址',s.account)]} submit="领取市场卖款" disabled={disabled || data.ms === 0n}
        onSubmit={values => guarded(() => tx('领取卖款',m,'withdrawSellerCredit',[address(values.recipient)]))}/>
    </section>
  </>;
}
