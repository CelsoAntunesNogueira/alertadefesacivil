// URL da planilha publicada como CSV
const SHEET_URL =
  "https://api.allorigins.win/get?url=" +
  encodeURIComponent(
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vS0BYnMDSIOZYk9j0jHb8E6VRyswAEtvXj73TjG0ldGSyGpxuxhLZLMcp-c-guuY4-xrV2xntDX9rDN/pub?output=csv"
  );

// Inicializa o mapa centrado em Maricá - RJ
const map = L.map("map").setView([-22.9194, -42.8184], 12);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap contributors",
}).addTo(map);

// Parser CSV robusto
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

// Buscar e processar CSV
async function getCSVData() {
  const response = await fetch(SHEET_URL);
  const json = await response.json();
  const text = json.contents;
  const rows = parseCSV(text);
  const headers = rows.shift().map((h) => h.trim());
  const data = rows.map((r) =>
    headers.reduce((obj, key, i) => ({ ...obj, [key]: r[i] }), {})
  );
  return data.filter((d) => d && Object.keys(d).length > 0);
}

// Geocodificação via OpenStreetMap
async function geocode(address) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
    address + ", Maricá, RJ"
  )}`;
  const res = await fetch(url);
  const data = await res.json();
  return data[0] ? [parseFloat(data[0].lat), parseFloat(data[0].lon)] : null;
}

// Reverse geocode para exibir endereço resumido
async function reverseGeocode(lat, lng) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data && data.address) {
      const { road, suburb, city, state } = data.address;
      return [road, suburb, city, state].filter(Boolean).join(", ");
    }
    return "";
  } catch (err) {
    console.error("Erro no reverse geocode:", err);
    return "";
  }
}

// Plotar dados no mapa
async function plotData() {
  try {
    const data = await getCSVData();
    for (const item of data) {
      const endereco =
        item["Endereço"] || item["Endereco"] || item["Local"] || "";
      if (!endereco) continue;

      const coords = await geocode(endereco);
      if (coords) {
        L.marker(coords)
          .addTo(map)
          .bindPopup(`
            <b>${item["Tipo de Ocorrência"] || item["Tipo"] || "Ocorrência"}</b><br>
            <b>Severidade:</b> ${item["Severidade"] || item["Nível"] || "—"}<br>
            <b>Endereço:</b> ${endereco}<br>
            <b>Descrição:</b> ${item["Descrição"] || item["Observação"] || "—"}
          `);
      }
    }
  } catch (err) {
    console.error("Erro ao carregar dados:", err);
  }
}

// Variáveis para controlar marcadores
let selectedMarker = null; // clique no mapa
let searchMarker = null;   // pesquisa da barra

// Função de busca no mapa
async function searchLocation() {
  const query = document.getElementById("searchInput").value.trim();
  if (!query) return;

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.length > 0) {
      const { lat, lon, display_name } = data[0];

      // Remove marcador de pesquisa anterior
      if (searchMarker) map.removeLayer(searchMarker);

      // Remove marcador do clique se existir
      if (selectedMarker) {
        map.removeLayer(selectedMarker);
        selectedMarker = null;
      }

      map.setView([parseFloat(lat), parseFloat(lon)], 12);

      searchMarker = L.marker([parseFloat(lat), parseFloat(lon)])
        .addTo(map)
        .bindPopup(`<b>${display_name}</b>`)
        .openPopup();
    }
  } catch (err) {
    console.error("Erro na busca:", err);
  }
}

// Eventos de busca
document.getElementById("searchBtn").addEventListener("click", searchLocation);
document.getElementById("searchInput").addEventListener("keypress", (e) => {
  if (e.key === "Enter") searchLocation();
});

plotData();

// Clique no mapa → marcador + botão adicionar ocorrência
map.on("click", async function (e) {
  const { lat, lng } = e.latlng;

  // Remove marcador anterior do clique
  if (selectedMarker) map.removeLayer(selectedMarker);

  // Remove marcador da pesquisa se existir
  if (searchMarker) {
    map.removeLayer(searchMarker);
    searchMarker = null;
  }

  // Adiciona novo marcador
  selectedMarker = L.marker([lat, lng]).addTo(map);

  const latField = "entry.1650561563";
  const lngField = "entry.1874651982";
  const baseURL =
    "https://docs.google.com/forms/d/e/1FAIpQLSdo3k_7nbueN94yNTLASRwgH0q_ee8rUu470CxppTX3XBkddw/viewform";
  const formURL = `${baseURL}?usp=pp_url&${latField}=${lat.toFixed(
    6
  )}&${lngField}=${lng.toFixed(6)}`;

  const enderecoResumido = await reverseGeocode(lat, lng);

  selectedMarker.bindPopup(`
    <div style="text-align:center;">
      <b>Confirmar localização?</b><br>
      <small>${enderecoResumido}</small><br><br>
      <button onclick="window.open('${formURL}', '_blank')" 
              style="background:#d32f2f;color:white;border:none;
                     border-radius:6px;padding:8px 12px;cursor:pointer;">
        ➕ Adicionar Ocorrência
      </button>
    </div>
  `).openPopup();
});
