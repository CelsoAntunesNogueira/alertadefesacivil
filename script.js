// URL da planilha publicada como CSV
const SHEET_URL =
  "https://api.allorigins.win/get?url=" +
  encodeURIComponent("https://docs.google.com/spreadsheets/d/e/2PACX-1vS0BYnMDSIOZYk9j0jHb8E6VRyswAEtvXj73TjG0ldGSyGpxuxhLZLMcp-c-guuY4-xrV2xntDX9rDN/pub?output=csv");

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

// Geocodificação com OpenStreetMap
async function geocode(address) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
    address + ", Maricá, RJ"
  )}`;
  const res = await fetch(url);
  const data = await res.json();
  return data[0] ? [parseFloat(data[0].lat), parseFloat(data[0].lon)] : null;
}

// Lê os dados e plota no mapa
async function plotData() {
  try {
    const data = await getCSVData();
    console.log("Dados lidos:", data);

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

plotData();
