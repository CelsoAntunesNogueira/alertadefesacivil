// URL da planilha publicada como CSV (já correta)
const SHEET_URL =
  "https://api.allorigins.win/raw?url=" +
  encodeURIComponent("https://docs.google.com/spreadsheets/d/e/2PACX-1vS0BYnMDSIOZYk9j0jHb8E6VRyswAEtvXj73TjG0ldGSyGpxuxhLZLMcp-c-guuY4-xrV2xntDX9rDN/pub?output=csv");

// Inicializa o mapa centrado em Maricá - RJ
const map = L.map("map").setView([-22.9194, -42.8184], 12);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap contributors",
}).addTo(map);

// Função para buscar e processar o CSV
async function getCSVData() {
  const response = await fetch(SHEET_URL);
  const text = await response.text();
  const rows = text.split("\n").map((r) => r.split(","));
  const headers = rows.shift().map((h) => h.trim());
  const data = rows.map((r) =>
    headers.reduce((obj, key, i) => ({ ...obj, [key]: r[i] }), {})
  );
  return data.filter((d) => d && Object.keys(d).length > 0);
}

// Função para obter coordenadas com base no endereço
async function geocode(address) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`;
  const res = await fetch(url);
  const data = await res.json();
  return data[0] ? [parseFloat(data[0].lat), parseFloat(data[0].lon)] : null;
}

// Função principal: lê os dados e plota os pontos no mapa
async function plotData() {
  const data = await getCSVData();
  for (const item of data) {
    const endereco = item["Endereço"] || item["Endereco"] || item["Local"] || "";
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
}

plotData();
