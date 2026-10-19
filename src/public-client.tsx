import Account, { api, track } from './Account';
import { normalizeProject } from './project';
import { getColor } from './palette';
const { useEffect, useState } = React;
function PublicControls() {
 const [loggedIn,setLoggedIn]=useState(false);
 const [project,setProject]=useState<ReturnType<typeof normalizeProject> | null>(null);
 const [error,setError]=useState('');
 const [retry,setRetry]=useState(0);
 const target=document.getElementById('pattern-actions');
 const id=target?.dataset.id;
 useEffect(()=>{let active=true;setProject(null);setError('');if(loggedIn&&id)void api(`patterns/${id}/project`).then(r=>{if(active)setProject(normalizeProject(r.project));}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[loggedIn,id,retry]);
 async function act(download:boolean) {
  try {
   const result=await api(`patterns/${id}/project`);
   if(download){const blob=new Blob([JSON.stringify(normalizeProject(result.project),null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='perler-pattern.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);track('marketplace_download');}
   else {sessionStorage.setItem('perler:pending-project',JSON.stringify(result.project));track('marketplace_load');location.assign('/editor');}
  } catch(e){setError((e as Error).message);}
 }
 const colors=new Map<string,number>(); project?.cells.forEach(id=>{if(id)colors.set(id,(colors.get(id)||0)+1);});
 return <><Account onLoginChange={setLoggedIn}/>{target&&ReactDOM.createPortal(<>
  {!loggedIn?<p>登录后可载入编辑器、查看配色用量及下载 JSON。</p>:<><div className="actions"><button className="button" onClick={()=>void act(false)}>载入编辑器</button><button onClick={()=>void act(true)}>下载 JSON</button></div><h2>配色与用量 · MARD</h2>{project?<div className="color-usage">{[...colors].sort((a,b)=>b[1]-a[1]).map(([id,n])=><span key={id}><i style={{background:getColor(id)?.hex}}/>{getColor(id)?.primaryCode} · {n} 颗</span>)}</div>:!error&&<p role="status">加载中…</p>}</>}
  {error&&<p role="alert">{error} <button onClick={()=>setRetry(v=>v+1)}>重试</button></p>}
 </>,target)}</>;
}
const old=location.hash.match(/^#marketplace(?:\/([a-f0-9-]{36}))?$/);
if(old)location.replace(old[1]?`/patterns/${old[1]}`:'/marketplace');
else {document.getElementById('pattern-actions')?.replaceChildren();ReactDOM.createRoot(document.getElementById('account-root')!).render(<PublicControls/>);if(location.pathname==='/marketplace')track('marketplace_view');}
