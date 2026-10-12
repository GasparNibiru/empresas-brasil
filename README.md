# Central de ligações — frontend

Frontend extraído de GasparNibiru/central-lungo, versão d8bb973. Backend, Supabase e Evolution continuam na VPS. Nenhuma chave ou base de contatos é incluída.

## Publicar no Netlify

Importe este repositório, branch main. Sem comando de build. Diretório publicado: public. A configuração está em netlify.toml. Não adicionar chaves Supabase/Evolution no Netlify.

O proxy /api mantém as chamadas no mesmo endereço do frontend e encaminha para a VPS. O login usa cookie HttpOnly; a interface consulta /api/me antes de carregar scripts e separa armazenamento local por vendedor. Configurações antigas de backend são ajustadas para o proxy na leitura.

## Validação pendente no endereço publicado

Teste login/admin/vendedor, salvar e recarregar, isolamento, logout, texto, áudio e materiais. A VPS deve estar ligada com a versão atual das proteções. Não desativar proteção de origem se o proxy apresentar erro: conferir cabeçalhos e configuração antes de ajustar.

O proxy Netlify tem timeout de 26 segundos; fila concorrente e mídias demoradas podem excedê-lo. Após timeout, conferir a conversa/recibo antes de reenviar. O frontend conserva pendingSend e recuperação de recibos; não promete sucesso imediato nesses casos. Referência: https://docs.netlify.com/manage/routing/redirects/rewrites-proxies/

O novo domínio tem armazenamento local separado: dados salvos no Supabase continuam disponíveis após login, mas rascunhos e alterações ainda não sincronizadas no domínio antigo não migram automaticamente. Concluir gravações e guardar backup antes de trocar.

Este checkout é uma cópia independente. Alterações futuras na Central precisam ser portadas para este repositório; não há sincronização automática. Não hospeda servidor Node no Netlify e não substitui a VPS. Deploy real ainda não validado.


## Produtos definidos pelo administrador

O master nomeia as abas, organiza os contatos por produto e atribui os lotes. O corretor recebe essa organizacao e atende sem editar nomes ou redistribuir contatos. Requer backend atualizado e migracao admin_products (014), aplicada no Supabase. Reenviar lotes atualiza as definicoes do master e preserva o atendimento.
