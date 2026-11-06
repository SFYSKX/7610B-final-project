import React,{useState} from 'react';

export function CatalogSort({kind,value,onChange}) {
  return <label className="catalog-sort">排序<select aria-label="排序" value={value.sort} onChange={event => onChange({...value,sort:event.target.value})}>
    <option value="newest">创建时间从新到旧</option>
    <option value="oldest">创建时间从旧到新</option>
    <option value="priceAsc">价格从低到高</option>
    <option value="priceDesc">价格从高到低</option>
    {kind === 'auction' && <><option value="endingSoon">剩余时间从短到长</option><option value="endingLast">剩余时间从长到短</option></>}
  </select></label>;
}

export default function CatalogFilters({kind,value,onChange,total,count,loading,failed,onRetry,error}) {
  const [draft,setDraft] = useState(value);
  const update = event => setDraft({...draft,[event.target.name]:event.target.value});
  const search = event => {event.preventDefault();onChange({...draft,sort:value.sort});};
  const recordLabel = kind === 'auction' ? '拍卖 ID' : '订单 ID';
  return <div className="catalog-controls">
    <form className="catalog-fields" onSubmit={search}>
      <label>NFT 名称<input name="name" value={draft.name} onChange={update} placeholder="名称关键词" type="search"/></label>
      <label>Token ID<input name="token" value={draft.token} onChange={update} inputMode="numeric" placeholder="精确编号"/></label>
      <label>{recordLabel}<input name="record" value={draft.record} onChange={update} inputMode="numeric" placeholder="精确编号"/></label>
      <label>卖家地址<input name="seller" value={draft.seller} onChange={update} placeholder="完整地址或部分地址" type="search"/></label>
      <label>最低价格 ETH<input name="minPrice" value={draft.minPrice} onChange={update} inputMode="decimal" placeholder="不限"/></label>
      <label>最高价格 ETH<input name="maxPrice" value={draft.maxPrice} onChange={update} inputMode="decimal" placeholder="不限"/></label>
      <button type="submit" className="secondary">搜索</button>
    </form>
    <p className="muted small" role="status">显示 {count} / {total} 条。搜索当前载入的最近最多 40 条记录，时间按链上创建编号排序。{kind === 'auction' && '价格取最高出价，无出价时取底价；剩余时间排序将已结束拍卖放在末尾。'}</p>
    {loading && <p role="status" className="small">正在读取 NFT 名称，搜索结果会随读取完成更新…</p>}
    {failed > 0 && <p role="status" className="small">{failed} 件资产名称读取失败，名称搜索可能遗漏这些资产。<button type="button" className="text-btn" onClick={onRetry}>重试名称读取</button></p>}
    {error && <p role="alert" className="warning">{error}</p>}
  </div>;
}
