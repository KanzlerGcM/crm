import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

const OSM_HEADERS = {
  'User-Agent': 'ProspectorChevla/1.0 (contato@chevla.com)',
  'Accept-Language': 'pt-BR,pt;q=0.9',
};

// Mapear categorias de busca para tags OSM
function getOverpassTags(query) {
  const q = query.toLowerCase();
  const map = {
    'restaurante': '["amenity"~"restaurant|fast_food|cafe|bar"]',
    'loja': '["shop"]',
    'roupa': '["shop"~"clothes|fashion|boutique"]',
    'academia': '["leisure"~"fitness_centre|sports_centre"]',
    'crossfit': '["leisure"~"fitness_centre|sports_centre"]',
    'hotel': '["tourism"~"hotel|motel|hostel|guest_house"]',
    'padaria': '["shop"~"bakery"]',
    'farmacia': '["amenity"~"pharmacy"]',
    'mercado': '["shop"~"supermarket|convenience"]',
    'supermercado': '["shop"~"supermarket"]',
    'pet': '["shop"~"pet"]',
    'veterinari': '["amenity"~"veterinary"]',
    'mecanica': '["shop"~"car_repair|car"]',
    'oficina': '["shop"~"car_repair"]',
    'barbearia': '["shop"~"hairdresser|beauty"]',
    'salao': '["shop"~"hairdresser|beauty"]',
    'estetica': '["shop"~"beauty|cosmetics"]',
    'clinica': '["amenity"~"clinic|doctors|dentist"]',
    'dentista': '["amenity"~"dentist"]',
    'medico': '["amenity"~"doctors|clinic|hospital"]',
    'hospital': '["amenity"~"hospital"]',
    'advocacia': '["office"~"lawyer"]',
    'escritorio': '["office"]',
    'contabil': '["office"~"accountant"]',
    'escola': '["amenity"~"school|college|university"]',
    'imobiliaria': '["office"~"estate_agent"]',
    'posto': '["amenity"~"fuel"]',
    'gasolina': '["amenity"~"fuel"]',
    'banco': '["amenity"~"bank"]',
    'igreja': '["amenity"~"place_of_worship"]',
    'pizzaria': '["amenity"~"restaurant"]["cuisine"~"pizza"]',
    'hamburger': '["amenity"~"fast_food"]["cuisine"~"burger"]',
    'lanchonete': '["amenity"~"fast_food|cafe"]',
    'bar': '["amenity"~"bar|pub"]',
    'floricultura': '["shop"~"florist"]',
    'livraria': '["shop"~"books"]',
    'otica': '["shop"~"optician"]',
    'joalheria': '["shop"~"jewelry"]',
    'informatica': '["shop"~"computer|electronics"]',
    'celular': '["shop"~"mobile_phone"]',
    'papelaria': '["shop"~"stationery"]',
    'construcao': '["shop"~"hardware|doityourself"]',
    'material': '["shop"~"hardware|doityourself"]',
    'movel': '["shop"~"furniture"]',
    'moveis': '["shop"~"furniture"]',
  };

  for (const [key, tag] of Object.entries(map)) {
    if (q.includes(key)) return tag;
  }
  // Fallback genérico: buscar qualquer POI com nome
  return '["name"]';
}

