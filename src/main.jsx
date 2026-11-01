import React from 'react';import {createRoot} from 'react-dom/client';import App from './App.jsx';import './style.css';
class ErrorBoundary extends React.Component{state={error:null};static getDerivedStateFromError(error){return {error};}render(){return this.state.error?<main className="fatal"><h1>页面遇到错误</h1><p>{this.state.error.message}</p><button onClick={()=>location.reload()}>重新载入</button><p>重新载入不会重发链上交易。</p></main>:this.props.children;}}
createRoot(document.getElementById('root')).render(<ErrorBoundary><App/></ErrorBoundary>);
