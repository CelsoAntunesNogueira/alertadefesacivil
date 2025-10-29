
const SHEET_URL =
    "https://api.allorigins.win/raw?url=" +
    encodeURIComponent("https://docs.google.com/spreadsheets/d/e/2PACX-1vS0BYnMDSIOZYk9j0jHb8E6VRyswAEtvXj73TjG0ldGSyGpxuxhLZLMcp-c-guuY4-xrV2xntDX9rDN/pub?gid=658388342&single=true&output=csv");


    const map = L.map("map").setView([-22.9194, -42.8184], 12); // Maricá, RJ
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        }).addTo(map);

    async function getCSVData() {
        const response = await fetch("https://docs.google.com/spreadsheets/d/18H1lySpJKaCk3dHMJTLHQ-GW7Ap5NHF-zGuKnRp71TA/edit?usp=sharing");
    const text = await response.text();
    const rows = text.split("\n").map(r => r.split(","));
    const headers = rows.shift().map(h => h.trim());
    const data = rows.map(r =>
        headers.reduce((obj, key, i) => ({ ...obj, [key]: r[i] }), {})
    );
    return data.filter(d => d && Object.keys(d).length > 0);
}

    async function geocode(address) {
            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`;
    const res = await fetch(url);
    const data = await res.json();
    return data[0] ? [parseFloat(data[0].lat), parseFloat(data[0].lon)] : null;
        }

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

