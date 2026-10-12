/* Persistência da primeira versão: fila serial, revisão otimista e backup local. */
window.CentralPersistence = class {
  constructor(options) {
    this.local=window.CentralLocalStorage||localStorage; this.options = options; this.ready = false; this.enabled = false;
    this.blocked = true; this.dirty = false; this.revision = 0; this.inFlight = null;
    this.panel = document.createElement('div');
    this.panel.style.cssText = 'margin:14px 0;padding:12px;border:1px solid #dce4eb;border-radius:8px';
    this.panel.innerHTML = '<b>Armazenamento dos dados</b><p data-status>Verificando banco...</p><button class="btn" data-backup>Exportar backup completo</button><button class="btn" data-retry style="margin-left:8px" hidden>Tentar salvar novamente</button>';
    document.querySelector('#settings .settings').append(this.panel);
    this.status = this.panel.querySelector('[data-status]');
    this.retry = this.panel.querySelector('[data-retry]');this.localBackupFailed=window.CentralLocalBackupFailed===true;window.addEventListener('central-local-failure',()=>{this.localBackupFailed=true;this.status.textContent='Backup local indisponível. Confira a gravação no banco e exporte uma cópia.';});
    this.panel.querySelector('[data-backup]').onclick = () => this.backup();
    this.retry.onclick = () => this.flush();
    this.cover = document.createElement('div');
    this.cover.style.cssText = 'position:fixed;inset:0;background:#ffffffef;z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px';
    this.cover.innerHTML = '<div style="max-width:520px"><h2>Carregando dados da Central</h2><p>Aguarde a consulta ao banco.</p></div>';
    document.body.append(this.cover);
    const gate = event => {
      if (!this.blocked || this.cover.contains(event.target) || this.panel.contains(event.target)) return;
      // Um erro de sincronização nunca impede encerrar/classificar uma chamada.
      if (event.target.closest?.('#answered,#unanswered,[data-act="end"],[data-act="noanswer"],[data-act="voicemail"],[data-act="invalid"]')) return;
      event.preventDefault(); event.stopImmediatePropagation();
    };
    for (const name of ['click','change','input','keydown','dragstart','drop']) document.addEventListener(name, gate, true);
    window.addEventListener('beforeunload', event => { if((this.dirty || this.inFlight) && this.businessFingerprint(this.snapshot()) !== this.confirmedBusiness) { event.preventDefault(); event.returnValue=''; } });
    window.addEventListener('online', () => { if(this.ready && this.dirty && !this.blocked) this.flush(); });
  }
  snapshot() { return JSON.parse(JSON.stringify(this.options.getState())); }
  businessFingerprint(state) {
    // Entrada/saída de sessão e lastSeenAt não exigem confirmação de backup.
    // URL do backend e estado da conexão também são preferências locais.
    const cfg=state.cfg||{}, operation=state.operation||{};
    const business={leads:state.leads.map(lead=>({...lead,history:lead.history||[],messages:lead.messages||[]})),
      cfg:{goal:Number(cfg.goal)||40,defaultWaMsg:cfg.defaultWaMsg||'',stageTitles:cfg.stageTitles||['Contatado','Frio','Morno','Quente','Virou lead','Não quer'],products:cfg.products||[],catalogRegions:cfg.catalogRegions||[],batches:cfg.batches||[],activeBatchId:cfg.activeBatchId||'',agent:{name:cfg.agent?.name||'',product:cfg.agent?.product||'',instructions:cfg.agent?.instructions||''}},
      operation:{live:operation.live??null,pendingEval:operation.pendingEval??null,liveSince:operation.liveSince||0}};
    const sorted=value=>Array.isArray(value)?value.map(sorted):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,sorted(value[key])])):value;
    return JSON.stringify(sorted(business));
  }
  needsBackup(pending, remoteState) {
    if(!pending) return false;
    try {
      const state=JSON.parse(pending);
      return this.businessFingerprint(state)!==this.businessFingerprint(remoteState);
    } catch { return true; }
  }
  backup(state = this.snapshot()) {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ format: 'central-lungo-backup-v1', exportedAt: new Date().toISOString(), state }, null, 2)], { type:'application/json' }));
    const anchor = document.createElement('a'); anchor.href=url; anchor.download='central-lungo-backup-'+Date.now()+'.json'; anchor.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  async request(method, body) {
    const response = await fetch('/api/state', { method, headers:{'Content-Type':'application/json'}, ...(body ? {body:JSON.stringify(body)} : {}), signal:AbortSignal.timeout(25000) });
    const data = await response.json();
    if(!response.ok) { const error=new Error(data.error||'Falha no banco.'); error.status=response.status; throw error; }
    return data;
  }
  dialog(title, message, actions) {
    this.cover.style.display='flex'; this.blocked=true;
    const box=document.createElement('div'); box.style.maxWidth='520px';
    const heading=document.createElement('h2'); heading.textContent=title; box.append(heading);
    const paragraph=document.createElement('p'); paragraph.textContent=message; box.append(paragraph);
    for(const [label, handler] of actions) { const button=document.createElement('button'); button.className='btn'; button.style.margin='8px 8px 0 0'; button.textContent=label; button.onclick=handler; box.append(button); }
    this.cover.replaceChildren(box);
  }
  open() { this.cover.style.display='none'; this.blocked=false; }
  async start() {
    if(typeof navigator!=='undefined'&&navigator.locks&&!this.tabLockAcquired){
      const acquired=await new Promise(resolve=>navigator.locks.request('central-edit-'+(window.CentralIdentity?.id||'admin'),{ifAvailable:true},lock=>{resolve(Boolean(lock));if(lock){this.tabLockAcquired=true;return new Promise(()=>{});}}).catch(()=>resolve(false)));
      if(!acquired){this.dialog('Esta conta já está aberta em outra aba','Use uma única aba para atender. Feche a outra aba e recarregue esta página.',[['Tentar novamente',()=>location.reload()]]);return;}
    }
    if(location.protocol==='file:') { this.ready=true; this.blocked=false; this.cover.remove(); this.status.textContent='Arquivo local: dados somente neste navegador.'; return; }
    try {
      const remote=await this.request('GET');
      if(!remote.enabled) { this.ready=true; this.open(); this.status.textContent='Supabase não configurado no servidor. Dados somente neste navegador.'; return; }
      this.enabled=true; this.revision=remote.revision;
      const local=this.snapshot();
      const accept = () => {
        this.options.applyState(remote.state);
        this.confirmedBusiness=this.businessFingerprint(remote.state);
        this.local.removeItem('lungo_cloud_pending');
        this.ready=true; this.open(); this.status.textContent='Dados carregados do Supabase.';
      };
      if(remote.initialized) {
        // Só pede confirmação se há dados operacionais sem confirmação.
        if(this.needsBackup(this.local.getItem('lungo_cloud_pending'),remote.state)) {
          this.dialog('Há alterações locais não confirmadas', 'Exporte uma cópia completa antes de carregar os dados do banco. O backup será mantido neste navegador também.', [
            ['Exportar backup e carregar banco',()=>{ this.backup(local); this.local.setItem('lungo_backup_before_cloud',JSON.stringify(local)); accept(); }]
          ]);
        } else {
          this.local.setItem('lungo_backup_before_cloud',JSON.stringify(local)); accept();
        }
        return;
      }
      const realLeads=local.leads.filter(lead=>!this.options.isDemo(lead));
      this.dialog('Preparar a base da Central', `O banco está vazio. Foram encontrados ${realLeads.length} contatos locais para migrar; os contatos demonstrativos serão excluídos da migração. Um backup completo será exportado antes de começar.`, [
        ['Migrar registros locais',()=>this.initialize({...local,leads:realLeads},local)],
        ['Começar com base vazia',()=>this.initialize({...local,leads:[],productivity:[]},local)]
      ]);
    } catch(error) {
      this.status.textContent='Banco indisponível: '+error.message;
      this.dialog('Não foi possível carregar o banco', 'Os dados locais foram preservados. Confira a configuração no servidor ou tente consultar novamente.', [['Tentar novamente',()=>this.start()],['Exportar backup local',()=>this.backup()]]);
    }
  }
  async initialize(state, original) {
    if(this.initializing) return;
    this.initializing=true;
    this.backup(original); this.local.setItem('lungo_backup_before_cloud',JSON.stringify(original));
    const payload={ revision:this.revision, mutationId:crypto.randomUUID(), state };
    this.local.setItem('lungo_cloud_pending',JSON.stringify(state));
    try {
      const result=await this.request('PUT',payload); this.revision=result.revision;
      this.confirmedBusiness=this.businessFingerprint(state);
      this.options.applyState(state); this.local.removeItem('lungo_cloud_pending');
      this.ready=true; this.open(); this.status.textContent='Base inicial salva no Supabase.';
    } catch(error) {
      this.dialog('A migração não foi confirmada', error.message+' Consulte o banco novamente antes de repetir a migração.', [['Consultar novamente',()=>this.start()],['Exportar backup local',()=>this.backup(original)]]);
    } finally { this.initializing=false; }
  }
  changed() {
    if(!this.ready || !this.enabled) return;
    this.dirty=true;
    try { this.local.setItem('lungo_cloud_pending',JSON.stringify(this.snapshot())); }
    catch { this.localBackupFailed=true; }
    this.status.textContent=this.localBackupFailed?'Backup local indisponível. Aguardando gravação no banco; exporte uma cópia.':'Alterações aguardando gravação no Supabase...';
    clearTimeout(this.timer); this.timer=setTimeout(()=>this.flush(),350);
    if(this.conflicted && !this.options.hasActiveCall?.()) this.showConflict();
  }
  showConflict() {
    this.dialog('Outra aba alterou os dados', 'Para evitar sobrescrever o banco, exporte suas alterações e recarregue. O backup permite conferir os registros pendentes.', [['Exportar backup e recarregar',()=>{this.backup(); location.reload();}]]);
  }
  async flush() {
    if(this.flushPromise)return this.flushPromise;
    this.flushPromise=this.flushOnce();
    try{return await this.flushPromise;}finally{this.flushPromise=null;}
  }
  async flushOnce() {
    if(!this.ready || !this.enabled || this.saving || this.conflicted || (!this.dirty && !this.inFlight)) return;
    this.saving=true; this.retry.hidden=true;
    if(!this.inFlight) { this.inFlight={revision:this.revision,mutationId:crypto.randomUUID(),state:this.snapshot()}; this.dirty=false; }
    try {
      const result=await this.request('PUT',this.inFlight); this.revision=result.revision;
      this.confirmedBusiness=this.businessFingerprint(this.inFlight.state); this.inFlight=null;
      this.status.textContent=this.localBackupFailed?'Dados salvos no Supabase; backup local indisponível. Exporte uma cópia.':'Dados salvos no Supabase.';
      if(!this.dirty) this.local.removeItem('lungo_cloud_pending');
    } catch(error) {
      this.status.textContent='Alterações preservadas localmente. '+error.message;
      if(error.status===409) {
        this.conflicted=true; this.blocked=true;
        if(!this.options.hasActiveCall?.()) this.showConflict();
      } else { this.retry.hidden=false; }
    } finally { this.saving=false; }
    if(this.dirty && !this.inFlight && !this.blocked) await this.flushOnce();
  }
};
