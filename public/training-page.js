(async()=>{
 const status=document.getElementById('pageStatus');
 try{
  const api=async(path,options={})=>{const r=await fetch('/api'+path,{cache:'no-store',...options,headers:{'Content-Type':'application/json',...options.headers},signal:options.signal||AbortSignal.timeout(15000)});if(r.status===401){location.replace('/login');throw Error('Entre novamente.');}return r;};
  const me=await api('/me');if(!me.ok)throw Error('Não foi possível validar seu acesso.');window.CentralIdentity=await me.json();document.getElementById('viewerName').textContent=CentralIdentity.name;
  const hub=new CentralTeamHub({api,guard:()=>true,trainingPage:true},document.getElementById('hubHeader'));
  document.getElementById('hubHeader').hidden=true;hub.panel.classList.add('training-page-panel');document.querySelector('main').append(hub.panel);hub.panel.querySelector('.hub-close').hidden=true;
  const filter=document.getElementById('productFilter'),search=document.getElementById('trainingSearch');const render=hub.render.bind(hub);
  hub.render=()=>{const all=hub.data,chosen=filter.value,query=search.value.trim().toLocaleLowerCase('pt-BR');filter.replaceChildren(new Option('Todos os produtos',''));for(const name of [...new Set(all.map(x=>x.product||'Geral'))].sort())filter.add(new Option(name,name));filter.value=chosen;
   document.getElementById('productNames').replaceChildren(...[...new Set(all.map(x=>x.product).filter(Boolean))].map(name=>{const option=document.createElement('option');option.value=name;return option;}));
   hub.data=all.filter(x=>(!filter.value||(x.product||'Geral')===filter.value)&&(!query||(x.title+' '+x.details+' '+(x.product||'Geral')).toLocaleLowerCase('pt-BR').includes(query)));const displayed=[...hub.data].sort((a,b)=>(a.order||0)-(b.order||0)||b.updatedAt.localeCompare(a.updatedAt));render();hub.data=all;
   [...hub.list.querySelectorAll('.hub-card')].forEach((card,index)=>{const badge=document.createElement('span');badge.className='product-badge';badge.textContent=displayed[index].product||'Geral';card.prepend(badge);});document.getElementById('trainingCount').textContent=displayed.length+' treinamento(s)';
  };
  const edit=hub.edit.bind(hub);hub.edit=async(item)=>{await edit(item);if(hub.editor.hidden)return;const box=document.createElement('div');box.className='training-product-fields';box.innerHTML='<label>Produto</label><input data-field="product" maxlength="80" list="productNames" placeholder="Ex.: Consórcio"><label>Ordem de apresentação</label><input data-field="order" type="number" min="0" max="9999" step="1">';hub.editor.querySelector('.hub-actions').before(box);hub.field('product').value=item?.product||'';hub.field('order').value=item?.order||0;hub.editor.scrollIntoView({block:'start',behavior:'smooth'});};
  const request=hub.request.bind(hub);hub.request=(method='GET',body)=>{if(body){body.product=hub.field('product').value.trim();body.order=Number(hub.field('order').value);}return request(method,body);};
  filter.onchange=()=>hub.render();let timer;search.oninput=()=>{clearTimeout(timer);timer=setTimeout(()=>hub.render(),180);};
  const play=hub.playVideo.bind(hub);hub.playVideo=(item,source)=>{play(item,source);hub.player?.scrollIntoView({block:'start',behavior:'smooth'});};
  status.hidden=true;hub.open('training');
 }catch(error){status.textContent=error.message;}
})();
