const fs=require('fs'), cp=require('child_process'), path=require('path');
const scratch=fs.readFileSync('[private-path]','utf8').trim(), w=fs.readFileSync(path.join(scratch,'kernel-layout-primary-worktree-private.txt'),'utf8').trim();
const ts=require(path.join(process.cwd(),'kernel/ts/node_modules/typescript'));
const base='665b3ff6c0fbed1109a8aa13576bad710a623d11',head='48405cd9fb5f743470125aaa65b23b374536dc51';
const git=(...a)=>cp.execFileSync('git',a,{encoding:'utf8',maxBuffer:30e6});
const names=git('diff','--name-status','--find-renames',base,head).trim().split('\n').map(x=>x.split('\t'));
const map=Object.fromEntries(names.filter(x=>x[0].startsWith('R')).map(x=>[x[1],x[2]]));
const oldfiles=git('ls-tree','-r','--name-only',base).trim().split('\n').filter(x=>/\.(ts|tsx)$/.test(x));
const fileSet=new Set(git('ls-tree','-r','--name-only',head).trim().split('\n'));
let results=[],edges=[],fail=[];
function parse(file,text){return ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);}
function tree(n){let children=[];ts.forEachChild(n,c=>{children.push(c)});return children.length?[n.kind,children.map(c=>((ts.isImportDeclaration(n)||ts.isExportDeclaration(n))&&c===n.moduleSpecifier)?['module_specifier']:tree(c))]:[n.kind,n.getText()];}
function specs(sf){let out=[];function visit(n){if((ts.isImportDeclaration(n)||ts.isExportDeclaration(n))&&n.moduleSpecifier)out.push(n.moduleSpecifier.text);ts.forEachChild(n,visit);}visit(sf);return out;}
for(const old of oldfiles){const next=map[old]||old;if(!fileSet.has(next)){fail.push({old,reason:'missing mapped file'});continue;}
const before=git('show',base+':'+old),after=git('show',head+':'+next);
if(before===after&&!old.startsWith('kernel/ts/src/'))continue;
const a=parse(old,before),b=parse(next,after);let equal=JSON.stringify(tree(a))===JSON.stringify(tree(b));
if(!equal){const aa=tree(a),bb=tree(b);function first(x,y,p=''){if(JSON.stringify(x)===JSON.stringify(y))return null;if(!Array.isArray(x)||!Array.isArray(y))return {p,x,y};for(let j=0;j<Math.max(x.length,y.length);j++){const z=first(x[j],y[j],p+'/'+j);if(z)return z;}}console.log(old,JSON.stringify(first(aa,bb)));}results.push({before:old,after:next,ast_equal:equal});if(!equal)fail.push({old,next,reason:'AST differs'});
const ai=specs(a),bi=specs(b);if(ai.length!==bi.length)fail.push({old,reason:'import count'});
for(let i=0;i<Math.min(ai.length,bi.length);i++){let target=ai[i].startsWith('.')?path.posix.normalize(path.posix.join(path.posix.dirname(old),ai[i])):ai[i],want=map[target]||target;
let actual=bi[i].startsWith('.')?path.posix.normalize(path.posix.join(path.posix.dirname(next),bi[i])):bi[i];
let okay=want===actual;edges.push({file:next,old_specifier:ai[i],new_specifier:bi[i],expected_target:want,actual_target:actual,equal:okay});if(!okay)fail.push(edges.at(-1));}}
const src=oldfiles.filter(x=>x.startsWith('kernel/ts/src/')), headsrc=[...fileSet].filter(x=>x.startsWith('kernel/ts/src/')&&x.endsWith('.ts'));
const output={base,head,method:'Independent TS concrete AST kind/ordered children/leaf values comparison; ONLY ImportDeclaration/ExportDeclaration moduleSpecifier normalized; import target equality via independently derived git rename map.',source_files_before:src.length,source_files_after:headsrc.length,renames:Object.keys(map).length,files:results,edges,failures:fail};
fs.writeFileSync(path.join(scratch,'kernel-layout-primary-controls','ast-import-proof.json'),JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({source_files:src.length,head_source_files:headsrc.length,renames:Object.keys(map).length,checked_files:results.length,import_export_edges:edges.length,failures:fail},null,2));