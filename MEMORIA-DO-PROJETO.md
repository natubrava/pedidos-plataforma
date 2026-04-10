# Memória do Projeto: Pedidos Plataforma

## URL OFICIAL DO PROJETO E REPOSITÓRIO GITHUB
**URL Produção:** `https://natubrava.github.io/pedidos-plataforma/`
**Repositório GitHub:** `https://github.com/natubrava/pedidos-plataforma`
**Caminho Local (PC):** `C:\Users\User\Meu Drive\ANTIGRAVITY\PEDIDOS PLATAFORMA`

> [!WARNING]
> **ATENÇÃO IAs E AGENTES:**
> NUNCA confunda este projeto com as extensões do Chrome (como "Caderno Encomendas" ou "CRM").
> Toda alteração solicitada para `Pedidos` ou `Pedidos Plataforma` deve ser estritamente feita e comitada neste repositório!

## 🔗 Informações do Supabase e Estrutura
- **Banco de Dados (Supabase):** `qcxudhpaiqorriclcgyb`
- **Tabelas Principais:** 
  - `produtos` (catalogo de itens processados)
  - `fornecedores` (Makrobom, Mel JC Bees, Muller)
  - `pedidos` (armazena o histórico de envios e carrinhos)
- A lógica de sincronização busca na planilha pública do Uniplus_IMP os "Reais Preços de Custo e Venda" e também o "Estoque", consolidando na plataforma.

## 🚀 Melhorias Feitas
- `app.js` usa uma chave de cache no localStorage chamada `uniplus_catalog_cache_v2` para forçar download do CSV quando há alteração na estrutura de dados (como a recente adição do Estoque).
- A interface exibe Preço de Custo destacado em âmbar e o Venda apaziguado.
