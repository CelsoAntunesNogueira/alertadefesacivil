// URL da planilha publicada como CSV
const SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vS0BYnMDSIOZYk9j0jHb8E6VRyswAEtvXj73TjG0ldGSyGpxuxhLZLMcp-c-guuY4-xrV2xntDX9rDN/pub?output=csv";

// Inicializa o mapa centrado em Maricá - RJ
const map = L.map("map").setView([-22.9194, -42.8184], 12);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap contributors",
}).addTo(map);

// Parser de CSV mais resistente
function parseCSV(text) {
  const rows = [];
  let current = [];
  let insideQuotes = false;
  let cell = "";

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"' && text[i + 1] === '"') {
      cell += '"';
      i++;
    } else if (c === '"') {
      insideQuotes = !insideQuotes;
    } else if (c === "," && !insideQuotes) {
      current.push(cell.trim());
      cell = "";
    } else if ((c === "\n" || c === "\r") && !insideQuotes) {
      if (cell.length > 0 || current.length > 0) {
        current.push(cell.trim());
        rows.push(current);
        current = [];
        cell = "";
      }
    } else {
      cell += c;
    }
  }
  if (cell.length > 0) current.push(cell.trim());
  if (current.length > 0) rows.push(current);
  return rows;
}

// Função para buscar e processar o CSV
async function getCSVData() {
  try {
    // Tenta buscar direto primeiro
    let response = await fetch(SHEET_URL, { mode: 'cors' });
    let text = await response.text();
    
    // Se não funcionar, mostra no console
    console.log("Resposta recebida:", text.substring(0, 200));
    
    const rows = parseCSV(text);
    console.log("Linhas parseadas:", rows);
    
    if (rows.length === 0) {
      throw new Error("Nenhuma linha encontrada no CSV");
    }
    
    const headers = rows[0].map((h) => h.trim());
    console.log("Headers encontrados:", headers);
    
    const data = rows.slice(1).map((r) =>
      headers.reduce((obj, key, i) => ({ ...obj, [key]: r[i] || "" }), {})
    );
    
    console.log("Dados processados:", data);
    return data.filter((d) => d && Object.keys(d).length > 0);
  } catch (err) {
    console.error("Erro ao buscar CSV:", err);
    alert("Erro ao carregar dados da planilha. Verifique o console para mais detalhes.");
    return [];
  }
}

// Delay entre requisições
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Geocodificação com OpenStreetMap
async function geocode(address) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      address + ", Maricá, RJ, Brasil"
    )}`;
    
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'DefesaCivilIFF/1.0'
      }
    });
    
    const data = await res.json();
    console.log(`Geocode para "${address}":`, data);
    
    return data[0] ? [parseFloat(data[0].lat), parseFloat(data[0].lon)] : null;
  } catch (err) {
    console.error(`Erro ao geocodificar "${address}":`, err);
    return null;
  }
}

// Função para obter cor baseada na severidade
function getMarkerColor(severidade) {
  const sev = (severidade || "").toLowerCase().trim();
  
  if (sev.includes("alta") || sev.includes("alto") || sev.includes("crítica") || sev.includes("critica")) {
    return '#d32f2f'; // Vermelho - Alta
  } else if (sev.includes("média") || sev.includes("media") || sev.includes("moderada")) {
    return '#ff9800'; // Laranja - Média
  } else if (sev.includes("baixa") || sev.includes("leve")) {
    return '#ffd700'; // Amarelo - Baixa
  } else {
    return '#2196F3'; // Azul - Sem classificação
  }
}

// Função para criar ícone colorido
function createColoredIcon(color) {
  const svgIcon = `
    <svg width="25" height="41" viewBox="0 0 25 41" xmlns="http://www.w3.org/2000/svg">
      <path d="M12.5 0C5.6 0 0 5.6 0 12.5c0 8.4 12.5 28.5 12.5 28.5S25 20.9 25 12.5C25 5.6 19.4 0 12.5 0z" 
            fill="${color}" stroke="#fff" stroke-width="1.5"/>
      <circle cx="12.5" cy="12.5" r="6" fill="#fff" opacity="0.9"/>
    </svg>
  `;
  
  return L.divIcon({
    html: svgIcon,
    className: 'custom-marker',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34]
  });
}

// Lê os dados e plota no mapa
async function plotData() {
  try {
    console.log("Iniciando carregamento dos dados...");
    const data = await getCSVData();
    
    if (data.length === 0) {
      console.warn("Nenhum dado encontrado para plotar");
      alert("Nenhuma ocorrência encontrada na planilha.");
      return;
    }
    
    console.log(`${data.length} registros encontrados. Geocodificando...`);
    let markerCount = 0;

    for (const item of data) {
      // Tenta diferentes nomes de colunas
      const endereco = item["Endereço"] || item["Endereco"] || 
                       item["Local"] || item["Localização"] || 
                       item["Localizacao"] || "";
      
      if (!endereco || endereco.trim() === "") {
        console.warn("Item sem endereço:", item);
        continue;
      }

      console.log(`Geocodificando: ${endereco}`);
      const coords = await geocode(endereco);
      
      if (coords) {
        const severidade = item["Severidade"] || item["Nível"] || item["Nivel"] || "";
        const markerColor = getMarkerColor(severidade);
        const icon = createColoredIcon(markerColor);
        
        L.marker(coords, { icon: icon })
          .addTo(map)
          .bindPopup(`
            <div style="min-width: 200px;">
              <b style="color: ${markerColor}; font-size: 1.1em;">
                ${item["Tipo de Ocorrência"] || item["Tipo"] || "Ocorrência"}
              </b><br>
              <b>Severidade:</b> <span style="color: ${markerColor}; font-weight: bold;">
                ${severidade || "Não informada"}
              </span><br>
              <b>Endereço:</b> ${endereco}<br>
              <b>Descrição:</b> ${item["Descrição"] || item["Descricao"] || item["Observação"] || "—"}
            </div>
          `);
        markerCount++;
        console.log(`Marcador ${markerCount} adicionado em:`, coords, `- Severidade: ${severidade}`);
      } else {
        console.warn(`Não foi possível geocodificar: ${endereco}`);
      }
      
      // Aguarda 1 segundo entre requisições para não ser bloqueado
      await delay(1000);
    }
    
    console.log(`Total de marcadores plotados: ${markerCount}`);
    
    if (markerCount === 0) {
      alert("Nenhum endereço pôde ser geocodificado. Verifique os endereços na planilha.");
    }
  } catch (err) {
    console.error("Erro ao plotar dados:", err);
    alert("Erro ao processar os dados. Verifique o console.");
  }
}

// Inicia o processo
console.log("Iniciando aplicação...");
plotData();
