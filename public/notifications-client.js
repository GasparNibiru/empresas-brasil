(() => {
  // Dois tons curtos, gerados localmente; não dependem de arquivos externos.
  class NotificationSound {
    constructor(){this.last=-Infinity;this.unlock=()=>{try{const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;this.context??=new Audio();this.context.resume().catch(()=>{});}catch{}};window.addEventListener('pointerdown',this.unlock);window.addEventListener('keydown',this.unlock);}
    play(){const ctx=this.context;if(!ctx||ctx.state!=='running'||Date.now()-this.last<700)return;this.last=Date.now();try{const start=ctx.currentTime;for(const [offset,frequency] of [[0,660],[.18,880]]){const oscillator=ctx.createOscillator(),gain=ctx.createGain();oscillator.type='sine';oscillator.frequency.value=frequency;gain.gain.setValueAtTime(0,start+offset);gain.gain.linearRampToValueAtTime(.09,start+offset+.04);gain.gain.exponentialRampToValueAtTime(.001,start+offset+.3);oscillator.connect(gain);gain.connect(ctx.destination);oscillator.start(start+offset);oscillator.stop(start+offset+.32);oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};}}catch{}}
    dispose(){window.removeEventListener?.('pointerdown',this.unlock);window.removeEventListener?.('keydown',this.unlock);this.context?.close().catch(()=>{});}
  }
  const style=document.createElement('style');style.textContent='.ico[data-act="chat"]{position:relative}.ico[data-act="chat"].chat-unread:after{content:"";position:absolute;right:-2px;top:-2px;width:8px;height:8px;border-radius:50%;background:#ef233c;border:2px solid white}';document.head.append(style);
  window.CentralNotifications=class {
    constructor(options){this.options=options;this.sound=new NotificationSound();this.sounded=new Set();this.latest=new Map();this.announced=new Set();this.startedAt=Date.now();this.key='lungo_chat_seen_v1';try{this.seen=JSON.parse(options.storage.getItem(this.key)||'{}');if(!this.seen||typeof this.seen!=='object'||Array.isArray(this.seen))this.seen={};}catch{this.seen={};}this.poll();window.addEventListener('pagehide',()=>this.dispose());}
    keyFor(lead){return lead.id+':'+String(lead.phones||'').split(';')[0].replace(/\D/g,'');}
    unread(lead){if(lead.returnedToCatalog||lead.leadState==='reject'||lead.stage==='não quer')return false;const update=this.latest.get(String(lead.id)),seen=this.seen[this.keyFor(lead)];if(!update||update.contactKey!==this.keyFor(lead))return false;if(!seen)return true;return update.at&&seen.at?update.at>seen.at||update.at===seen.at&&!seen.ids.includes(update.messageId):!seen.ids.includes(update.messageId);}
    soundFor(lead,update){const key=this.keyFor(lead)+':'+update.messageId;if(this.sounded.has(key)||lead.leadState==='reject'||lead.stage==='não quer')return;this.sounded.add(key);if(!this.options.isExpanded?.(lead))this.sound.play();}
    markRead(lead,messages){
      const inbound=messages.filter(m=>m.direction==='in'&&m.messageId);if(!inbound.length)return;const latest=inbound.reduce((a,b)=>String(a.at||'')>=String(b.at||'')?a:b),key=this.keyFor(lead),old=this.seen[key];
      if(old?.at&&latest.at&&old.at>latest.at)return;
      const ids=inbound.filter(m=>(m.at||null)===(latest.at||null)).map(m=>m.messageId);if(old?.at===(latest.at||null))ids.push(...old.ids);
      this.seen[key]={at:latest.at||null,ids:[...new Set(ids)].slice(-100)};try{this.options.storage.setItem(this.key,JSON.stringify(this.seen));}catch{}this.decorate();
    }
    decorate(){for(const button of document.querySelectorAll('[data-act="chat"]')){const lead=this.options.leads().find(l=>String(l.id)===button.dataset.id),unread=lead&&this.unread(lead);button.classList.toggle('chat-unread',Boolean(unread));button.title=unread?'Abrir conversa · nova mensagem do cliente':'Abrir conversa';button.setAttribute('aria-label',button.title);}}
    acceptUpdates(updates){
      for(const update of updates){
        const lead=this.options.leads().find(l=>String(l.id)===String(update.contactId));if(!lead||lead.returnedToCatalog)continue;
        const key=this.keyFor(lead),previous=this.latest.get(String(lead.id)),messageKey=key+':'+update.messageId;
        if(previous?.contactKey===key&&update.at&&previous.at&&update.at<previous.at)continue;
        const fresh=previous?.contactKey===key?update.messageId!==previous.messageId&&(!update.at||!previous.at||update.at>=previous.at):Date.parse(update.at)>=this.startedAt-1000;
        this.latest.set(String(lead.id),{...update,contactKey:key});
        if(fresh&&this.unread(lead)&&!this.announced.has(messageKey)){this.announced.add(messageKey);this.soundFor(lead,update);this.options.onIncoming?.(lead);}
      }
      this.decorate();
    }
    health(message){this.healthMessage=message;const top=document.getElementById('connState');if(top){top.title=message;top.textContent=message?'WhatsApp: atualização indisponível':'WhatsApp: atualização ativa';}let status=document.getElementById('chatSyncStatus');if(!status){status=document.createElement('span');status.id='chatSyncStatus';status.style.cssText='font-size:11px;color:#ad5700;margin-left:8px';document.querySelector('#settings .settings')?.prepend(status);}status.textContent=message;status.title=message;this.options.onHealth?.(message);}
    async poll(){
      if(this.closed)return;
      if(this.options.ready()&&!document.hidden){this.abort=new AbortController();try{const r=await this.options.api('/chat-updates',{signal:this.abort.signal});const data=await r.json();if(!r.ok)throw Error(data.error||'Falha ao consultar novas mensagens.');if(!this.closed&&Array.isArray(data.updates)){this.acceptUpdates(data.updates);this.health(data.incomplete?'Há mensagens fora da janela de atualização. Abra o histórico do contato.':'');}}catch(e){if(e.name!=='AbortError')this.health('Atualização de mensagens indisponível. '+e.message);}}
      if(!this.closed)this.timer=setTimeout(()=>this.poll(),this.options.ready()?15000:1000);
    }
    dispose(){this.sound.dispose();this.closed=true;clearTimeout(this.timer);this.abort?.abort();}
  };
})();
