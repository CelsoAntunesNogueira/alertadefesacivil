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

// Ícone personalizado do marcador (resolve problema de ícone não aparecer)
const customIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

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
        L.marker(coords, { icon: customIcon })
          .addTo(map)
          .bindPopup(`
            <b>${item["Tipo de Ocorrência"] || item["Tipo"] || "Ocorrência"}</b><br>
            <b>Severidade:</b> ${item["Severidade"] || item["Nível"] || item["Nivel"] || "—"}<br>
            <b>Endereço:</b> ${endereco}<br>
            <b>Descrição:</b> ${item["Descrição"] || item["Descricao"] || item["Observação"] || "—"}
          `);
        markerCount++;
        console.log(`Marcador ${markerCount} adicionado em:`, coords);
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
