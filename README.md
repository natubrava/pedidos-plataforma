# NatuBrava — Pedidos Plataforma 🚀

Plataforma premium e inteligente para gestão de pedidos de fornecedores (Mel JC Bees, Makrobom, Müller Chips), integrada com Supabase e sincronizada dinamicamente com planilhas Google Sheets.

## 📋 Sobre o Projeto

O **Pedidos Plataforma** foi redesenhado para oferecer uma experiência de alta performance e visual premium. O sistema é capaz de se adaptar visualmente a cada fornecedor e possui uma inteligência de busca que "conversa" diretamente com o estoque e catálogos da Uniplus via Planilhas.

## ✨ Funcionalidades Principais

### 🎨 Identidade Visual Dinâmica
O sistema utiliza um motor de temas via `data-theme` que altera toda a atmosfera da aplicação (cores, ícones, fundos, sombras) conforme o fornecedor selecionado.
- **Mel JC Bees**: Foco em tons naturais, âmbar e clareza.
- **Makrobom**: Tema **Dark Chocolate** focado em exclusividade e produtos premium.
- **Müller Chips**: Visual energético com vermelho vibrante.

### 🔍 Busca Inteligente (Fuzzy Search)
Integrado com a biblioteca **Fuse.js**, o sistema permite buscar novos itens diretamente na planilha **Uniplus_IMP**.
- Busca por Nome ou Código.
- Filtro automático por palavras-chave (ex: ao buscar na aba Makrobom, o sistema prioriza itens da marca).
- Importação automática de Preço de Custo, Venda e Código do sistema.

### 🔄 Sincronização Inteligente (Aba Mel)
Especialmente para o fornecedor Mel JC Bees, existe um mecanismo de sincronização sob demanda que:
1. Lê o CSV público da sua planilha.
2. Faz o "match" dos produtos locais com a planilha através do `codigo_uniplus`.
3. Atualiza Preços de Custo, Venda e Imagens automaticamente.

### 💬 Gestão de Mensagens WhatsApp
Cada fornecedor possui seu próprio número e template de mensagem de abertura, configuráveis diretamente no modal de engrenagem.

---

## 🛠️ Tecnologias Utilizadas

- **Frontend**: HTML5, CSS3 (Custom Properties), JavaScript (ES6+).
- **Estilização**: Tailwind CSS + Glassmorphism / Backdrop Blur.
- **Banco de Dados**: [Supabase](https://supabase.com/) (PostgreSQL + Realtime).
- **Busca**: [Fuse.js](https://fusejs.io/) (Fuzzy search engine).
- **Parsing**: [PapaParse](https://www.papaparse.com/) (Leitor potente de CSV).
- **Ordenação**: [SortableJS](https://sortablejs.github.io/Sortable/) (Arrastar e soltar produtos).
- **Ícones**: FontAwesome 6.

---

## 📂 Estrutura de Arquivos

```bash
/
├── index.html        # Aplicação completa (SPA)
├── README.md         # Documentação Geral (este arquivo)
└── SUPABASE.md       # Estrutura do Banco de Dados e Scripts SQL
```

---

## ⚙️ Como usar o Catálogo Uniplus (Spreadsheet)

O sistema consome os dados da planilha via exportação CSV pública. 
URL de Referência: `https://docs.google.com/spreadsheets/d/10m3VsEwqsMYI5UfSxxa1tL208BYxBczlrstr4T-HJJI/`

Certifique-se de que a aba **Uniplus_IMP** esteja sempre atualizada para que a busca e sincronização funcionem perfeitamente.

---

## 👨‍💻 Desenvolvido por
**Antigravity AI** para **NatuBrava**.
