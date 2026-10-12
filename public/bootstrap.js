(async()=>{
try{
 const response=await fetch('/api/me',{cache:'no-store',signal:AbortSignal.timeout(15000)});
 if(response.status===401){location.replace('/login');return;}
 if(!response.ok)throw Error('O backend não respondeu. Tente novamente.');
 const identity=await response.json();
 if(!['admin','seller'].includes(identity.role)||!identity.id)throw Error('Sessão inválida. Entre novamente.');
 window.CentralIdentity=identity;
 const scoped=(storage,prefix)=>({getItem:k=>{try{const value=storage.getItem(prefix+k);if(k==='lungo_v8_cfg'&&value){const cfg=JSON.parse(value);cfg.bridge=location.origin+'/api';return JSON.stringify(cfg);}return value;}catch{return null;}},setItem:(k,v)=>{try{storage.setItem(prefix+k,v);return true;}catch{window.CentralLocalBackupFailed=true;window.dispatchEvent(new Event('central-local-failure'));return false;}},removeItem:k=>{try{storage.removeItem(prefix+k);}catch{}}});
 const prefix=identity.role==='admin'?'':'sales:'+identity.id+':';
 window.CentralLocalStorage=scoped(localStorage,prefix);window.CentralSessionStorage=scoped(sessionStorage,prefix);
 for(const original of document.querySelectorAll('script[type="application/x-central-script"]')){
  const script=document.createElement('script');
  if(original.dataset.src){script.src=original.dataset.src;await new Promise((resolve,reject)=>{script.onload=resolve;script.onerror=()=>reject(Error('Não foi possível carregar a interface.'));document.body.append(script);});}
  else{script.textContent=original.textContent;document.body.append(script);}
 }
 document.getElementById('startup-style').remove();
}catch(error){const message=document.createElement('p');message.textContent=error.message;message.style.cssText='padding:32px;font:16px system-ui';document.body.replaceChildren(message);}
})();