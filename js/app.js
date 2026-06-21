        const CSV_URL = "https://docs.google.com/spreadsheets/d/10m3VsEwqsMYI5UfSxxa1tL208BYxBczlrstr4T-HJJI/export?format=csv&gid=711985533";
        const EDICAO_CSV_URL = "https://docs.google.com/spreadsheets/d/10m3VsEwqsMYI5UfSxxa1tL208BYxBczlrstr4T-HJJI/export?format=csv&gid=1274849389";
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
        function parseNumberBr(str) {
            if (!str) return 0;
            if (typeof str === 'number') return str;
            let s = str.toString().trim();
            if (s.indexOf(',') !== -1 && s.indexOf('.') !== -1) {
                s = s.replace(/\./g, '').replace(',', '.');
            } else if (s.indexOf(',') !== -1) {
                s = s.replace(',', '.');
            }
            const parsed = parseFloat(s);
            return isNaN(parsed) ? 0 : parsed;
        }

        async function loadCatalog() {
            const cacheKey = 'uniplus_catalog_cache_v2';
            const timeKey = 'uniplus_catalog_time_v2';
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
                        // Mapeamento: [0]=Código | [2]=Nome | [3]=Estoque | [4]=Custo | [5]=Venda | [6]=Data (No Makrobom antigo era Img)
                        uniplusCatalog = rawData.slice(1)
                            .filter(row => row[2]) // Precisa ter nome
                            .map(row => ({
                                code: row[0],
                                name: row[2],
                                stock: parseNumberBr(row[3]),
                                cost: parseFloat(row[4]?.replace(',', '.')) || 0,
                                sale: parseFloat(row[5]?.replace(',', '.')) || 0,
                                img: (row[6] && !row[6].includes('/')) ? row[6] : '' // Previne que Datas quebrem a imagem
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
                btn.className = `tab-btn px-4 h-full rounded-xl text-[11px] font-black text-white/50 whitespace-nowrap transition-all uppercase tracking-widest flex items-center gap-2 border border-transparent flex-1 justify-center max-w-[140px]`;
                btn.dataset.slug = f.slug;
                btn.innerHTML = `<span class="text-sm scale-110 drop-shadow-md">${f.icone}</span> ${f.nome_aba}`;
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
                if (active) {
                    b.classList.remove('text-white/50', 'border-transparent');
                    b.classList.add('bg-white', 'text-primary', 'border-white/20', 'shadow-[0_10px_20px_-5px_rgba(0,0,0,0.3)]', 'scale-[1.02]', 'z-10');
                } else {
                    b.classList.remove('bg-white', 'text-primary', 'border-white/20', 'shadow-[0_10px_20px_-5px_rgba(0,0,0,0.3)]', 'scale-[1.02]', 'z-10');
                    b.classList.add('text-white/50', 'border-transparent');
                }
            });

            document.documentElement.style.setProperty('--primary', fornecedorAtivo.cor_primaria);
            document.documentElement.style.setProperty('--primary-dark', fornecedorAtivo.cor_secundaria);
            
            // Mostrar Botão de Sync apenas para fornecedores com filtro_planilha configurado
            document.getElementById('sync-btn').style.display = (fornecedorAtivo.filtro_planilha) ? 'flex' : 'none';

            await carregarProdutos(slug);
        }

        async function carregarProdutos(slug) {
            const { data, error } = await _supabase.from('produtos').select('*').eq('fornecedor_slug', slug).eq('ativo', true).order('ordem');
            if (error) return console.error(error);
            produtos = data;
            renderizarLista();
        }

        // --- TABELA DE CONVERSÕES ---
        const makrobomConversao = {
            '341': { txt: 'cx com 4KG', fator: 4 },
            '25': { txt: 'cx com 4KG', fator: 4 },
            '264': { txt: 'cx com 1,5KG', fator: 1.5 },
            '367': { txt: 'pcte com 2,1KG', fator: 2.1 },
            '368': { txt: 'pcte com 2,1KG', fator: 2.1 },
            '421': { txt: 'pcte com 2,1KG', fator: 2.1 },
            '27': { txt: 'cx com 4KG', fator: 4 },
            '26': { txt: 'cx com 4KG', fator: 4 }
        };

        function getConversion(p, slug) {
            if (slug === 'muller') return { txt: 'pcte 500g', fator: 0.5 };
            if (slug === 'makrobom' && p.codigo_uniplus && makrobomConversao[p.codigo_uniplus]) {
                return makrobomConversao[p.codigo_uniplus];
            }
            return { txt: 'un', fator: 1 };
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
                // Renderização: URL completa > Emoji > Fallback
                if (p.img && p.img.startsWith('http')) {
                    imgHtml = `
                        <img src="${p.img}" class="w-full h-full object-contain drop-shadow-sm ${active ? '' : 'grayscale opacity-70'}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">
                        <span class="text-lg items-center justify-center ${active ? '' : 'opacity-40 grayscale'}" style="display: none;">${getFallbackEmoji(p.nome)}</span>
                    `;
                } else if (p.img === 'BALDE') {
                    imgHtml = `<span class="text-lg flex items-center justify-center">🪣</span>`;
                } else if (p.img && !(/^\d+$/.test(p.img)) && p.img.length <= 5) {
                    imgHtml = `<span class="text-lg flex items-center justify-center ${active ? '' : 'opacity-40 grayscale'}">${p.img}</span>`;
                } else {
                    imgHtml = `<span class="text-lg flex items-center justify-center ${active ? '' : 'opacity-40 grayscale'}">${getFallbackEmoji(p.nome)}</span>`;
                }

                const conv = getConversion(p, fornecedorAtivo.slug);
                const custoConvertido = (p.custo || 0) * conv.fator;
                const vendaConvertida = (p.venda || 0) * conv.fator;

                lista.insertAdjacentHTML('beforeend', `
                    <div class="premium-card flex items-center h-14 px-3 transition-all ${active ? 'active-item' : ''}" data-id="${p.id}">
                        <div class="drag-handle w-4 text-slate-300 cursor-grab flex justify-center shrink-0 opacity-0 group-hover:opacity-100"><i class="fa-solid fa-grip-vertical text-[10px]"></i></div>
                        <div class="w-9 h-9 bg-white rounded-xl mx-2 flex items-center justify-center shrink-0 overflow-hidden shadow-sm border border-slate-100">${imgHtml}</div>
                        <div class="flex-1 min-w-0 pr-2">
                            <div class="flex items-center gap-1.5 mb-0.5 overflow-hidden">
                                <h3 class="text-[11px] font-black tracking-tight text-inherit truncate leading-tight">${p.nome}</h3>
                                ${conv.fator !== 1 ? `<span class="bg-primary/10 text-primary border border-primary/20 text-[8px] font-black px-1.5 py-0.5 rounded shadow-sm uppercase shrink-0 whitespace-nowrap whitespace-nowrap shrink-0 overflow-hidden text-clip flex items-center justify-center pt-0.5" title="A cada '+1' você compra/paga 1 ${conv.txt}"><i class="fa-solid fa-box-open mr-1 opacity-70"></i> 1 ${conv.txt}</span>` : ''}
                            </div>
                            <div class="flex items-center gap-2 mt-1">
                                <span class="bg-amber-100/50 border border-amber-200 text-amber-700 text-[9px] font-black px-1.5 py-0.5 rounded shadow-sm">Custo: ${formatMoeda(custoConvertido)}</span>
                                <span class="text-[8px] font-bold text-slate-400 opacity-60 uppercase">Venda: ${formatMoeda(vendaConvertida)} ${conv.txt.split(' ')[0]}</span>
                                ${p.codigo_uniplus ? (() => {
                                    const c = uniplusCatalog.find(u => u.code == p.codigo_uniplus);
                                    if(c) return `<span class="ml-auto text-[9px] ${c.stock > 0 ? 'text-green-500' : 'text-red-400'} font-black outline outline-1 outline-slate-200/50 px-1 rounded truncate">Estoque: ${c.stock}</span>`;
                                    return '';
                                })() : ''}
                            </div>
                        </div>
                        <div class="flex items-center bg-slate-100/50 rounded-xl p-0.5 gap-0.5 border border-slate-200/50">
                            <button onclick="alterarQtd(${p.id}, -1)" class="w-7 h-7 rounded-lg bg-white shadow-sm text-red-500 hover:bg-red-50 flex items-center justify-center transition-all"><i class="fa-solid fa-minus text-[9px]"></i></button>
                            <span class="w-7 text-center text-[11px] font-black" id="input-${p.id}">${qtd}</span>
                            <button onclick="alterarQtd(${p.id}, 1)" class="w-7 h-7 rounded-lg bg-white shadow-sm text-green-600 hover:bg-green-50 flex items-center justify-center transition-all"><i class="fa-solid fa-plus text-[9px]"></i></button>
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
                const conv = getConversion(p, fornecedorAtivo.slug);
                const c = (p.custo || 0) * conv.fator;
                const v = (p.venda || 0) * conv.fator;
                tc += c * q; 
                tl += (v - c) * q;
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
                    const conv = getConversion(p, fornecedorAtivo.slug);
                    const c = (p.custo || 0) * conv.fator;
                    const s = c * q; 
                    tp += s; 
                    ip.push(`- *${q.toString().padStart(2, '0')} ${conv.txt}* - ${p.nome} (${formatMoeda(c)}) = *${formatMoeda(s)}*`); 
                } 
            });
            if (ip.length === 0) return;

            const msgHeader = (fornecedorAtivo.texto_whatsapp || "Segue meu pedido:") + `\n\n*FORNECEDOR: ${fornecedorAtivo.nome.toUpperCase()}*\n-----------------------------------\n`;
            const msgFooter = `\n-----------------------------------\n*TOTAL DO PEDIDO:* ${formatMoeda(tp)}\n\n_Enviado via NatuBrava Orders_`;
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
                    dd.innerHTML = filtered.map(r => {
                        const conv = getConversion({ codigo_uniplus: r.item.code }, fornecedorAtivo.slug);
                        const custoConv = r.item.cost * conv.fator;
                        const vendaConv = r.item.sale * conv.fator;
                        return `
                        <div class="fuzzy-item" onclick="selecionarParaAdd(${JSON.stringify(r.item).replace(/"/g, '&quot;')})">
                            <div class="flex items-center gap-1.5 overflow-hidden">
                                <div class="text-[11px] font-black text-slate-800 truncate">${r.item.name}</div>
                                ${conv.fator !== 1 ? `<span class="bg-primary/10 text-primary border border-primary/20 text-[8px] font-black px-1.5 py-0.5 rounded shadow-sm uppercase shrink-0 whitespace-nowrap whitespace-nowrap shrink-0 overflow-hidden text-clip flex items-center justify-center pt-0.5" title="Vendido em ${conv.txt}"><i class="fa-solid fa-box-open mr-1 opacity-70"></i> 1 ${conv.txt}</span>` : ''}
                            </div>
                            <div class="flex items-center gap-2 mt-1">
                                <span class="bg-amber-100/50 border border-amber-200 text-amber-700 text-[10px] font-black px-1.5 py-0.5 rounded shadow-sm">Custo: ${formatMoeda(custoConv)}</span>
                                <span class="text-slate-400 text-[9px] font-semibold">Venda: ${formatMoeda(vendaConv)} ${conv.txt.split(' ')[0]}</span>
                            </div>
                            <div class="text-[9px] text-slate-400 font-bold uppercase mt-1">
                                Estoque: <span class="${r.item.stock > 0 ? 'text-green-600' : 'text-red-500'} font-black outline outline-1 outline-slate-200/50 px-1 rounded truncate ml-0.5">${r.item.stock}</span> <span class="opacity-50 ml-1">• Cód: ${r.item.code}</span>
                            </div>
                        </div>`;
                    }).join('');
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
            const conv = getConversion({ codigo_uniplus: item.code }, fornecedorAtivo.slug);
            const custoConv = item.cost * conv.fator;
            document.getElementById('prev-custo').innerHTML = `${formatMoeda(custoConv)} <span class="text-[9px]">/ ${conv.txt}</span>`;
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

        // --- SINCRONIZAÇÃO UNIVERSAL ---
        function confirmarSync() {
            document.getElementById('sync-confirm-title').innerText = `SINCRONIZAR ${fornecedorAtivo.nome.toUpperCase()}?`;
            document.getElementById('sync-confirm-desc').innerText = `Atualizar preços e buscar novos produtos de ${fornecedorAtivo.nome} na planilha Uniplus.`;
            const m = document.getElementById('modal-confirm-sync');
            m.classList.remove('hidden');
            setTimeout(() => m.classList.remove('opacity-0'), 10);
        }

        function fecharConfirmSync() {
            const m = document.getElementById('modal-confirm-sync');
            m.classList.add('opacity-0');
            setTimeout(() => m.classList.add('hidden'), 300);
        }

        // --- RESULTADO DO SYNC ---
        function mostrarResultadoSync(updatedCount, unmatched, newItems, edicaoMap) {
            let summaryHtml = `<div class="text-center mb-4">
                <div class="w-14 h-14 bg-green-50 text-green-500 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-3"><i class="fa-solid fa-check"></i></div>
                <p class="text-sm font-bold text-slate-700">${updatedCount} produto(s) atualizado(s)</p>`;
            if (unmatched.length > 0) {
                summaryHtml += `<p class="text-[10px] text-amber-500 font-bold mt-1">${unmatched.length} item(ns) não sincronizado(s)</p>`;
            }
            summaryHtml += `</div>`;
            document.getElementById('sync-result-summary').innerHTML = summaryHtml;

            let newHtml = '';
            if (newItems.length > 0) {
                newHtml = `<div class="border-t border-slate-100 pt-4 mt-2">
                    <h4 class="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <i class="fa-solid fa-wand-magic-sparkles"></i> ${newItems.length} NOVO(S) ITEM(NS) NA PLANILHA
                    </h4>
                    <div class="space-y-2 max-h-[40vh] overflow-y-auto pr-1">`;
                newItems.forEach(item => {
                    newHtml += `
                        <div class="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl" data-sync-code="${item.code}">
                            <div class="flex-1 min-w-0">
                                <p class="text-[11px] font-black text-slate-800 truncate">${item.name}</p>
                                <p class="text-[9px] text-slate-500 font-bold">Custo: ${formatMoeda(item.cost)} | Venda: ${formatMoeda(item.sale)} | Cód: <span class="text-primary">${item.code}</span></p>
                            </div>
                            <button onclick="adicionarItemSync('${item.code}', this)" class="shrink-0 bg-amber-500 hover:bg-amber-600 text-white text-[9px] font-black px-3 h-8 rounded-lg uppercase tracking-wider transition-all active:scale-95">
                                <i class="fa-solid fa-plus mr-1"></i>ADD
                            </button>
                        </div>`;
                });
                newHtml += `</div></div>`;
            }
            document.getElementById('sync-new-items').innerHTML = newHtml;

            // Armazenar para referência das funções de ADD
            window._syncNewItems = newItems;
            window._syncEdicaoMap = edicaoMap;

            const modal = document.getElementById('modal-sync-result');
            modal.classList.remove('hidden');
            setTimeout(() => modal.classList.remove('opacity-0'), 10);
        }

        function fecharSyncResult() {
            const m = document.getElementById('modal-sync-result');
            m.classList.add('opacity-0');
            setTimeout(() => m.classList.add('hidden'), 300);
        }

        async function adicionarItemSync(code, btnEl) {
            const item = (window._syncNewItems || []).find(i => i.code === code);
            if (!item) return;

            btnEl.innerHTML = '<i class="fa-solid fa-sync fa-spin"></i>';
            btnEl.disabled = true;

            const imgUrl = (window._syncEdicaoMap || {})[code] || '';
            const maxOrdem = produtos.length > 0 ? Math.max(...produtos.map(p => p.ordem || 0)) + 1 : 1;
            
            // Remove o texto entre parênteses no final do nome (ex: "(MAKROBOM)")
            const nomeClean = item.name.replace(/\s*\([^)]*\)\s*$/, '').trim().toUpperCase();

            const newProd = {
                fornecedor_slug: fornecedorAtivo.slug,
                nome: nomeClean,
                custo: item.cost,
                venda: item.sale,
                img: imgUrl || '📦',
                codigo_uniplus: code,
                ordem: maxOrdem,
                ativo: true
            };

            const { error } = await _supabase.from('produtos').insert([newProd]);
            if (error) { 
                alert('Erro ao adicionar: ' + error.message); 
                btnEl.innerHTML = '<i class="fa-solid fa-plus mr-1"></i>ADD';
                btnEl.disabled = false;
                return; 
            }

            // Feedback visual: trocar card para verde
            const itemDiv = btnEl.closest('[data-sync-code]');
            itemDiv.classList.remove('bg-amber-50', 'border-amber-200');
            itemDiv.classList.add('bg-green-50', 'border-green-200');
            btnEl.innerHTML = '<i class="fa-solid fa-check"></i>';
            btnEl.classList.remove('bg-amber-500', 'hover:bg-amber-600');
            btnEl.classList.add('bg-green-500');

            await carregarProdutos(fornecedorAtivo.slug);
        }

        async function executarSync() {
            const btn = document.querySelector('#modal-confirm-sync button:last-child');
            btn.innerHTML = '<i class="fa-solid fa-sync fa-spin"></i> SINCRONIZANDO...';
            btn.disabled = true;

            const slug = fornecedorAtivo.slug;
            const filtro = normalize(fornecedorAtivo.filtro_planilha || '');

            try {
                // 1. Produtos da plataforma (Supabase)
                const { data: localProds, error } = await _supabase.from('produtos').select('*').eq('fornecedor_slug', slug).eq('ativo', true);
                if (error) throw error;

                // 2. Carregar aba EDICAO para imagens Cloudinary (SKU → URL_FOTO)
                let edicaoMap = {};
                try {
                    const edicaoResp = await fetch(EDICAO_CSV_URL);
                    const edicaoText = await edicaoResp.text();
                    Papa.parse(edicaoText, {
                        header: false,
                        complete: (res) => {
                            res.data.slice(1).forEach(row => {
                                const sku = row[0]?.trim();
                                const urlFoto = row[6]?.trim();
                                if (sku && urlFoto && urlFoto.startsWith('http')) {
                                    edicaoMap[sku] = urlFoto;
                                }
                            });
                        }
                    });
                } catch(e) { console.warn('Erro ao carregar EDICAO:', e); }

                // 3. Filtrar catálogo Uniplus por fornecedor
                const fornecedorItems = filtro ? uniplusCatalog.filter(c => normalize(c.name).includes(filtro)) : [];

                // 4. Match produtos existentes por codigo_uniplus
                const updates = [];
                const unmatched = [];
                localProds.forEach(lp => {
                    if (!lp.codigo_uniplus) { unmatched.push(lp.nome + ' (sem código)'); return; }
                    
                    const match = fornecedorItems.find(c => c.code === lp.codigo_uniplus) ||
                                  uniplusCatalog.find(c => c.code === lp.codigo_uniplus);
                    
                    if (match) {
                        const imgUrl = edicaoMap[match.code] || '';
                        updates.push({
                            ...lp,
                            fornecedor_slug: slug,
                            custo: match.cost,
                            venda: match.sale,
                            img: imgUrl || (lp.img && lp.img.startsWith('http') ? lp.img : '') || lp.img || '📦',
                            codigo_uniplus: match.code,
                            updated_at: new Date().toISOString()
                        });
                    } else {
                        unmatched.push(lp.nome);
                    }
                });

                // 5. Encontrar NOVOS itens (na planilha, mas NÃO na plataforma)
                const existingCodes = new Set(localProds.map(p => p.codigo_uniplus).filter(Boolean));
                const newItems = fornecedorItems.filter(c => !existingCodes.has(c.code));

                // 6. Salvar updates no Supabase
                if (updates.length > 0) {
                    const { error: upErr } = await _supabase.from('produtos').upsert(updates);
                    if (upErr) throw upErr;
                }

                // 7. Mostrar modal de resultado
                mostrarResultadoSync(updates.length, unmatched, newItems, edicaoMap);

                await carregarProdutos(slug);
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
                    const conv = getConversion(p, fornecedorAtivo.slug);
                    const custoConvertido = (p.custo || 0) * conv.fator;
                    const s = custoConvertido * q; t += s; 
                    
                    l.insertAdjacentHTML('beforeend', `
                        <div class="bg-white p-4 rounded-2xl border border-slate-100 mb-2 flex justify-between items-center shadow-sm">
                            <div class="flex-1">
                                <h4 class="text-xs font-black text-slate-800 uppercase">${p.nome}</h4>
                                <div class="text-[10px] text-slate-400 font-bold mt-0.5">${formatMoeda(custoConvertido)} /${conv.txt}</div>
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
                    const cards = Array.from(document.querySelectorAll('.premium-card'));
                    for (let i = 0; i < cards.length; i++) {
                        const { error } = await _supabase.from('produtos').update({ ordem: i + 1 }).eq('id', parseInt(cards[i].dataset.id));
                        if (error) console.error(error);
                    }
                } 
            }); 
        }
