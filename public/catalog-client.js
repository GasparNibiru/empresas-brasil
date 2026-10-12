window.CentralCompanySize=value=>({'01':'ME','03':'EPP','05':'Demais'}[String(value)]||'');
window.CentralFormatCnpj=value=>{const digits=String(value||'').replace(/[^a-z0-9]/gi,'');return digits.length===14?digits.slice(0,2)+'.'+digits.slice(2,5)+'.'+digits.slice(5,8)+'/'+digits.slice(8,12)+'-'+digits.slice(12):String(value||'—');};
/* Catálogo cadastral separado da fila operacional. Sem alteração de históricos. */
window.CentralCatalogPlan = (existing, selected, rejected) => {
  const phone=value=>{const digits=String(value||'').replace(/\D/g,'');return digits.length===10||digits.length===11?'55'+digits:digits;};
  const cnpj=value=>String(value||'').replace(/[^a-z0-9]/gi,'').toUpperCase();
  const name=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
  const ids=new Set(existing.map(x=>x.sourceId).filter(Boolean)), pairs=new Set(), names=new Set(), blockedPhones=new Set(),blockedCompanies=new Set();
  for(const lead of existing) {
    const company=cnpj(lead.cnpj);
    for(const value of String(lead.phones||'').split(';')){
      const number=phone(value);if(!number)continue;
      if(company)pairs.add(company+':'+number);else names.add(name(lead.name)+':'+number);
      if(rejected(lead)){blockedPhones.add(number);if(company)blockedCompanies.add(company);}
    }
  }
  const items=[],restored=[];const restoredIds=new Set();let duplicates=0,blocked=0;
  for(const row of selected){
    if(!row||typeof row.name!=='string'||!row.name.trim()||typeof row.id!=='string'||!/^55\d{2}9\d{8}$/.test(row.phone)||!/^([A-Z0-9]{12}\d{2})$/.test(cnpj(row.cnpj)))throw Error('Registro inválido na base. Atualize a consulta.');
    const company=cnpj(row.cnpj),number=phone(row.phone),pair=company+':'+number;
    if(blockedPhones.has(number)||blockedCompanies.has(company)){blocked++;continue;}
    const matches=lead=>lead.sourceId===row.id||cnpj(lead.cnpj)===company&&String(lead.phones||'').split(';').some(p=>phone(p)===number);const archived=existing.find(lead=>lead.returnedToCatalog&&matches(lead));if(archived&&!existing.some(lead=>!lead.returnedToCatalog&&matches(lead))){if(restoredIds.has(archived.id)){duplicates++;continue;}restoredIds.add(archived.id);restored.push({leadId:archived.id,row});continue;}
    if(ids.has(row.id)||pairs.has(pair)||names.has(name(row.name)+':'+number)){duplicates++;continue;}
    items.push(row);ids.add(row.id);pairs.add(pair);
  }
  if(existing.length+items.length>10000)throw Error('A fila permite até 10.000 contatos nesta versão. Selecione um lote menor.');
  return {items,duplicates,blocked,restored};
};

