/* Organização e lotes preservam os contatos e históricos do workspace. */
window.CentralSettings=class {
 constructor(options){
  this.options=options;this.page=1;this.selected=new Set();
  const root=document.querySelector('#settings .settings'),existing=[...root.childNodes];
  root.innerHTML='<h2>Configurações</h2><nav class="settings-tabs" aria-label="Áreas de configuração"></nav><div class="settings-content"></div>';
  const nav=root.querySelector('nav'),content=root.querySelector('.settings-content');
  for(const [key,title] of [['general','WhatsApp e metas'],['access','Acessos'],['agent','Agente'],['batches','Lotes de contatos']]){
   const button=document.createElement('button');button.type='button';button.className='btn';button.textContent=title;button.dataset.settingsTab=key;
   const panel=document.createElement('section');panel.dataset.settingsPanel=key;panel.hidden=key!=='general';nav.append(button);content.append(panel);
   button.onclick=()=>{if(!this.guard())return;nav.querySelectorAll('button').forEach(x=>x.classList.toggle('primary',x===button));content.querySelectorAll('section').forEach(x=>x.hidden=x!==panel);if(key==='batches')this.refresh();};
   if(key==='general'){button.classList.add('primary');existing.forEach(x=>panel.append(x));}
  }
  content.querySelector('[data-settings-panel=access]').innerHTML='<h3>Acessos de usuários</h3><p>Aqui ficará a criação de acessos e a gestão das permissões da equipe.</p><div class="settings-placeholder">Em preparação. O acesso atual continua pelo usuário e senha configurados no servidor. A geração de usuários individuais será implementada na próxima etapa.</div>';
  const logout=document.createElement('button');logout.className='btn';logout.textContent='Sair da central';logout.style.marginTop='16px';logout.onclick=()=>{if(this.guard())this.options.logout();};content.querySelector('[data-settings-panel=access]').append(logout);
  const agent=content.querySelector('[data-settings-panel=agent]');
  agent.innerHTML='<h3>Configuração do agente</h3><p>Salve as orientações para a próxima integração do agente.</p><label>Nome do agente</label><input id="agentName" maxlength="80"><label>Produto ou serviço</label><input id="agentProduct" maxlength="160"><label>Orientações de atendimento</label><textarea id="agentInstructions" maxlength="10000"></textarea><button class="btn primary" id="saveAgent">Salvar agente</button><p>O agente ainda não executa atendimentos automaticamente.</p>';
  document.getElementById('saveAgent').onclick=()=>{if(!this.guard())return;this.options.cfg().agent={name:this.el('agentName').value.trim(),product:this.el('agentProduct').value.trim(),instructions:this.el('agentInstructions').value.trim()};this.options.save();this.options.toast('Configuração do agente salva.');};
  content.querySelector('[data-settings-panel=batches]').innerHTML='<h3>Lote de trabalho</h3><p>Escolha qual lote será exibido em Todos os contatos. Os demais contatos e seus históricos continuam guardados.</p><label for="activeBatch">Trabalhar com</label><select id="activeBatch"></select><button class="btn primary" id="useBatch">Usar este lote</button><div id="batchActiveHint" class="hint"></div><hr><h3>Organizar lotes</h3><label>Lote para editar</label><select id="editBatch"></select><button class="btn" id="newBatch">Novo lote</button><label>Nome do lote</label><input id="batchName" maxlength="80"><label>Produto ou campanha</label><input id="batchProduct" maxlength="160"><label>Contatos do lote</label><input id="batchSearch" placeholder="Buscar nome, telefone ou segmento"><div class="batch-tools"><button class="btn" id="batchSelectPage">Selecionar página</button><button class="btn" id="batchClearPage">Retirar página</button><span id="batchSelection"></span></div><div id="batchContacts" class="batch-contacts"></div><div class="batch-tools"><button class="btn" id="batchPrev">Anterior</button><span id="batchPage"></span><button class="btn" id="batchNext">Próxima</button></div><button class="btn primary" id="saveBatch">Salvar lote</button><p>Um contato pode participar de vários lotes, com o mesmo histórico e bloqueio de Não contatar. Novos contatos adicionados enquanto um lote estiver ativo entram nesse lote.</p>';
  this.el('editBatch').onchange=()=>this.loadEditor(this.el('editBatch').value);
  this.el('newBatch').onclick=()=>{if(this.guard())this.loadEditor('');};
  this.el('batchSearch').oninput=()=>{this.page=1;this.renderContacts();};
  this.el('batchPrev').onclick=()=>{this.page--;this.renderContacts();};this.el('batchNext').onclick=()=>{this.page++;this.renderContacts();};
  this.el('batchSelectPage').onclick=()=>{if(!this.guard())return;this.pageItems.forEach(x=>this.selected.add(x.id));this.renderContacts();};
  this.el('batchClearPage').onclick=()=>{if(!this.guard())return;this.pageItems.forEach(x=>this.selected.delete(x.id));this.renderContacts();};
  this.el('useBatch').onclick=()=>{if(!this.guard())return;this.options.cfg().activeBatchId=this.el('activeBatch').value;this.options.save();this.options.clearFilters();this.options.draw();this.refresh();this.options.toast('Lote de trabalho atualizado.');};
  this.el('saveBatch').onclick=()=>this.saveBatch();this.refresh();this.loadEditor('');
 }
 el(id){return document.getElementById(id);}
 guard(){if(this.options.canUse())return true;this.options.toast('Conclua a chamada e aguarde o carregamento dos dados.');return false;}
 refresh(){
  const cfg=this.options.cfg();if(!Array.isArray(cfg.batches))cfg.batches=[];
  const editing=this.editing||'';
  for(const [id,label] of [['activeBatch','Todos os contatos'],['editBatch','Novo lote']]){
   const select=this.el(id);select.replaceChildren(new Option(label,''));
   for(const batch of cfg.batches){const count=this.options.leads().filter(l=>(l.batchIds||[]).includes(batch.id)).length;select.add(new Option(`${batch.name} (${count})`,batch.id));}
  }
  this.el('activeBatch').value=cfg.activeBatchId||'';this.el('editBatch').value=editing;
  this.el('batchActiveHint').textContent='Lote atual: '+(cfg.batches.find(x=>x.id===cfg.activeBatchId)?.name||'Todos os contatos');
 }
 applyState(){const agent=this.options.cfg().agent||{};for(const [id,key] of [['agentName','name'],['agentProduct','product'],['agentInstructions','instructions']])this.el(id).value=agent[key]||'';this.refresh();this.loadEditor('');}
 loadEditor(id){
  this.editing=id;const batch=this.options.cfg().batches?.find(x=>x.id===id);
  this.el('editBatch').value=id;this.el('batchName').value=batch?.name||'';this.el('batchProduct').value=batch?.product||'';
  this.selected=new Set(id?this.options.leads().filter(l=>(l.batchIds||[]).includes(id)).map(l=>l.id):[]);this.page=1;this.el('batchSearch').value='';this.renderContacts();
 }
 renderContacts(){
  const q=this.el('batchSearch').value.toLocaleLowerCase('pt-BR');const list=this.options.leads().filter(l=>[l.name,l.phones,l.segment].join(' ').toLocaleLowerCase('pt-BR').includes(q));
  this.page=Math.max(1,Math.min(this.page,Math.ceil(list.length/100)||1));this.pageItems=list.slice((this.page-1)*100,this.page*100);
  const root=this.el('batchContacts');root.replaceChildren();
  for(const lead of this.pageItems){const label=document.createElement('label');label.className='batch-contact';const check=document.createElement('input');check.type='checkbox';check.checked=this.selected.has(lead.id);check.onchange=()=>{if(!this.guard()){check.checked=!check.checked;return;}if(check.checked)this.selected.add(lead.id);else this.selected.delete(lead.id);this.el('batchSelection').textContent=this.selected.size+' selecionados';};const text=document.createElement('span');text.textContent=lead.name+' · '+lead.phones;label.append(check,text);root.append(label);}
  this.el('batchSelection').textContent=this.selected.size+' selecionados';this.el('batchPage').textContent=`Página ${this.page} de ${Math.max(1,Math.ceil(list.length/100))}`;
  this.el('batchPrev').disabled=this.page<=1;this.el('batchNext').disabled=this.page*100>=list.length;
 }
 saveBatch(){
  if(!this.guard())return;const name=this.el('batchName').value.trim(),product=this.el('batchProduct').value.trim(),cfg=this.options.cfg();
  if(!name){this.options.toast('Informe o nome do lote.');return;}
  if(cfg.batches.some(x=>x.id!==this.editing&&x.name.toLocaleLowerCase('pt-BR')===name.toLocaleLowerCase('pt-BR'))){this.options.toast('Já existe um lote com esse nome.');return;}
  if(!this.editing&&cfg.batches.length>=100){this.options.toast('Limite de 100 lotes atingido.');return;}
  const id=this.editing||crypto.randomUUID(),batch=cfg.batches.find(x=>x.id===id);
  if(batch)Object.assign(batch,{name,product});else cfg.batches.push({id,name,product});
  for(const lead of this.options.leads()){const memberships=new Set(lead.batchIds||[]);if(this.selected.has(lead.id))memberships.add(id);else memberships.delete(id);lead.batchIds=[...memberships];}
  this.editing=id;this.options.save();this.options.draw();this.refresh();this.options.toast('Lote salvo. Escolha Usar este lote para trabalhar com ele.');
 }
};
