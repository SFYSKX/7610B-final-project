import React from 'react';

/** A view failure affects only the mounted feature. Navigation remains usable. */
export default class ModuleBoundary extends React.Component {
  state={failed:false,attempt:0};
  static getDerivedStateFromError(){return {failed:true};}
  render(){
    if(this.state.failed)return <section className="panel" role="alert">
      <h2>{this.props.label}暂时无法显示</h2>
      <p>页面显示遇到问题。可以重试此模块，或切换到其他功能。重试不会重发交易。</p>
      <button onClick={()=>this.setState(s=>({failed:false,attempt:s.attempt+1}))}>重试此模块</button>
    </section>;
    return <React.Fragment key={this.state.attempt}>{this.props.children}</React.Fragment>;
  }
}