window.CentralCatalog = class {
  constructor(options){
    this.options=options;this.page=1;this.selection=new Map();this.items=[];this.total=0;this.sequence=0;this.loaded=false;
    const $=id=>document.getElementById(id);
    this.search=$('catalogSearch');this.segment=$('catalogSegment');this.rows=$('catalogRows');this.status=$('catalogStatus');this.prev=$('catalogPrev');this.next=$('catalogNext');this.selectPage=$('catalogSelectPage');this.add=$('catalogAdd');this.counter=$('catalogSelection');
    this.search.oninput=()=>{clearTimeout(this.timer);this.selection.clear();this.controls();this.timer=setTimeout(()=>this.load(1),300);};
    this.segment.onchange=()=>{this.selection.clear();this.controls();this.load(1);};
    $('catalogRefresh').onclick=()=>this.load(this.page);
    this.prev.onclick=()=>this.load(this.page-1);this.next.onclick=()=>this.load(this.page+1);
    this.selectPage.onchange=()=>{
      if(!this.guard())return;
      for(const item of this.items){
        if(this.selectPage.checked){if(this.selection.size>=100&&!this.selection.has(item.id)){this.options.toast('Selecione até 100 contatos por lote.');break;}this.selection.set(item.id,item);}
        else this.selection.delete(item.id);
      }
      this.render();
    };
    this.add.onclick=()=>{
      if(!this.guard())return;
      try{
        const result=this.options.onAdd([...this.selection.values()]);
        this.selection.clear();this.render();
        this.options.toast(`${result.added} contato(s) adicionado(s). ${result.duplicates} já estavam na fila. ${result.blocked} bloqueado(s) por não contatar.`);
      }catch(error){this.options.toast(error.message);}
    };
    this.syncRegions();this.controls();
  }
  regions(){const saved=this.options.cfg?.().catalogRegions||[],defaults=[{id:'santa-rosa-rs',uf:'RS',city:'Santa Rosa'},{id:'sao-paulo-sp',uf:'SP',city:'São Paulo'},{id:'belem-pa',uf:'PA',city:'Belém'},{id:'porto-alegre-rs',uf:'RS',city:'Porto Alegre'}];const key=r=>r.uf+':'+r.city.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();return [...saved,...defaults.filter(r=>!saved.some(s=>key(s)===key(r)))];}
  syncRegions(){const regions=this.regions(),old=this.region;this.region=regions.find(r=>r.id===old?.id)||regions[0];if(old&&old.id!==this.region.id){this.loaded=false;this.selection.clear();this.sequence++;}this.renderRegions();}
  renderRegions(){
    const regions=this.regions(),states=document.getElementById('catalogStates'),cities=document.getElementById('catalogCities');if(!states||!cities)return;states.replaceChildren();cities.replaceChildren();
    const tab=(label,active,click)=>{const b=document.createElement('button');b.type='button';b.className='product-tab'+(active?' active':'');b.style.setProperty('--product-color','#2875af');b.textContent=label;b.setAttribute('role','tab');b.setAttribute('aria-selected',String(active));b.onclick=click;return b;};
    for(const uf of [...new Set(regions.map(r=>r.uf))].sort())states.append(tab(uf,uf===this.region.uf,()=>this.chooseRegion(regions.find(r=>r.uf===uf))));
    const add=document.createElement('button');add.type='button';add.className='product-tool';add.title='Cadastrar cidade e estado';add.setAttribute('aria-label',add.title);add.textContent='+';add.onclick=()=>this.addRegion();states.append(add);
    for(const region of regions.filter(r=>r.uf===this.region.uf))cities.append(tab(region.city,region.id===this.region.id,()=>this.chooseRegion(region)));
    document.getElementById('catalogRegionTitle').textContent='Empresas · '+this.region.city+'/'+this.region.uf;const cityKey=this.region.uf+':'+this.region.city.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();document.getElementById('catalogRegionHint').textContent=['SP:sao paulo','PA:belem','RS:porto alegre'].includes(cityKey)?'Ativas · abertura: 11/10/2023 a 11/10/2026':'Todas as situações cadastrais';
  }
  chooseRegion(region){if(!this.guard()||region.id===this.region.id)return;clearTimeout(this.timer);this.region=region;this.selection.clear();this.items=[];this.total=0;this.page=1;this.search.value='';this.segment.replaceChildren(new Option('Todos os segmentos',''));this.renderRegions();this.render();this.load(1);}
  addRegion(){
    if(!this.guard())return;this.options.showModal('<h2>Nova região da base</h2><label for="catalogRegionUf">Estado</label><select id="catalogRegionUf"></select><label for="catalogRegionCity">Cidade</label><input id="catalogRegionCity" maxlength="80" placeholder="Nome da cidade"><p>Cria a organização para receber uma base posteriormente. Não importa contatos.</p><div class="footer"><button class="btn" id="cancelCatalogRegion">Cancelar</button><button class="btn primary" id="saveCatalogRegion">Criar região</button></div>');
    const uf=document.getElementById('catalogRegionUf');for(const value of ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'])uf.add(new Option(value,value));uf.value=this.region.uf;
    document.getElementById('cancelCatalogRegion').onclick=this.options.close;document.getElementById('saveCatalogRegion').onclick=()=>{if(!this.guard())return;const city=document.getElementById('catalogRegionCity').value.trim().replace(/\s+/g,' ');if(!city){this.options.toast('Informe a cidade.');return;}const key=value=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR'),regions=this.regions();if(regions.some(r=>r.uf===uf.value&&key(r.city)===key(city))){this.options.toast('Esta cidade já está cadastrada neste estado.');return;}if(regions.length>=200){this.options.toast('Limite de 200 regiões.');return;}const region={id:crypto.randomUUID(),uf:uf.value,city};this.options.cfg().catalogRegions=[...regions,region];this.options.save();this.options.close();this.chooseRegion(region);};
  }
  guard(){if(this.options.canUse())return true;this.options.toast('Conclua a chamada e aguarde o carregamento dos dados antes de usar a base.');return false;}
  activate(){if(!this.loaded)this.load(1);}
  controls(){
    this.counter.textContent=this.selection.size+' selecionado(s)';this.add.disabled=!this.selection.size||this.loading;
    this.prev.disabled=this.loading||this.page<=1;this.next.disabled=this.loading||this.page*50>=this.total;
    this.selectPage.disabled=this.loading||!this.items.length;
    const chosen=this.items.filter(x=>this.selection.has(x.id)).length;
    this.selectPage.checked=Boolean(this.items.length&&chosen===this.items.length);this.selectPage.indeterminate=chosen>0&&chosen<this.items.length;
  }
  async load(page){
    if(!this.guard())return;
    const sequence=++this.sequence;this.loading=true;this.items=[];this.render();this.controls();this.status.textContent='Consultando empresas...';
    const params=new URLSearchParams({page:String(page),limit:'50',segment:this.segment.value,search:this.search.value.trim(),uf:this.region.uf,city:this.region.city});
    try{
      const response=await fetch('/api/catalog?'+params,{signal:AbortSignal.timeout(25000)});const data=await response.json();
      if(!response.ok)throw Error(data.error||'Não foi possível consultar a base.');
      if(sequence!==this.sequence)return;
      if(!Array.isArray(data.items)||!Array.isArray(data.segments))throw Error('Resposta inválida do catálogo.');
      this.items=data.items;this.total=Number(data.total)||0;this.page=data.page;this.loaded=true;
      const current=this.segment.value;this.segment.replaceChildren(new Option('Todos os segmentos',''));
      for(const item of data.segments)this.segment.add(new Option(item.count===undefined?item.name:`${item.name} (${Number(item.count).toLocaleString('pt-BR')})`,item.code));
      this.segment.value=current;
      this.status.textContent=`${this.total.toLocaleString('pt-BR')} registro(s) • página ${this.page} de ${Math.max(1,Math.ceil(this.total/50))}`;
      this.render();
    }catch(error){if(sequence===this.sequence){this.items=[];this.total=0;this.render();this.status.textContent='Falha na consulta: '+error.message;}}
    finally{if(sequence===this.sequence){this.loading=false;this.controls();}}
  }
  render(){
    this.rows.replaceChildren();
    for(const item of this.items){
      const row=document.createElement('tr'),cell=document.createElement('td'),check=document.createElement('input');check.type='checkbox';check.checked=this.selection.has(item.id);check.setAttribute('aria-label','Selecionar '+item.name);
      check.onchange=()=>{if(!this.guard()){check.checked=!check.checked;return;}if(check.checked&&this.selection.size>=100){check.checked=false;this.options.toast('Selecione até 100 contatos por lote.');return;}if(check.checked)this.selection.set(item.id,item);else this.selection.delete(item.id);this.controls();};
      cell.append(check);row.append(cell);
      for(const value of [item.name,item.phone,item.segment_name]){const td=document.createElement('td');td.textContent=value;row.append(td);}
      const identity=document.createElement('div');identity.className='catalog-company-identity';identity.textContent=window.CentralFormatCnpj(item.cnpj);const size=window.CentralCompanySize(item.company_size);if(size){const badge=document.createElement('small');badge.className='company-size';badge.textContent=size;badge.title='Porte cadastral: '+size;identity.append(' ',badge);}row.children[1].append(identity);
      if(item.shared_phone){const hint=document.createElement('div');hint.className='muted';hint.textContent='Celular compartilhado por outros CNPJs';row.children[1].append(hint);}
      this.rows.append(row);
    }
    if(!this.items.length){const row=document.createElement('tr'),cell=document.createElement('td');cell.colSpan=4;cell.className='empty';cell.textContent=this.search.value||this.segment.value?'Nenhuma empresa encontrada para os filtros.':'Nenhuma empresa cadastrada nesta região. A estrutura está pronta para receber contatos.';row.append(cell);this.rows.append(row);}
    this.controls();
  }
};
