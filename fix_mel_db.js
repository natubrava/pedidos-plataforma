const fs = require('fs');

const appContent = fs.readFileSync('js/app.js', 'utf8');
const URL = appContent.match(/const SUPABASE_URL = "(.*?)"/)[1];
const KEY = appContent.match(/const SUPABASE_KEY = "(.*?)"/)[1];
const HEADERS = { 'apikey': KEY, 'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json' };

const mapSearchTerms = {
    "EXPOSITOR MADEIRA FAVO - TEST": "EXPOSITOR DE MADEIRA PARA FAVO DE MEL JC",
    "EXT. PROPOLIS ASF 30ML": "EXT. PROPOLIS ABELHA SEM FERRAO ASF 30ML",
    "FAVO ORGANICO (ACRILICO)": "FAVO ORGANICO MEL JC (ACRILICO",
    "FAVO ORGANICO P/ EXPOSITOR": "FAVO ORGANICO MEL JC (FAVO) PARA EXPOSITOR",
    "MEL 2,5KG BALDE S/ ETIQUETA": "MEL 2,5KG",
    "MEL JATAÍ 140G": "MEL DE ABELHA JATAÍ SEM FERRAO",
    "MEL MANDAÇAIA 140G": "MEL DE ABELHA MANDAÇAIA SEM FERRAO",
    "MEL MELATO BRACATINGA 250G": "BRACATINGA 250G",
    "MEL MELATO BRACATINGA 800G": "BRACATINGA 800G",
    "MEL ORGANICO 270G": "MEL ORGANICO BISNAGA 270G MEL JC",
    "MEL ORGANICO 800G (SELO)": "MEL ORGANICO 800G VD MEL JC ((SELO ORGANICO))",
    "POLEN DESIDRATADO 100G": "POLEN APÍCOLA DESIDRATADO 100G",
};

async function run() {
    console.log("Baixando produtos do Supabase...");
    const res = await fetch(URL + '/rest/v1/produtos?fornecedor_slug=eq.meljc&select=*', { headers: HEADERS });
    const localProds = await res.json();
    
    // Ler CSV manualmente
    const csvLines = fs.readFileSync('temp_uniplus.csv', 'utf8').split('\n');
    const uniplusCatalog = [];
    for (let i = 1; i < csvLines.length; i++) {
        // Regex robusto que respeita quotes do CSV
        const cols = csvLines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
        if (!cols || cols.length < 6) continue;
        const code = cols[0].replace(/"/g, '');
        // Muitas vezes a descrição tem virgulas e esta entre aspas e quebra o array. Vamos extrair só a linha.
        const rowText = csvLines[i];
        uniplusCatalog.push({
            code: code,
            rawRow: rowText.toUpperCase()
        });
    }

    // Também lemos o catalog do CSV baixado anteriormente parseado de maneira rústica para pegar os valores de custo/venda
    // Vamos usar um RegEx mais simples para CSV 
    function parseCsvRow(row) {
        let regex = /(?!\s*$)\s*(?:'([^'\\]*(?:\\[\s\S][^'\\]*)*)'|"([^"\\]*(?:\\[\s\S][^"\\]*)*)"|([^,'"\s\\]*(?:\s+[^,'"\s\\]+)*))\s*(?:,|$)/g;
        let arr = [];
        let m;
        while ((m = regex.exec(row)) !== null) {
            arr.push(m[1] || m[2] || m[3] || '');
        }
        return arr;
    }

    const updates = [];

    for (const lp of localProds) {
        let bestCode = lp.codigo_uniplus;
        let forceMatch = false;

        // Se n~ao for um dos que já achei
        if (!bestCode) {
            const searchTerm = mapSearchTerms[lp.nome] || lp.nome.replace('(MEL JC)', '').trim();
            // Buscar linha do CSV que bate
            const matchedRow = csvLines.find(line => line.toUpperCase().includes(searchTerm.toUpperCase()));
            if (matchedRow) {
                const cols = parseCsvRow(matchedRow);
                bestCode = cols[0];
                lp.custo = parseFloat(cols[4].replace(',', '.'));
                lp.venda = parseFloat(cols[5].replace(',', '.'));
                forceMatch = true;
                console.log(`✅ MATCH MANUAL: "${lp.nome}" -> Code ${bestCode}`);
            } else {
                console.log(`❌ NENHUM MATCH AINDA: "${lp.nome}"`);
            }
        }

        if (bestCode || forceMatch) {
            updates.push({
                ...lp,
                codigo_uniplus: bestCode,
                img: (lp.img && lp.img.includes('/')) ? '' : lp.img,
                updated_at: new Date().toISOString()
            });
        }
    }

    if (updates.length > 0) {
        console.log(`Upserting ${updates.length} produtos...`);
        const resUp = await fetch(URL + '/rest/v1/produtos', {
            method: 'POST',
            headers: { ...HEADERS, 'Prefer': 'resolution=merge-duplicates' },
            body: JSON.stringify(updates)
        });
        if (resUp.ok) console.log("✅ Atualização concluída com sucesso no Supabase!");
        else console.error("ERRO SUPABASE: ", await resUp.text());
    }
}
run();
