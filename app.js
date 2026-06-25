/* ══════════════════════════════════════════════════
   Terremotos en el mundo · M5+
   ══════════════════════════════════════════════════ */

const TERREMOTOS_FILE = 'terremotos.pmtiles';

/* ── Mapa ── */
const map = new maplibregl.Map({
  container: 'map',
  style: { version: 8, sources: {}, layers: [] },
  center: [0, 15],
  zoom: 1.6,
  minZoom: 1,
  antialias: true,
});

const infoPanel = document.getElementById('info-panel');

const MIN_MAG  = 5.0;
const MIN_ANIO = 1900;
let magnitudFiltro = MIN_MAG;
let anioFiltro      = 2026;

/* ── Color por magnitud (paleta por pasos basada en #01f3b3) ── */
const magnitudColor = [
  'step', ['get', 'magnitud'],
  '#b3f9e6',
  6.0, '#33f2be',
  7.0, '#01f3b3',
  8.0, '#009e74',
  9.0, '#004d38',
];

/* ── Leyenda ── */
const LEYENDA_HTML = `
  <div class="lp-titulo">Magnitud</div>
  <div class="lp-steps">
    <div class="lp-step"><span class="lp-dot" style="background:#b3f9e6"></span>5,0 – 5,9</div>
    <div class="lp-step"><span class="lp-dot" style="background:#33f2be"></span>6,0 – 6,9</div>
    <div class="lp-step"><span class="lp-dot" style="background:#01f3b3"></span>7,0 – 7,9</div>
    <div class="lp-step"><span class="lp-dot" style="background:#009e74"></span>8,0 – 8,9</div>
    <div class="lp-step"><span class="lp-dot" style="background:#004d38"></span>≥ 9,0</div>
  </div>`;

function aplicarFiltro() {
  const conds = [];
  if (magnitudFiltro > MIN_MAG)  conds.push(['>=', ['get', 'magnitud'], magnitudFiltro]);
  if (anioFiltro > MIN_ANIO)     conds.push(['>=', ['get', 'anio'], anioFiltro]);

  let filtro = null;
  if (conds.length === 1) filtro = conds[0];
  else if (conds.length > 1) filtro = ['all', ...conds];

  map.setFilter('terremotos-circle', filtro);
}

/* ── Carga ── */
map.on('load', async () => { try {

  const protocol = new pmtiles.Protocol();
  maplibregl.addProtocol('pmtiles', protocol.tile.bind(protocol));

  /* Mapa base CARTO light */
  map.addSource('basemap', {
    type: 'raster',
    tiles: ['https://cartodb-basemaps-a.global.ssl.fastly.net/light_all/{z}/{x}/{y}{r}.png'],
    tileSize: 256,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
  });
  map.addLayer({ id: 'basemap', type: 'raster', source: 'basemap' });

  /* Fuente PMTiles */
  map.addSource('terremotos', { type: 'vector', url: `pmtiles://${TERREMOTOS_FILE}` });

  /* Círculos */
  map.addLayer({
    id: 'terremotos-circle',
    type: 'circle',
    source: 'terremotos',
    'source-layer': 'terremotos',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'],
        0, ['interpolate', ['linear'], ['get', 'magnitud'], 5, 3, 9.5, 7],
        4, ['interpolate', ['linear'], ['get', 'magnitud'], 5, 5, 9.5, 11],
        8, ['interpolate', ['linear'], ['get', 'magnitud'], 5, 8, 9.5, 16],
        14, ['interpolate', ['linear'], ['get', 'magnitud'], 5, 12, 9.5, 24],
      ],
      'circle-color': magnitudColor,
      'circle-opacity': 0.8,
      'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 0, 0.4, 6, 0.8, 12, 1.4],
      'circle-stroke-color': '#013d2e',
      'circle-stroke-opacity': 0.4,
    },
  });

  aplicarFiltro();

  /* Controles */
  map.addControl(new GeocoderControl(), 'top-right');
  map.addControl(new maplibregl.NavigationControl(), 'top-right');
  map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');

  /* ── Panel info (hover en desktop, anclado al click en cualquier dispositivo) ── */
  let anclado = false;

  map.on('mousemove', 'terremotos-circle', e => {
    map.getCanvas().style.cursor = 'pointer';
    if (anclado) return;
    const p = e.features?.[0]?.properties;
    if (!p) return;
    renderPanelTerremoto(p);
    infoPanel.classList.remove('ip-hidden');
  });
  map.on('mouseleave', 'terremotos-circle', () => {
    map.getCanvas().style.cursor = '';
    if (!anclado) infoPanel.classList.add('ip-hidden');
  });

  map.on('click', 'terremotos-circle', e => {
    const p = e.features?.[0]?.properties;
    if (!p) return;
    renderPanelTerremoto(p);
    infoPanel.classList.remove('ip-hidden');
    anclado = true;
  });

  map.on('click', e => {
    const bbox  = [[e.point.x - 5, e.point.y - 5], [e.point.x + 5, e.point.y + 5]];
    const feats = map.queryRenderedFeatures(bbox, { layers: ['terremotos-circle'] });
    if (!feats.length) {
      anclado = false;
      infoPanel.classList.add('ip-hidden');
    }
  });

  /* ── Slider de magnitud mínima ── */
  const sliderEl = document.getElementById('magnitud-slider');
  const sliderValEl = document.getElementById('magnitud-slider-val');

  function actualizarSlider(val) {
    const min = +sliderEl.min, max = +sliderEl.max;
    const pct = ((val - min) / (max - min) * 100).toFixed(1) + '%';
    sliderEl.style.setProperty('--pct', pct);
    magnitudFiltro = val / 10;
    sliderValEl.textContent = magnitudFiltro <= min / 10
      ? 'Todos'
      : `≥ ${magnitudFiltro.toFixed(1).replace('.', ',')}`;
    aplicarFiltro();
  }

  sliderEl.addEventListener('input', e => actualizarSlider(parseInt(e.target.value)));
  actualizarSlider(+sliderEl.value);

  /* ── Slider de año mínimo ── */
  const anioEl = document.getElementById('anio-slider');
  const anioValEl = document.getElementById('anio-slider-val');

  function actualizarAnioSlider(val) {
    const min = +anioEl.min, max = +anioEl.max;
    const pct = ((val - min) / (max - min) * 100).toFixed(1) + '%';
    anioEl.style.setProperty('--pct', pct);
    anioFiltro = val;
    anioValEl.textContent = anioFiltro <= min ? 'Todos' : `Desde ${anioFiltro}`;
    aplicarFiltro();
  }

  anioEl.addEventListener('input', e => actualizarAnioSlider(parseInt(e.target.value)));
  actualizarAnioSlider(+anioEl.value);

  document.getElementById('leyenda-panel').innerHTML = LEYENDA_HTML;

} catch (err) {
  console.error('Error inicializando el mapa:', err);
}});

