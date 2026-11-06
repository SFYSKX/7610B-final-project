import React,{useState} from 'react';
import {Contract} from 'ethers';
import {ABIS} from '../../lib/abis.mjs';
import {address,integer} from '../../lib/control.mjs';
import {same} from '../../lib/format.mjs';
import {Form,Empty,f} from '../../components/common.jsx';
import {createMintMetadata,MINT_URI_LIMIT} from '../../services/mintMetadata.mjs';
import {normalizeMetadata} from '../../services/nftMetadata.mjs';

function MetadataPreview({metadata}) {
  const [failedImage,setFailedImage] = useState('');
  return <aside className="mint-preview" aria-label="NFT 内容预览">
    <h3>内容预览</h3>
    {metadata.image && failedImage !== metadata.image && <img className="nft-image" src={metadata.image}
      alt={metadata.name} referrerPolicy="no-referrer" onError={() => setFailedImage(metadata.image)}/>}
    {metadata.image && failedImage === metadata.image && <p className="warning" role="status">图片暂时无法预览，请确认链接可以公开访问。铸造时将保存填写的图片链接。</p>}
    {!metadata.image && <p className="muted">未填写图片链接</p>}
    <h3>{metadata.name}</h3>
    <p className="nft-description">{metadata.description || '未提供描述'}</p>
  </aside>;
}

export default function Mint({s,data,tx,guarded,disabled}) {
  const collections = data.mintable || [];
  const [choice,setChoice] = useState('');
  const [draft,setDraft] = useState({name:'',description:'',image:''});
  const selected = collections.find(collection => same(collection.address,choice)) || collections[0];
  if (!selected) return <Empty>当前账户没有已配置 NFT 集合的铸造权限。铸造权限由 NFT 合约 owner 决定。</Empty>;

  let prepared = null, issue = '';
  try {prepared = createMintMetadata(draft);}
  catch (error) {issue = error.message;}
  const update = event => setDraft({...draft,[event.target.name]:event.target.value});
  function submit(values) {
    return guarded(() => {
      const recipient = address(values.recipient);
      const count = integer(values.count,{min:1n,max:BigInt(selected.limit)});
      const {uri} = createMintMetadata(draft);
      const nft = new Contract(selected.address,ABIS.DemoNFT,s.provider);
      return count === 1n
        ? tx('铸造 NFT',nft,'mint',[recipient,uri])
        : tx('批量铸造 NFT',nft,'mintBatch',[recipient,count,uri]);
    });
  }

  return <section className="panel"><h2>NFT 铸造管理</h2>
    <p>选择发行集合，填写接收地址、数量与 NFT 内容，在钱包确认后铸造。</p>
    <label>发行集合<select aria-label="发行集合" value={selected.address} disabled={disabled}
      onChange={event => setChoice(event.target.value)}>
      {collections.map(collection => <option value={collection.address} key={collection.address}>{collection.name || '测试 NFT'} · {collection.address}</option>)}
    </select></label>
    <p className="small">集合地址：<code>{selected.address}</code><br/>发行者：<code>{selected.owner}</code><br/>最近已发行编号：{String(selected.nextTokenId)}</p>
    <Form key={selected.address} fields={[f('recipient','接收钱包地址',s.account),f('count',`铸造数量（1–${selected.limit}）`,'1')]}
      submit="确认铸造 NFT" disabled={disabled || !prepared} onSubmit={submit}
      note={selected.limit === 1 ? '该集合使用单件铸造接口，每次可铸造 1 件。' : ('一次交易最多铸造 '+selected.limit+' 件。同一批 NFT 使用相同的名称、描述和图片，Token ID 各不相同。')}>
      <div className="mint-editor">
        <fieldset className="mint-metadata" disabled={disabled}>
          <legend>NFT 内容</legend>
          <label>NFT 名称<input name="name" value={draft.name} onChange={update} maxLength={300} required placeholder="例如：校园艺术展 · 春日"/></label>
          <label>图片链接（可选）<input name="image" value={draft.image} onChange={update} maxLength={4096}
            placeholder="https://… 或 ipfs://…" autoComplete="off" aria-describedby="mint-image-help"/></label>
          <p id="mint-image-help" className="muted small">填写图片文件的公开链接。IPFS 图片通过网关读取；图片内容由该链接提供。</p>
          <label>描述（可选）<textarea aria-label="描述（可选）" name="description" value={draft.description} onChange={update} rows={5} maxLength={10000}
            placeholder="介绍这件作品、创作背景或社团活动"/></label>
        </fieldset>
        {prepared ? <MetadataPreview key={prepared.metadata.image || ''} metadata={normalizeMetadata(prepared.metadata,prepared.uri)}/>
          : <div className="mint-preview"><h3>内容预览</h3><p className="muted">填写完整且符合长度限制的内容后，可在这里预览。</p></div>}
      </div>
      {prepared && <p className="small muted" role="status">编码后的元数据 {prepared.bytes} / {MINT_URI_LIMIT} 字节</p>}
      {issue && draft.name && <p className="warning" role="alert">{issue}</p>}
    </Form>
    <p className="muted small">确认后，接收账户可在“我的资产 → 查看 NFT 详情”核对内容。挂牌或创建拍卖后，市场中的详情也会读取同一份元数据。待确认或结果未知时，请先检查交易回执。</p>
  </section>;
}