// ========== BUSCA: Nominatim (geocode da cidade) + Overpass (POIs) ==========
router.get('/search', async (req, res) => {
  try {
    const { query, location } = req.query;
    if (!query) return res.status(400).json({ error: 'Parâmetro "query" é obrigatório' });

    const searchTerms = String(query).trim();
    const citySearch = location ? String(location).trim() : '';
    const fullSearch = citySearch ? `${searchTerms} ${citySearch}` : searchTerms;

    // 1) Geocode da cidade via Nominatim para pegar lat/lon
    let lat, lon, cityName = '';
    if (citySearch) {
      const geoUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(citySearch)}&format=json&limit=1&addressdetails=1`;
      const geoRes = await fetch(geoUrl, { headers: OSM_HEADERS });
      const geoData = await geoRes.json();
      if (geoData.length > 0) {
        lat = parseFloat(geoData[0].lat);
        lon = parseFloat(geoData[0].lon);
        cityName = geoData[0].display_name;
      }
    }

    // 2) Buscar POIs via Overpass API dentro do raio
    const tags = getOverpassTags(searchTerms);
    const radius = 5000; // 5km

    let results = [];

    if (lat && lon) {
      // Busca por Overpass com tags + raio
      const overpassQuery = `
        [out:json][timeout:15];
        (
          node${tags}(around:${radius},${lat},${lon});
          way${tags}(around:${radius},${lat},${lon});
        );
        out center body 50;
      `;
      const overpassUrl = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`;
      const overpassRes = await fetch(overpassUrl, { headers: OSM_HEADERS });
      const overpassData = await overpassRes.json();

      const elements = (overpassData.elements || []).filter(e => e.tags?.name);

      // Filtrar por nome se a query for específica
      const queryWords = searchTerms.toLowerCase().replace(/sem site|centro|novo|velh/g, '').trim().split(/\s+/).filter(w => w.length > 2);

      results = elements.map(el => {
        const t = el.tags || {};
        const elLat = el.lat || el.center?.lat;
        const elLon = el.lon || el.center?.lon;
        return {
          place_id: `osm_${el.type}_${el.id}`,
          osm_id: el.id,
          osm_type: el.type,
          name: t.name,
          address: [t['addr:street'], t['addr:housenumber'], t['addr:suburb'] || t['addr:neighbourhood'], t['addr:city'], t['addr:state']].filter(Boolean).join(', ') || '',
          phone: t.phone || t['contact:phone'] || '',
          website: t.website || t['contact:website'] || t['url'] || '',
          email: t.email || t['contact:email'] || '',
          opening_hours: t.opening_hours || '',
          category: t.amenity || t.shop || t.office || t.leisure || t.tourism || '',
          cuisine: t.cuisine || '',
          lat: elLat,
          lon: elLon,
          maps_url: elLat && elLon ? `https://www.openstreetmap.org/?mlat=${elLat}&mlon=${elLon}#map=18/${elLat}/${elLon}` : '',
        };
      });
    }

    // 3) Fallback: se Overpass retornou pouco, complementar com Nominatim
    if (results.length < 5) {
      const nomUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(fullSearch)}&format=json&limit=20&addressdetails=1&extratags=1`;
      const nomRes = await fetch(nomUrl, { headers: OSM_HEADERS });
      const nomData = await nomRes.json();

      const existingIds = new Set(results.map(r => r.name?.toLowerCase()));

      for (const p of nomData) {
        if (existingIds.has(p.display_name?.split(',')[0]?.toLowerCase())) continue;
        const addr = p.address || {};
        results.push({
          place_id: `nom_${p.osm_type}_${p.osm_id}`,
          osm_id: p.osm_id,
          osm_type: p.osm_type,
          name: p.display_name?.split(',')[0] || p.name || 'Local',
          address: p.display_name || '',
          phone: p.extratags?.phone || p.extratags?.['contact:phone'] || '',
          website: p.extratags?.website || p.extratags?.['contact:website'] || p.extratags?.url || '',
          email: p.extratags?.email || '',
          opening_hours: p.extratags?.opening_hours || '',
          category: p.type || p.class || '',
          cuisine: p.extratags?.cuisine || '',
          lat: parseFloat(p.lat),
          lon: parseFloat(p.lon),
          maps_url: `https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lon}#map=18/${p.lat}/${p.lon}`,
        });
      }
    }

    // Limitar a 30 resultados
    results = results.slice(0, 30);

    res.json({
      results,
      total: results.length,
      source: 'openstreetmap',
    });
  } catch (error) {
    console.error('Erro OSM search:', error);
    res.status(500).json({ error: 'Erro ao buscar empresas. Tente novamente.' });
  }
});

// ========== DETALHES: busca extra de um OSM element ==========
router.get('/details/:placeId', async (req, res) => {
  try {
    const { placeId } = req.params;

    // placeId formato: "osm_node_123456" ou "nom_way_789"
    const parts = placeId.split('_');
    if (parts.length < 3) {
      return res.status(400).json({ error: 'Place ID inválido' });
    }

    const osmType = parts[1]; // node, way, relation
    const osmId = parts[2];

    // Buscar detalhes via Nominatim lookup
    const typeChar = osmType === 'node' ? 'N' : osmType === 'way' ? 'W' : 'R';
    const lookupUrl = `https://nominatim.openstreetmap.org/lookup?osm_ids=${typeChar}${osmId}&format=json&addressdetails=1&extratags=1&namedetails=1`;
    const lookupRes = await fetch(lookupUrl, { headers: OSM_HEADERS });
    const lookupData = await lookupRes.json();

    if (!lookupData || lookupData.length === 0) {
      return res.status(404).json({ error: 'Local não encontrado no OpenStreetMap' });
    }

    const p = lookupData[0];
    const addr = p.address || {};
    const tags = p.extratags || {};

    res.json({
      place_id: placeId,
      osm_id: p.osm_id,
      name: p.namedetails?.name || p.display_name?.split(',')[0] || 'Local',
      address: p.display_name || '',
      street: [addr.road, addr.house_number].filter(Boolean).join(', '),
      neighbourhood: addr.suburb || addr.neighbourhood || addr.quarter || '',
      city: addr.city || addr.town || addr.village || addr.municipality || '',
      state: addr.state || '',
      postcode: addr.postcode || '',
      country: addr.country || '',
      phone: tags.phone || tags['contact:phone'] || '',
      website: tags.website || tags['contact:website'] || tags.url || '',
      email: tags.email || tags['contact:email'] || '',
      opening_hours: tags.opening_hours || '',
      category: p.type || p.class || '',
      cuisine: tags.cuisine || '',
      lat: parseFloat(p.lat),
      lon: parseFloat(p.lon),
      maps_url: `https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lon}#map=18/${p.lat}/${p.lon}`,
    });
  } catch (error) {
    console.error('Erro OSM details:', error);
    res.status(500).json({ error: 'Erro ao buscar detalhes do local' });
  }
});

export default router;