/* ── Panel de info (hover) ── */
function renderPanelTerremoto(p) {
  const fecha = formatFecha(p.fecha);

  infoPanel.innerHTML = `
    <div class="ip-bar"></div>
    <div class="ip-body">
      <div class="ip-name">${escHtml(p.lugar || '—')}</div>
      ${fecha ? `<div class="ip-sub">${fecha}</div>` : ''}
      <div class="ip-sep"></div>
      <div class="ip-stats">
        <div class="ip-stat">
          <span class="ip-stat-val">${p.magnitud != null ? p.magnitud.toFixed(1).replace('.', ',') : '—'}</span>
          <span class="ip-stat-key">Magnitud</span>
        </div>
      </div>
    </div>`;
}

/* ── Utilidades ── */
function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatFecha(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/* ══════════════════════════════════════════
   Geocoder (Nominatim)
   ══════════════════════════════════════════ */
class GeocoderControl {
  onAdd(map) {
    this._map = map;
    this._container = document.createElement('div');
    this._container.className = 'maplibregl-ctrl geocoder-ctrl';
    this._input = document.createElement('input');
    this._input.type = 'text';
    this._input.placeholder = 'Buscar lugar…';
    this._input.className = 'geocoder-input';
    this._input.setAttribute('autocomplete', 'off');
    this._list = document.createElement('div');
    this._list.className = 'geocoder-results';
    this._list.hidden = true;
    this._container.appendChild(this._input);
    this._container.appendChild(this._list);

    let timer;
    this._input.addEventListener('input', () => {
      clearTimeout(timer);
      const q = this._input.value.trim();
      if (q.length < 3) { this._list.innerHTML = ''; this._list.hidden = true; return; }
      timer = setTimeout(() => this._search(q), 350);
    });
    this._input.addEventListener('keydown', e => { if (e.key === 'Escape') this._list.hidden = true; });
    document.addEventListener('click', e => { if (!this._container.contains(e.target)) this._list.hidden = true; });
    return this._container;
  }

  async _search(q) {
    try {
      const data = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&accept-language=es`
      ).then(r => r.json());
      this._render(data);
    } catch { /* sin red */ }
  }

  _render(items) {
    this._list.innerHTML = '';
    if (!items.length) {
      const el = document.createElement('div');
      el.className = 'geocoder-item geocoder-empty';
      el.textContent = 'Sin resultados';
      this._list.appendChild(el);
    } else {
      items.forEach(item => {
        const el = document.createElement('div');
        el.className = 'geocoder-item';
        el.textContent = item.display_name;
        el.addEventListener('click', () => {
          this._input.value = item.display_name;
          this._list.hidden = true;
          const bb = item.boundingbox;
          if (bb) {
            this._map.fitBounds(
              [[parseFloat(bb[2]), parseFloat(bb[0])], [parseFloat(bb[3]), parseFloat(bb[1])]],
              { padding: 60, maxZoom: 14 }
            );
          } else {
            this._map.flyTo({ center: [parseFloat(item.lon), parseFloat(item.lat)], zoom: 13 });
          }
        });
        this._list.appendChild(el);
      });
    }
    this._list.hidden = false;
  }

  onRemove() { this._container.parentNode?.removeChild(this._container); }
}
