(() => {
  const style=document.createElement('style');style.textContent='.chat-attachments{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}.chat-attachments select{flex:1;min-width:100px;max-width:100%;border:1px solid #dbe4ed;border-radius:8px;padding:6px;font-size:11px}.chat-attachments .is-recording{background:#e32943;color:white;border-color:#e32943;animation:recordingPulse 1.1s ease-in-out infinite}.chat-attachments .is-recording svg{stroke:white}@keyframes recordingPulse{50%{box-shadow:0 0 0 5px #e3294326;filter:brightness(1.15)}}@media(prefers-reduced-motion:reduce){.chat-attachments .is-recording{animation:none}}.chat-attachments .btn{display:inline-flex;align-items:center;gap:5px}.chat-attachments svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.chat-file-preview{font-size:12px;overflow-wrap:anywhere;color:#435366}.chat-file-preview audio,.chat-bubble audio{display:block;max-width:100%;width:270px;height:38px;margin-top:7px}.chat-file-preview button{margin:5px}.chat-file-preview[hidden]{display:none}';document.head.append(style);
  const icon=paths=>`<svg viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;
  window.CentralMedia=class {
    constructor(options){
      this.options=options;this.file=null;this.urls=new Set();this.requests=new Set();this.closed=false;this.recording=false;this.busy=false;
      const root=options.root;root.insertAdjacentHTML('afterbegin',`<div class="chat-attachments"><select data-media="materials" aria-label="Material configurado"><option value="">Materiais do produto</option></select><button class="btn" type="button" data-media="record" title="Gravar áudio" aria-label="Gravar áudio">${icon('<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/>')}<span>Gravar áudio</span></button></div><div class="chat-file-preview" data-media="preview" hidden></div>`);
      this.preview=root.querySelector('[data-media=preview]');this.recordButton=root.querySelector('[data-media=record]');this.materialSelect=root.querySelector('[data-media=materials]');
      this.materialSelect.onchange=()=>{if(this.recording||this.busy)return;const material=this.materials?.find(m=>m.id===this.materialSelect.value);this.clear();if(material){this.file={materialId:material.id,kind:material.kind,fileName:material.fileName,name:material.name};this.preview.hidden=false;const label=document.createElement('span');label.textContent=material.name;const remove=document.createElement('button');remove.type='button';remove.className='btn';remove.textContent='Remover seleção';remove.onclick=()=>{if(!this.busy)this.clear();};this.preview.append(label,remove);this.materialSelect.value=material.id;}};
      this.recordButton.onclick=()=>this.toggleRecording();this.refreshMaterials();

    }
    async refreshMaterials(force=false){
      if(this.busy||this.recording||this.materialLoading&&!force)return;this.materialLoading=true;
      this.materialAbort?.abort();const controller=this.materialAbort=new AbortController();
      try{const response=await this.options.api('/materials?productId='+encodeURIComponent(this.options.product()),{signal:controller.signal});const data=await response.json();if(!response.ok)throw Error(data.error||'Materiais indisponíveis.');if(this.closed)return;
        this.materials=data.materials||[];this.materialRefreshedAt=Date.now();const selected=this.file?.materialId;this.materialSelect.replaceChildren(new Option('Materiais do produto',''));for(const m of this.materials)this.materialSelect.add(new Option(m.name,m.id));
        if(selected&&!this.materials.some(m=>m.id===selected))this.clear();else this.materialSelect.value=selected||'';
      }catch(error){if(!this.closed&&error.name!=='AbortError')this.options.error(error.message);}
      finally{if(this.materialAbort===controller)this.materialLoading=false;}
    }
    select(file,kind,fromRecording=false){
      if(this.closed||this.busy&&!fromRecording)return;if(!file.size||file.size>10*1024*1024)throw Error('Selecione um arquivo de até 10 MB.');
      this.clear();this.file={blob:file,kind,fileName:file.name||'gravacao.webm'};
      this.preview.hidden=false;const label=document.createElement('span');label.textContent=this.file.fileName+' · '+(file.size/1024).toFixed(0)+' KB';this.preview.append(label);
      if(kind==='audio'){const audio=document.createElement('audio');audio.controls=true;audio.src=this.url(file);this.preview.append(audio);}
      const remove=document.createElement('button');remove.type='button';remove.className='btn';remove.textContent='Remover';remove.disabled=this.busy;remove.onclick=()=>{if(!this.busy)this.clear();};this.preview.append(remove);
    }
    url(blob){const url=URL.createObjectURL(blob);this.urls.add(url);return url;}
    clear(){this.preview.querySelectorAll('audio').forEach(a=>{a.pause();this.urls.delete(a.src);URL.revokeObjectURL(a.src);});this.file=null;if(this.materialSelect)this.materialSelect.value='';this.preview.replaceChildren();this.preview.hidden=true;}
    setBusy(value){this.busy=value;this.options.root.querySelectorAll('.chat-attachments button,.chat-attachments select,.chat-file-preview button').forEach(b=>b.disabled=value);if(this.recording)this.materialSelect.disabled=true;}
    async payload(caption){
      if(this.recording||this.starting)throw Error('Pare a gravação antes de enviar.');
      const file=this.file;if(!file)return null;
      if(file.kind==='audio'&&caption.trim())throw Error('Envie o texto separadamente do áudio ou limpe o campo de texto.');
      if(file.materialId)return {materialId:file.materialId,kind:file.kind,fileName:file.fileName,caption};
      const base64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(Error('Não foi possível ler o arquivo.'));reader.readAsDataURL(file.blob);});
      return {base64,kind:file.kind,fileName:file.fileName,caption};
    }
    async toggleRecording(){
      if(this.busy||this.starting)return;
      if(this.recording){if(this.recorder.state==='recording')this.recorder.stop();this.stream?.getTracks().forEach(t=>t.stop());return;}
      if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){this.options.error('Gravação indisponível. Use HTTPS e permita o microfone, ou escolha um material de áudio configurado.');return;}
      this.starting=true;this.recordButton.disabled=true;
      try{
        const stream=await navigator.mediaDevices.getUserMedia({audio:true});if(this.closed||this.busy){stream.getTracks().forEach(t=>t.stop());return;}this.stream=stream;
        const mime=['audio/webm;codecs=opus','audio/ogg;codecs=opus','audio/mp4'].find(type=>MediaRecorder.isTypeSupported(type));if(!mime)throw Error('Formato de gravação não suportado. Escolha um material de áudio configurado.');
        this.recorder=new MediaRecorder(stream,{mimeType:mime});const chunks=[];let size=0;
        this.recorder.ondataavailable=e=>{if(e.data.size){size+=e.data.size;chunks.push(e.data);if(size>10*1024*1024&&this.recorder.state==='recording')this.recorder.stop();}};
        this.recorder.onerror=()=>{this.options.error('A gravação falhou.');this.finishRecording();};
        this.recorder.onstop=()=>{this.finishRecording();if(!this.closed){try{const ext=mime.includes('ogg')?'ogg':mime.includes('mp4')?'m4a':'webm';this.select(new File(chunks,'gravacao.'+ext,{type:mime}),'audio',true);}catch(error){this.options.error(error.message);}}};
        this.recorder.start(1000);this.recording=true;this.recordButton.classList.add('is-recording');this.recordButton.setAttribute('aria-pressed','true');const started=Date.now(),update=()=>{const seconds=Math.floor((Date.now()-started)/1000);this.recordButton.querySelector('span').textContent='Parar · '+String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');;this.recordButton.title=this.recordButton.querySelector('span').textContent;this.recordButton.setAttribute('aria-label',this.recordButton.title);};update();this.clock=setInterval(update,1000);this.materialSelect.disabled=true;
        this.timer=setTimeout(()=>{if(this.recorder.state==='recording')this.recorder.stop();},120000);
      }catch(error){this.stream?.getTracks().forEach(t=>t.stop());this.options.error(error.name==='NotAllowedError'?'Permita o acesso ao microfone para gravar.':error.message);}
      finally{this.starting=false;if(!this.closed)this.recordButton.disabled=this.busy;}
    }
    finishRecording(){clearTimeout(this.timer);clearInterval(this.clock);this.recordButton.classList.remove('is-recording');this.recordButton.setAttribute('aria-pressed','false');this.materialSelect.disabled=this.busy;this.recording=false;this.stream?.getTracks().forEach(t=>t.stop());if(!this.closed){this.recordButton.querySelector('span').textContent='Gravar áudio';this.recordButton.title='Gravar áudio';this.recordButton.setAttribute('aria-label','Gravar áudio');}}
    async listen(button,contactId,messageId){
      if(button.disabled||this.closed)return;button.disabled=true;button.textContent='Carregando áudio…';
      const controller=new AbortController();this.requests.add(controller);
      try{const r=await this.options.api('/audio?contactId='+encodeURIComponent(contactId)+'&messageId='+encodeURIComponent(messageId),{signal:controller.signal});if(!r.ok){const data=await r.json();throw Error(data.error||'Áudio indisponível.');}const blob=await r.blob();if(this.closed||!button.isConnected)return;const audio=document.createElement('audio');audio.controls=true;audio.preload='metadata';audio.src=this.url(blob);button.replaceWith(audio);audio.onerror=()=>this.options.error('O navegador não conseguiu reproduzir esse áudio.');}
      catch(error){if(!this.closed&&error.name!=='AbortError'){button.disabled=false;button.textContent='Tentar ouvir novamente';this.options.error(error.message);}}
      finally{this.requests.delete(controller);}
    }
    dispose(){this.closed=true;clearTimeout(this.timer);clearInterval(this.clock);this.materialAbort?.abort();if(this.recorder){this.recorder.onstop=null;if(this.recorder.state==='recording')this.recorder.stop();}this.stream?.getTracks().forEach(t=>t.stop());this.requests.forEach(c=>c.abort());this.options.root.closest('.chat-window')?.querySelectorAll('audio').forEach(a=>a.pause());this.urls.forEach(url=>URL.revokeObjectURL(url));this.urls.clear();}
  };
})();
