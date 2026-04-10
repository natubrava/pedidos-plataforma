        const CSV_URL = "https://docs.google.com/spreadsheets/d/10m3VsEwqsMYI5UfSxxa1tL208BYxBczlrstr4T-HJJI/export?format=csv&gid=711985533";
        const CLOUDINARY_BASE = "https://res.cloudinary.com/dzjpj67xw/image/upload/w_200,h_200,c_fit,q_auto,f_auto/";
        
        // --- CONSTANTES DE BANCO DE DADOS (SUPABASE) ---
        const SUPABASE_URL = "https://qcxudhpaiqorriclcgyb.supabase.co";
        const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjeHVkaHBhaXFvcnJpY2xjZ3liIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MTcxMTQsImV4cCI6MjA5MTM5MzExNH0.-B7DbaIXMEz3eqS3HQiH6L1O5NavPC3cyXNYgem7_yk";
        const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

        let fornecedores = [];
        let produtos = [];
        let fornecedorAtivo = null;
        let carrinhoGlobal = JSON.parse(localStorage.getItem('carrinho_plataforma') || '{}');
        let uniplusCatalog = [];
        let fuseInstance = null;
        let selectedProductToConfirm = null;

        // --- INICIALIZAÇÃO ---
        document.addEventListener('DOMContentLoaded', async () => {
            await Promise.all([inicializarPlataforma(), loadCatalog()]);
            inicializarDragAndDrop();
        });

        async function inicializarPlataforma() {
            try {
                const { data: dataF, error: errF } = await _supabase.from('fornecedores').select('*').eq('ativo', true).order('ordem');
                if (errF) throw errF;
                fornecedores = dataF;

                if (fornecedores.length > 0) {
                    renderizarAbas();
                    await selecionarFornecedor(fornecedores[0].slug);
                }

                document.getElementById('loader').style.opacity = '0';
                setTimeout(() => document.getElementById('loader').style.display = 'none', 300);
            } catch (e) {
                console.error(e);
                document.getElementById('loader').style.display = 'none';
            }
        }

        // --- CATALOGO E BUSCA INTELIGENTE ---
        async function loadCatalog() {
            const cacheKey = 'uniplus_catalog_cache';
            const timeKey = 'uniplus_catalog_time';
            const cache = localStorage.getItem(cacheKey);
            const time = localStorage.getItem(timeKey);

            if (cache && time && (Date.now() - parseInt(time) < 30 * 60 * 1000)) {
                uniplusCatalog = JSON.parse(cache);
                initFuse();
                return;
            }

            try {
                const response = await fetch(CSV_URL);
                const csvText = await response.text();
                
                Papa.parse(csvText, {
                    header: false,
                    complete: (results) => {
                        const rawData = results.data;
                        // Mapeamento: [0]=Código | [2]=Nome | [4]=Custo | [5]=Venda | [6]=Imagem
                        uniplusCatalog = rawData.slice(1)
                            .filter(row => row[2]) // Precisa ter nome
                            .map(row => ({
                                code: row[0],
                                name: row[2],
                                cost: parseFloat(row[4]?.replace(',', '.')) || 0,
                                sale: parseFloat(row[5]?.replace(',', '.')) || 0,
                                img: row[6] || ''
                            }));
                        
                        localStorage.setItem(cacheKey, JSON.stringify(uniplusCatalog));
                        localStorage.setItem(timeKey, Date.now().toString());
                        initFuse();
                    }
                });
            } catch (e) {
                console.warn('Erro ao carregar catálogo para busca fuzzy:', e);
            }
        }

        function initFuse() {
            fuseInstance = new Fuse(uniplusCatalog, {
                keys: ['name', 'code'],
                threshold: 0.35,
                limit: 10
            });
        }

        // --- UI & TEMAS ---
        function renderizarAbas() {
            const container = document.getElementById('tabs-container');
            container.innerHTML = '';
            fornecedores.forEach(f => {
                const btn = document.createElement('button');
                btn.className = `tab-btn px-6 h-full text-[11px] font-black text-white/40 whitespace-nowrap transition-all uppercase tracking-widest flex items-center gap-2`;
                btn.dataset.slug = f.slug;
                btn.innerHTML = `<span class="text-sm">${f.icone}</span> ${f.nome_aba}`;
                btn.onclick = () => selecionarFornecedor(f.slug);
                container.appendChild(btn);
            });
        }

        async function selecionarFornecedor(slug) {
            if (fornecedorAtivo && fornecedorAtivo.slug === slug) return;
            fornecedorAtivo = fornecedores.find(f => f.slug === slug);
            
            document.body.setAttribute('data-theme', slug);
            document.querySelectorAll('.tab-btn').forEach(b => {
                const active = b.dataset.slug === slug;
                b.classList.toggle('active', active);
                b.classList.toggle('text-white', active);
                b.classList.toggle('scale-105', active);
            });

            document.documentElement.style.setProperty('--primary', fornecedorAtivo.cor_primaria);
            document.documentElement.style.setProperty('--primary-dark', fornecedorAtivo.cor_secundaria);
            document.getElementById('fornecedor-nome').innerText = fornecedorAtivo.nome;
            document.getElementById('label-icone').innerText = fornecedorAtivo.icone;
            
            // Mostrar Botão de Sync apenas para o Mel
            document.getElementById('sync-btn').style.display = (slug === 'meljc') ? 'flex' : 'none';

            await carregarProdutos(slug);
        }

        async function carregarProdutos(slug) {
            const { data, error } = await _supabase.from('produtos').select('*').eq('fornecedor_slug', slug).eq('ativo', true).order('ordem');
            if (error) return console.error(error);
            produtos = data;
            renderizarLista();
        }

        // --- RENDERIZAR LISTA PRINCIPAL ---
        function renderizarLista() {
            const lista = document.getElementById('product-list');
            lista.innerHTML = '';
            const car = carrinhoGlobal[fornecedorAtivo.slug] || {};

            produtos.forEach(p => {
                const qtd = car[p.id] || 0;
                const active = qtd > 0;
                
                let imgHtml = '';
                if (p.img && p.img.length > 5) {
                    imgHtml = `<img src="${p.img.startsWith('http') ? p.img : CLOUDINARY_BASE + p.img}" class="w-full h-full object-contain ${active ? '' : 'grayscale opacity-70'}">`;
                } else if (p.img === 'BALDE') {
                    imgHtml = `<span class="text-xl">🪣</span>`;
                } else {
                    imgHtml = `<span class="text-xl ${active ? '' : 'opacity-40 grayscale'}">${getFallbackEmoji(p.nome)}</span>`;
                }

                lista.insertAdjacentHTML('beforeend', `
                    <div class="premium-card flex items-center h-20 px-4 transition-all ${active ? 'active-item' : ''}" data-id="${p.id}">
                        <div class="drag-handle w-6 text-slate-300 cursor-grab flex justify-center shrink-0 opacity-0 group-hover:opacity-100"><i class="fa-solid fa-grip-vertical"></i></div>
                        <div class="w-12 h-12 bg-white rounded-2xl mx-3 flex items-center justify-center shrink-0 overflow-hidden shadow-sm border border-slate-100">${imgHtml}</div>
                        <div class="flex-1 min-w-0 pr-4">
                            <h3 class="text-[13px] font-black tracking-tight text-inherit truncate leading-tight">${p.nome}</h3>
                            <div class="flex items-center gap-3 mt-1">
                                <span class="text-[10px] font-black text-primary uppercase tracking-widest">${formatMoeda(p.venda)}</span>
                                <span class="text-[9px] font-bold text-slate-400 opacity-60 uppercase">${formatMoeda(p.custo)} un</span>
                            </div>
                        </div>
                        <div class="flex items-center bg-slate-100/50 rounded-2xl p-1 gap-1 border border-slate-200/50">
                            <button onclick="alterarQtd(${p.id}, -1)" class="w-8 h-8 rounded-xl bg-white shadow-sm text-red-500 hover:bg-red-50 flex items-center justify-center transition-all"><i class="fa-solid fa-minus text-[10px]"></i></button>
                            <span class="w-8 text-center text-xs font-black" id="input-${p.id}">${qtd}</span>
                            <button onclick="alterarQtd(${p.id}, 1)" class="w-8 h-8 rounded-xl bg-white shadow-sm text-green-600 hover:bg-green-50 flex items-center justify-center transition-all"><i class="fa-solid fa-plus text-[10px]"></i></button>
                        </div>
                    </div>
                `);
            });
            calcularTotais();
        }

        // --- LÓGICA DE CARRINHO ---
        function alterarQtd(id, delta) {
            const slug = fornecedorAtivo.slug;
            if (!carrinhoGlobal[slug]) carrinhoGlobal[slug] = {};
            let n = (carrinhoGlobal[slug][id] || 0) + delta;
            if (n < 0) n = 0;
            if (n === 0) delete carrinhoGlobal[slug][id]; else carrinhoGlobal[slug][id] = n;
            
            document.getElementById(`input-${id}`).innerText = n;
            const item = document.querySelector(`.premium-card[data-id="${id}"]`);
            item.classList.toggle('active-item', n > 0);
            
            calcularTotais();
            localStorage.setItem('carrinho_plataforma', JSON.stringify(carrinhoGlobal));
            if (!document.getElementById('modal-carrinho').classList.contains('hidden')) renderizarListaDoCarrinho();
        }

        function calcularTotais() {
            let tc = 0, tl = 0, it = 0;
            const car = carrinhoGlobal[fornecedorAtivo.slug] || {};
            produtos.forEach(p => {
                const q = car[p.id] || 0;
                tc += (p.custo || 0) * q; 
                tl += ((p.venda || 0) - (p.custo || 0)) * q;
                if (q > 0) it++;
            });
            document.getElementById('total-custo').innerText = formatMoeda(tc);
            document.getElementById('total-lucro').innerText = formatMoeda(tl);
            const b = document.getElementById('badge-carrinho');
            if (it > 0) { b.innerText = it; b.classList.remove('hidden'); document.getElementById('btn-revisar-text').innerText = "ITENS SELECIONADOS"; }
            else { b.classList.add('hidden'); document.getElementById('btn-revisar-text').innerText = "PEDIDO VAZIO"; }
        }

        // --- WHATSAPP ---
        async function enviarWhatsApp() {
            const car = carrinhoGlobal[fornecedorAtivo.slug] || {}, ip = []; let tp = 0;
            produtos.forEach(p => { 
                const q = car[p.id] || 0; 
                if (q > 0) { 
                    const s = p.custo * q; 
                    tp += s; 
                    ip.push(`▪️ *${q}x* ${p.nome} = *${formatMoeda(s)}*`); 
                } 
            });
            if (ip.length === 0) return;

            const msgHeader = (fornecedorAtivo.texto_whatsapp || "Segue meu pedido:") + `\n\n*FORNECEDOR: ${fornecedorAtivo.nome.toUpperCase()}*\n-----------------------------------\n`;
            const msgFooter = `\n-----------------------------------\n📊 *TOTAL DO PEDIDO:* ${formatMoeda(tp)}\n\n_Enviado via NatuBrava Orders_`;
            const msgTotal = msgHeader + ip.join('\n') + msgFooter;

            const { error } = await _supabase.from('pedidos').insert({ fornecedor_slug: fornecedorAtivo.slug, itens: car, total_custo: tp, enviado_whatsapp: true });
            
            window.open(`https://wa.me/${fornecedorAtivo.telefone}?text=${encodeURIComponent(msgTotal)}`, '_blank');
        }

        // --- BUSCA NA PLANILHA UNIPLUS ---
        function abrirNovoItemSearch() {
            document.getElementById('modal-search-planilha').classList.remove('hidden');
            setTimeout(() => document.getElementById('modal-search-planilha').classList.remove('opacity-0'), 10);
            document.getElementById('label-fornecedor-filtro').innerText = fornecedorAtivo.nome;
            document.getElementById('uniplus-search-input').focus();
            
            // Setup listener
            document.getElementById('uniplus-search-input').oninput = (e) => {
                const q = e.target.value.trim();
                const dd = document.getElementById('search-results-dropdown');
                if (q.length < 2) { dd.style.display = 'none'; return; }
                
                const results = fuseInstance.search(q);
                // Filtro bruto por fornecedor
                const filtered = results.filter(r => {
                    const name = r.item.name.toLowerCase();
                    if (fornecedorAtivo.slug === 'makrobom') return name.includes('makrobom');
                    if (fornecedorAtivo.slug === 'muller') return name.includes('muller');
                    return true;
                }).slice(0, 5);

                if (filtered.length > 0) {
                    dd.innerHTML = filtered.map(r => `
                        <div class="fuzzy-item" onclick="selecionarParaAdd(${JSON.stringify(r.item).replace(/"/g, '&quot;')})">
                            <div class="text-[11px] font-black text-slate-800">${r.item.name}</div>
                            <div class="text-[9px] text-slate-400 font-bold uppercase">Cód: ${r.item.code} • Custo: ${formatMoeda(r.item.cost)}</div>
                        </div>
                    `).join('');
                    dd.style.display = 'block';
                } else {
                    dd.innerHTML = '<div class="p-4 text-[10px] text-slate-400 font-black uppercase text-center">Nenhum resultado</div>';
                    dd.style.display = 'block';
                }
            };
        }

        function selecionarParaAdd(item) {
            selectedProductToConfirm = item;
            document.getElementById('search-results-dropdown').style.display = 'none';
            document.getElementById('uniplus-search-input').value = item.name;
            document.getElementById('prev-nome').innerText = item.name;
            document.getElementById('prev-custo').innerText = formatMoeda(item.cost);
            document.getElementById('prev-cod').innerText = item.code;
            document.getElementById('selected-preview').classList.remove('hidden');
            document.getElementById('selected-empty').classList.add('hidden');
        }

        function fecharNovoItemSearch() {
            const m = document.getElementById('modal-search-planilha');
            m.classList.add('opacity-0');
            setTimeout(() => m.classList.add('hidden'), 300);
            selectedProductToConfirm = null;
            document.getElementById('selected-preview').classList.add('hidden');
            document.getElementById('selected-empty').classList.remove('hidden');
            document.getElementById('uniplus-search-input').value = '';
        }

        function confirmarAddProduto() {
            if (!selectedProductToConfirm) return;
            const id = "tmp_" + Date.now();
            document.getElementById('lista-edicao').insertAdjacentHTML('afterbegin', renderItemEdicao({
                id,
                nome: selectedProductToConfirm.name,
                custo: selectedProductToConfirm.cost,
                venda: selectedProductToConfirm.sale,
                img: selectedProductToConfirm.img || '📦',
                codigo_uniplus: selectedProductToConfirm.code
            }));
            fecharNovoItemSearch();
        }

        // --- SINCRONIZAÇÃO DO MEL ---
        function confirmarSyncMel() {
            const m = document.getElementById('modal-confirm-sync');
            m.classList.remove('hidden');
            setTimeout(() => m.classList.remove('opacity-0'), 10);
        }

        function fecharConfirmSync() {
            const m = document.getElementById('modal-confirm-sync');
            m.classList.add('opacity-0');
            setTimeout(() => m.classList.add('hidden'), 300);
        }

        async function executarSyncMel() {
            const btn = document.querySelector('#modal-confirm-sync button:last-child');
            btn.innerHTML = '<i class="fa-solid fa-sync fa-spin"></i> SINCRONIZANDO...';
            btn.disabled = true;

            try {
                // Pega os produtos atuais do Mel que têm codigo_uniplus
                const { data: localProds, error } = await _supabase.from('produtos').select('*').eq('fornecedor_slug', 'meljc').eq('ativo', true);
                if (error) throw error;

                const updates = [];
                localProds.forEach(lp => {
                    // Tenta achar na planilha por código (prioridade) ou nome normalizado
                    const match = uniplusCatalog.find(c => c.code === lp.codigo_uniplus) || 
                                  uniplusCatalog.find(c => normalize(c.name) === normalize(lp.nome));

                    if (match) {
                        updates.push({
                            id: lp.id,
                            custo: match.cost,
                            venda: match.sale,
                            img: match.img || lp.img,
                            codigo_uniplus: match.code
                        });
                    }
                });

                if (updates.length > 0) {
                    const { error: upErr } = await _supabase.from('produtos').upsert(updates);
                    if (upErr) throw upErr;
                    alert(`✅ ${updates.length} produtos atualizados com sucesso!`);
                } else {
                    alert("Nenhum produto correspondente encontrado na planilha catálogo.");
                }

                await carregarProdutos('meljc');
                fecharConfirmSync();
            } catch (e) {
                console.error(e);
                alert("Erro ao sincronizar: " + e.message);
            } finally {
                btn.innerHTML = 'SIM, ATUALIZAR';
                btn.disabled = false;
            }
        }

        // --- SALVAR CONFIGS ---
        async function salvarConfiguracoes() {
            const mainBtn = document.querySelector('#modal-config button:last-child');
            mainBtn.innerHTML = '⏳ SALVANDO...';
            
            // 1. Atualizar dados do Fornecedor
            const newPhone = document.getElementById('config-whatsapp').value.trim();
            const newText = document.getElementById('config-template').value.trim();
            const { error: errF } = await _supabase.from('fornecedores').update({ telefone: newPhone, texto_whatsapp: newText }).eq('slug', fornecedorAtivo.slug);
            
            // 2. Atualizar Produtos
            const up = [];
            document.querySelectorAll('.edit-item-box').forEach((box, index) => {
                const id = box.dataset.id;
                const n = document.getElementById(`edit-nome-${id}`).value.trim().toUpperCase();
                const c = parseFloat(document.getElementById(`edit-custo-${id}`).value) || 0;
                const v = parseFloat(document.getElementById(`edit-venda-${id}`).value) || 0;
                const i = document.getElementById(`edit-img-${id}`).value.trim();
                const cod = document.getElementById(`edit-cod-${id}`).value.trim();
                
                if (!n) return;
                const o = { fornecedor_slug: fornecedorAtivo.slug, nome: n, custo: c, venda: v, img: i, codigo_uniplus: cod, ordem: index + 1, ativo: true };
                if (!id.startsWith('tmp_')) o.id = parseInt(id);
                up.push(o);
            });

            const { error: errP } = await _supabase.from('produtos').upsert(up);
            
            if (errF || errP) alert("Erro ao salvar: " + (errF?.message || errP?.message));
            else {
                fornecedorAtivo.telefone = newPhone;
                fornecedorAtivo.texto_whatsapp = newText;
                await carregarProdutos(fornecedorAtivo.slug);
                fecharConfiguracoes();
            }
            mainBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up mr-1"></i> SALVAR ALTERAÇÕES';
        }

        // --- UTILITÁRIOS ---
        function abrirConfiguracoes() {
            document.getElementById('config-supplier-name').innerText = fornecedorAtivo.nome;
            document.getElementById('config-whatsapp').value = fornecedorAtivo.telefone || '';
            document.getElementById('config-template').value = fornecedorAtivo.texto_whatsapp || '';
            document.getElementById('lista-edicao').innerHTML = '';
            produtos.forEach(p => document.getElementById('lista-edicao').insertAdjacentHTML('beforeend', renderItemEdicao(p)));
            showModal('modal-config', 'modal-content');
        }

        function renderItemEdicao(p) {
            return `<div class="edit-item-box bg-white p-5 rounded-3xl border border-slate-200 shadow-sm" id="edit-item-${p.id}" data-id="${p.id}">
                <div class="flex justify-between items-start gap-4 mb-4">
                    <div class="flex-1">
                        <label class="block text-[8px] font-black text-slate-300 uppercase mb-1 ml-1">NOME DO PRODUTO</label>
                        <input type="text" id="edit-nome-${p.id}" value="${p.nome}" class="w-full bg-slate-50 border-none rounded-xl p-3 text-xs text-slate-900 font-black focus:ring-2 focus:ring-primary/20 outline-none">
                    </div>
                    <button onclick="removerProdutoEdicao('${p.id}')" class="w-10 h-10 rounded-xl bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100 transition-all shrink-0"><i class="fa-solid fa-trash-can text-sm"></i></button>
                </div>
                <div class="grid grid-cols-3 gap-3">
                    <div>
                        <label class="block text-[8px] font-black text-slate-300 uppercase mb-1 ml-1">CUSTO</label>
                        <input type="number" step="0.01" id="edit-custo-${p.id}" value="${p.custo}" class="w-full bg-slate-50 border-none rounded-xl p-3 text-xs font-bold text-slate-900 outline-none">
                    </div>
                    <div>
                        <label class="block text-[8px] font-black text-slate-300 uppercase mb-1 ml-1">VENDA</label>
                        <input type="number" step="0.01" id="edit-venda-${p.id}" value="${p.venda}" class="w-full bg-slate-50 border-none rounded-xl p-3 text-xs font-bold text-slate-900 outline-none">
                    </div>
                    <div>
                        <label class="block text-[8px] font-black text-slate-300 uppercase mb-1 ml-1">CÓD. UNIPLUS</label>
                        <input type="text" id="edit-cod-${p.id}" value="${p.codigo_uniplus || ''}" class="w-full bg-slate-50 border-none rounded-xl p-3 text-[10px] text-center font-black text-primary outline-none">
                    </div>
                </div>
                <div class="mt-3">
                    <label class="block text-[8px] font-black text-slate-300 uppercase mb-1 ml-1">IMAGEM (ID CLOUDINARY OU EMOJI)</label>
                    <input type="text" id="edit-img-${p.id}" value="${p.img || ''}" class="w-full bg-slate-50 border-none rounded-xl p-3 text-[10px] font-bold text-slate-900 outline-none">
                </div>
            </div>`;
        }

        async function removerProdutoEdicao(id) {
            if (!confirm("Excluir definitivamente?")) return;
            if (id.startsWith('tmp_')) {
                document.getElementById(`edit-item-${id}`).remove();
                return;
            }
            const { error } = await _supabase.from('produtos').update({ ativo: false }).eq('id', id);
            if (error) alert(error.message); else { document.getElementById(`edit-item-${id}`).remove(); await carregarProdutos(fornecedorAtivo.slug); }
        }

        function formatMoeda(v) { return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
        function normalize(s) { return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim(); }
        function getFallbackEmoji(n) { const l = n.toLowerCase(); if(l.includes('favo')) return '🐝'; if(l.includes('propolis')) return '💧'; if(l.includes('polen')) return '🌼'; return '📦'; }
        function filtrarProdutos() { const t = document.getElementById('searchInput').value.toLowerCase(); document.querySelectorAll('.premium-card').forEach(i => { i.style.display = i.querySelector('h3').innerText.toLowerCase().includes(t) ? 'flex' : 'none'; }); }
        function limparTudo() { if (confirm("Limpar itens selecionados?")) { delete carrinhoGlobal[fornecedorAtivo.slug]; localStorage.setItem('carrinho_plataforma', JSON.stringify(carrinhoGlobal)); renderizarLista(); } }
        function abrirCarrinho() { if (Object.keys(carrinhoGlobal[fornecedorAtivo.slug] || {}).length === 0) return; renderizarListaDoCarrinho(); showModal('modal-carrinho', 'modal-carrinho-content'); }
        function fecharCarrinho() { hideModal('modal-carrinho', 'modal-carrinho-content'); }
        function fecharConfiguracoes() { hideModal('modal-config', 'modal-content'); }
        function showModal(id, cId) { const m = document.getElementById(id); m.classList.remove('hidden'); setTimeout(() => { m.classList.remove('opacity-0'); m.querySelector('div').classList.remove('translate-y-full'); }, 10); }
        function hideModal(id, cId) { const m = document.getElementById(id); m.classList.add('opacity-0'); m.querySelector('div').classList.add('translate-y-full'); setTimeout(() => m.classList.add('hidden'), 300); }
        
        function renderizarListaDoCarrinho() { 
            const l = document.getElementById('lista-carrinho'); l.innerHTML = ''; let t = 0; 
            const c = carrinhoGlobal[fornecedorAtivo.slug] || {}; 
            produtos.forEach(p => { 
                const q = c[p.id] || 0; 
                if (q > 0) { 
                    const s = p.custo * q; t += s; 
                    l.insertAdjacentHTML('beforeend', `
                        <div class="bg-white p-4 rounded-2xl border border-slate-100 mb-2 flex justify-between items-center shadow-sm">
                            <div class="flex-1">
                                <h4 class="text-xs font-black text-slate-800 uppercase">${p.nome}</h4>
                                <div class="text-[10px] text-slate-400 font-bold mt-0.5">${formatMoeda(p.custo)} /un</div>
                            </div>
                            <div class="text-right flex flex-col items-end gap-2">
                                <span class="text-sm font-black text-slate-900">${formatMoeda(s)}</span>
                                <div class="flex items-center bg-slate-100 px-1 py-1 rounded-xl">
                                    <button onclick="alterarQtd(${p.id}, -1)" class="w-6 h-6 flex items-center justify-center text-red-500"><i class="fa-solid fa-minus text-[8px]"></i></button>
                                    <span class="px-3 text-xs font-black">${q}</span>
                                    <button onclick="alterarQtd(${p.id}, 1)" class="w-6 h-6 flex items-center justify-center text-green-600"><i class="fa-solid fa-plus text-[8px]"></i></button>
                                </div>
                            </div>
                        </div>`); 
                } 
            }); 
            document.getElementById('carrinho-total-modal').innerText = formatMoeda(t); 
            if (t === 0) fecharCarrinho(); 
        }

        function inicializarDragAndDrop() { 
            Sortable.create(document.getElementById('product-list'), { 
                handle: '.drag-handle', 
                animation: 250, 
                ghostClass: 'opacity-50',
                onEnd: async () => { 
                    const ups = Array.from(document.querySelectorAll('.premium-card')).map((el, i) => ({ id: parseInt(el.dataset.id), ordem: i + 1 })); 
                    const { error } = await _supabase.from('produtos').upsert(ups); 
                    if (error) console.error(error); 
                } 
            }); 
        }
