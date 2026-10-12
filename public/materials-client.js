(() => {
  window.CentralMaterials=class {
    constructor(options){
      this.options=options;this.version=0;
      const root=document.createElement('div');root.className='materials-config';root.innerHTML='<hr><h3>Materiais de atendimento · <span id="materialsProduct"></span></h3><p>Salve os materiais permitidos para este produto. Os atendentes escolhem estes arquivos na conversa.</p><label>Nome exibido na conversa</label><input id="materialName" maxlength="80" placeholder="Ex.: Apresentação do produto"><label>Arquivo · até 10 MB</label><input type="file" id="materialUpload" accept="image/jpeg,image/png,image/webp,application/pdf,audio/mpeg,audio/ogg,audio/webm,audio/wav,audio/mp4,.mp3,.ogg,.webm,.wav,.m4a"><button class="btn primary" type="button" id="saveMaterial">Salvar material</button><p id="materialStatus" role="status"></p><div id="materialsList"></div><p class="hint">Os materiais configurados ocupam espaço no armazenamento privado do Supabase. Áudios gravados na conversa não são salvos aqui.</p>';
      document.querySelector('[data-settings-panel=general]').append(root);this.root=root;if(!options.admin)root.hidden=true;
      root.querySelector('#saveMaterial').onclick=()=>this.upload();
      document.addEventListener('click',event=>{if(event.target.closest('[data-tab=settings],[data-settings-tab=general]'))this.refresh();});
    }
    async refresh(){
      if(!this.options.admin||!this.options.ready())return;const product=this.options.product();if(!product)return;
      const version=++this.version;this.root.querySelector('#materialsProduct').textContent=product.name;this.productId=product.id;
      try{const r=await this.options.api('/materials?productId='+encodeURIComponent(product.id));const data=await r.json();if(!r.ok)throw Error(data.error);if(version!==this.version)return;
        const list=this.root.querySelector('#materialsList');list.replaceChildren();
        for(const material of data.materials||[]){const row=document.createElement('div');row.style.cssText='display:flex;align-items:center;gap:8px;margin:8px 0;flex-wrap:wrap';const name=document.createElement('span');name.textContent=material.name+' · '+material.fileName;name.style.cssText='flex:1;overflow-wrap:anywhere;font-size:12px';const remove=document.createElement('button');remove.type='button';remove.className='btn';remove.textContent='Remover';remove.onclick=async()=>{if(!this.options.guard())return;remove.disabled=true;try{const response=await this.options.api('/materials',{method:'DELETE',body:JSON.stringify({productId:product.id,materialId:material.id})});const result=await response.json();if(!response.ok)throw Error(result.error);this.options.changed();await this.refresh();}catch(error){this.status(error.message);}finally{remove.disabled=false;}};row.append(name,remove);list.append(row);}
        if(!data.materials?.length)list.textContent='Nenhum material configurado para este produto.';
        this.status('');
      }catch(error){if(version===this.version)this.status(error.message||'Não foi possível carregar os materiais.');}
    }
    status(text){this.root.querySelector('#materialStatus').textContent=text;}
    async upload(){
      if(!this.options.guard())return;const product=this.options.product(),name=this.root.querySelector('#materialName').value.trim(),file=this.root.querySelector('#materialUpload').files[0];
      if(!name||!file){this.status('Informe o nome e selecione um arquivo.');return;}if(file.size>10*1024*1024||!file.size){this.status('Selecione um arquivo de até 10 MB.');return;}
      const button=this.root.querySelector('#saveMaterial');button.disabled=true;this.status('Salvando material…');
      try{
        await this.options.flush();
        const base64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=reject;reader.readAsDataURL(file);});
        const r=await this.options.api('/materials',{method:'POST',signal:AbortSignal.timeout(45000),body:JSON.stringify({productId:product.id,name,fileName:file.name,base64})});const data=await r.json();if(!r.ok)throw Error(data.error||'O material não foi salvo.');
        this.root.querySelector('#materialName').value='';this.root.querySelector('#materialUpload').value='';this.options.changed();await this.refresh();this.status('Material salvo.');
      }catch(error){this.status(error.message||'Não foi possível salvar o material.');}finally{button.disabled=false;}
    }
  };
})();
