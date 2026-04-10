# Guia de Banco de Dados — Supabase 🗄️

Este documento detalha a estrutura das tabelas no Supabase para o projeto **Pedidos Plataforma**.

## 📊 Tabelas Principais

### 1. `fornecedores`
Armazena as configurações globais de cada fornecedor e as informações de contato.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | int8 (PK) | Identificador único |
| `slug` | text (UQ) | Identificador textual (ex: 'meljc', 'makrobom', 'muller') |
| `nome` | text | Nome completo do fornecedor |
| `nome_aba` | text | Nome que aparece na aba superior |
| `cor_primaria` | text | Hexadecimal da cor principal do tema |
| `cor_secundaria` | text | Hexadecimal da cor Secundária (hover/acentos) |
| `icone` | text | Emoji ou classe FontAwesome do cabeçalho |
| `telefone` | text | Número completo para envio do WhatsApp |
| `texto_whatsapp` | text | Template de mensagem inicial |
| `ordem` | int4 | Posição na listagem de abas |
| `ativo` | bool | Status de exibição |

### 2. `produtos`
Itens vinculados a cada fornecedor.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | int8 (PK) | Identificador único |
| `fornecedor_slug` | text (FK) | Vínculo com a tabela de fornecedores |
| `nome` | text | Nome do produto |
| `custo` | numeric | Preço de custo unitário |
| `venda` | numeric | Preço de venda sugerido |
| `img` | text | ID do Cloudinary ou Emoji |
| `codigo_uniplus` | text | **Vínculo Oficial**: Código do produto na planilha/sistema |
| `ordem` | int4 | Sequência de exibição (reordenável) |
| `ativo` | bool | Status de exibição (Soft Delete) |

### 3. `pedidos`
Log de pedidos enviados via plataforma.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | int8 (PK) | Identificador único |
| `created_at` | timestamptz | Data/hora do pedido |
| `fornecedor_slug` | text | Quem recebeu o pedido |
| `itens` | jsonb | Mapa de IDs e quantidades { "123": 5, "456": 2 } |
| `total_custo` | numeric | Valor total do pedido em custo |
| `enviado_whatsapp` | bool | Flag de confirmação de envio |

---

## 🛠️ Scripts Úteis (SQL Editor)

### Adicionar coluna para vínculo com Planilha
```sql
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS codigo_uniplus TEXT;
```

### Resetar Ordem dos Produtos (Exemplo Makrobom)
```sql
UPDATE produtos SET ordem = 0 WHERE fornecedor_slug = 'makrobom';
```

---

## ☁️ Cloudinary Setup
As imagens utilizam a base:
`https://res.cloudinary.com/dzjpj67xw/image/upload/w_200,h_200,c_fit,q_auto,f_auto/`
No campo `img`, você deve colocar apenas o **Public ID** do Cloudinary.
