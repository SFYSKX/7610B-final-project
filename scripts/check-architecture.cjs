// Read-only boundary/cycle check using the same module resolver as frontend tests.
const {build}=require('esbuild');
async function main(){
  const result=await build({entryPoints:['src/main.jsx','src/lib/client.mjs'],bundle:true,write:false,
    outdir:'architecture-check',metafile:true,logLevel:'silent',external:['react','react-dom','react-dom/*','ethers']});
  const files=result.metafile.inputs,graph=new Map(),violations=[];
  const normalize=p=>p.replaceAll('\\','/');
  for(const [raw,input]of Object.entries(files)){
    const source=normalize(raw);if(!source.startsWith('src/'))continue;
    const dependencies=input.imports.filter(i=>!i.external).map(i=>normalize(i.path)).filter(p=>p.startsWith('src/'));
    graph.set(source,dependencies);
    for(const dependency of dependencies){
      if(source.startsWith('src/services/')&&!/^src\/(services|lib)\//.test(dependency))violations.push(`${source}: service cannot import ${dependency}`);
      if(source.startsWith('src/lib/')&&/^src\/(features|components|hooks)\//.test(dependency))violations.push(`${source}: library cannot import UI ${dependency}`);
      if(source.startsWith('src/features/')&&source!=='src/features/registry.jsx'&&dependency.startsWith('src/features/')&&source.split('/')[2]!==dependency.split('/')[2])violations.push(`${source}: feature cannot import another feature ${dependency}`);
      if(dependency==='src/lib/client.mjs')violations.push(`${source}: internal code must use concrete modules, not the compatibility facade`);
    }
  }
  const done=new Set(),visiting=[];
  function visit(file){
    if(visiting.includes(file)){violations.push('Cycle: '+[...visiting,file].join(' -> '));return;}
    if(done.has(file))return;
    visiting.push(file);for(const next of graph.get(file)||[])visit(next);visiting.pop();done.add(file);
  }
  for(const file of graph.keys())visit(file);
  if(violations.length)throw Error(violations.join('\n'));
  console.log(`Architecture OK: ${graph.size} source modules, no import cycles or forbidden layer dependencies.`);
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
