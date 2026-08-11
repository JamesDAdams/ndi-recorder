import { getConfig } from './config.mjs';

const API_DOCS_PAGE = `  <!-- PAGE 3: API DOCS & KEY -->
  <main id="page-apidocs" class="hidden flex-1 p-6 max-w-5xl mx-auto w-full space-y-6">
    <div class="border-b border-slate-800 pb-4">
      <h2 class="text-xl font-bold text-slate-100">Système de Clé API & Endpoints HTTP</h2>
      <p class="text-xs text-slate-400 mt-1">Gérez votre clé API et intégrez les commandes d&#39;enregistrement avec vos scripts, Stream Deck ou automatisations.</p>
    </div>

    <!-- API Key Management Card -->
    <div class="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-3">
      <h3 class="font-semibold text-md text-slate-200 flex items-center gap-2">
        <span class="text-base leading-none">🔑</span>
        Clé API d&#39;Authentification
      </h3>

      <div class="flex items-center gap-3">
        <div class="relative flex-1">
          <input type="password" id="api-key-input" class="w-full bg-slate-950 border border-slate-800 rounded-lg pl-3 pr-10 py-2.5 text-sm font-mono text-cyan-400 focus:outline-none focus:border-cyan-500">
          <button onclick="toggleApiKeyVisibility()" class="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200">
            <span id="eye-icon" class="text-base leading-none">👁️</span>
          </button>
        </div>
        <button onclick="saveApiKey()" class="bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold px-4 py-2.5 rounded-lg text-xs transition">
          Mettre à jour la Clé
        </button>
      </div>
      <p class="text-xs text-slate-400">Pour vous authentifier auprès de l&#39;API, fournissez cette clé via le header <code class="text-cyan-400 font-mono">X-API-Key: &lt;votre_clé&gt;</code>.</p>
    </div>

    <!-- API Endpoints List Card -->
    <div class="space-y-4">
      <h3 class="text-sm font-semibold text-slate-400 uppercase tracking-wider">Endpoints Disponibles</h3>

      <!-- Endpoint 1: Start Recording -->
      <div class="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <span class="bg-emerald-500/20 text-emerald-400 font-mono font-bold text-xs px-2.5 py-1 rounded border border-emerald-500/30">POST</span>
            <span class="font-mono text-sm font-bold text-slate-100">/api/record/start</span>
          </div>
          <button onclick="testApiEndpoint('start')" class="bg-slate-800 hover:bg-slate-700 text-cyan-400 font-bold text-xs px-3 py-1.5 rounded border border-slate-700 transition">
            Tester la requête
          </button>
        </div>
        <p class="text-xs text-slate-400">Démarre l&#39;enregistrement en continu de la source NDI active.</p>
        <div class="bg-slate-950 p-3 rounded-lg border border-slate-800/80 font-mono text-xs text-slate-300 overflow-x-auto">
          curl -X POST "http://localhost:3000/api/record/start" -H "X-API-Key: <span class="api-key-display text-cyan-400">***</span>"
        </div>
      </div>

      <!-- Endpoint 2: Stop Recording -->
      <div class="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <span class="bg-emerald-500/20 text-emerald-400 font-mono font-bold text-xs px-2.5 py-1 rounded border border-emerald-500/30">POST</span>
            <span class="font-mono text-sm font-bold text-slate-100">/api/record/stop</span>
          </div>
          <button onclick="testApiEndpoint('stop')" class="bg-slate-800 hover:bg-slate-700 text-cyan-400 font-bold text-xs px-3 py-1.5 rounded border border-slate-700 transition">
            Tester la requête
          </button>
        </div>
        <p class="text-xs text-slate-400">Arrête l&#39;enregistrement continu en cours et exporte la vidéo vers le répertoire Fireshare.</p>
        <div class="bg-slate-950 p-3 rounded-lg border border-slate-800/80 font-mono text-xs text-slate-300 overflow-x-auto">
          curl -X POST "http://localhost:3000/api/record/stop" -H "X-API-Key: <span class="api-key-display text-cyan-400">***</span>"
        </div>
      </div>

      <!-- Endpoint 3: Save Replay -->
      <div class="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <span class="bg-emerald-500/20 text-emerald-400 font-mono font-bold text-xs px-2.5 py-1 rounded border border-emerald-500/30">POST</span>
            <span class="font-mono text-sm font-bold text-slate-100">/api/replay/save?minutes={X}</span>
          </div>
          <div class="flex items-center gap-2">
            <input type="number" id="test-replay-mins" min="1" max="60" value="5" class="w-16 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs font-mono text-slate-200">
            <button onclick="testApiEndpoint('replay')" class="bg-slate-800 hover:bg-slate-700 text-cyan-400 font-bold text-xs px-3 py-1.5 rounded border border-slate-700 transition">
              Sauvegarder Replay
            </button>
          </div>
        </div>
        <p class="text-xs text-slate-400">Exporte instantanément les X dernières minutes conservées en RAM buffer vers un fichier vidéo MP4.</p>
        <div class="bg-slate-950 p-3 rounded-lg border border-slate-800/80 font-mono text-xs text-slate-300 overflow-x-auto">
          curl -X POST "http://localhost:3000/api/replay/save?minutes=5" -H "X-API-Key: <span class="api-key-display text-cyan-400">***</span>"
        </div>
      </div>
    </div>

    <!-- Stream Deck Integration Card -->
    <div class="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-3">
      <h3 class="font-semibold text-md text-slate-200 flex items-center gap-2">
        <span class="text-base leading-none">🎛️</span>
        Contrôler avec un Stream Deck
      </h3>
      <p class="text-xs text-slate-400">Vous utilisez un Elgato Stream Deck pour piloter vos enregistrements ? Installez le plugin officiel <a href="https://marketplace.elgato.com/product/web-requests-d7d46868-f9c8-4fa5-b775-ab3b9a7c8add" target="_blank" rel="noopener" class="text-cyan-400 hover:text-cyan-300 underline">Web Requests</a> et associez vos touches aux endpoints ci-dessus avec votre clé API.</p>
    </div>
  </main>`;

export function getDashboardHtml() {
  const previewEnabled = getConfig().previewEnabled !== false;
  const previewBtnStateCls = previewEnabled
    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25'
    : 'bg-slate-700/30 text-slate-400 border-slate-600/40 hover:bg-slate-700/50';
  return `<!DOCTYPE html>
<html lang="fr" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NDI DockRecorder</title>
  <script src="/vendor/tailwindcss.min.js"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            brand: {
              500: '#06b6d4',
              600: '#0891b2',
              danger: '#ef4444'
            }
          }
        }
      }
    }
  </script>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen font-sans flex flex-col">

  <!-- Top Header & Navigation -->
  <header class="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-50 px-6 py-3.5 flex flex-col md:flex-row items-center justify-between gap-4">
    <div class="flex items-center gap-3">
      <div class="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></div>
      <h1 class="text-xl font-bold tracking-tight text-cyan-400">NDI DockRecorder</h1>
      <span class="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded border border-slate-700 font-mono">Docker Headless</span>
    </div>

    <!-- Navigation Tabs -->
    <nav class="flex items-center gap-2 bg-slate-950/70 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
      <button type="button" id="nav-btn-dashboard" onclick="switchPage('dashboard')" class="px-4 py-2 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center gap-2 transition">
        <span class="text-sm leading-none">🏠</span>
        Tableau de Bord
      </button>
      <button type="button" id="nav-btn-settings" onclick="switchPage('settings')" class="px-4 py-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 flex items-center gap-2 transition">
        <span class="text-sm leading-none">⚙️</span>
        Paramètres & Profils
      </button>
      <button type="button" id="nav-btn-apidocs" onclick="switchPage('apidocs')" class="px-4 py-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 flex items-center gap-2 transition">
        <span class="text-sm leading-none">📚</span>
        Clé API & Docs
      </button>
    </nav>

    <div id="sys-status" class="flex gap-6 text-sm text-slate-400">
      <div>RAM Buffer: <span id="stat-ram" class="text-slate-200 font-mono">5 min</span></div>
      <div>Stockage: <span id="stat-disk" class="text-emerald-400 font-mono">Actif</span></div>
    </div>
  </header>

  <!-- PAGE 1: DASHBOARD -->
  <main id="page-dashboard" class="flex-1 p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl mx-auto w-full">

    <!-- Column 1: Live Stream Preview & Controls -->
    <div class="space-y-6 lg:col-span-2">
      <!-- Source Preview Card -->
      <div class="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
        <div class="flex items-center justify-between mb-4">
          <h2 class="font-semibold text-lg flex items-center gap-2">
            <span class="text-lg leading-none">🎥</span>
            Source NDI Active
          </h2>
          <div class="flex items-center gap-2">
            <button type="button" id="btn-toggle-preview" onclick="togglePreview()" class="${previewBtnStateCls} text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 transition border">
              <span class="text-sm leading-none">👁️</span>
              Preview : <span id="btn-toggle-preview-label">${previewEnabled ? 'ON' : 'OFF'}</span>
            </button>
            <span id="badge-active-profile" title="" class="hidden bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5">
              <span class="text-sm leading-none">👤</span>
              Profil actif : <span id="badge-active-profile-name">--</span>
            </span>
            <span id="badge-live" class="bg-slate-700/30 text-slate-400 border border-slate-600/40 text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5">
              <span class="live-dot w-2 h-2 rounded-full bg-slate-500"></span> <span id="badge-live-label">HORS LIGNE</span>
            </span>
          </div>
        </div>

        <!-- Live Preview Image Container -->
        <div class="aspect-video bg-slate-950 rounded-lg border border-slate-800 relative overflow-hidden flex items-center justify-center">
          <img id="preview-img" ${previewEnabled ? 'src="/api/preview.mjpeg"' : ''} alt="NDI Live Stream Preview" class="w-full h-full object-cover rounded-lg ${previewEnabled ? '' : 'hidden'}" />

          <div id="preview-disabled-overlay" class="${previewEnabled ? 'hidden' : ''} absolute inset-0 flex items-center justify-center bg-slate-950/90">
            <div class="text-center">
              <div class="text-3xl mb-2">🚫</div>
              <div class="text-sm font-semibold text-slate-300">Preview d\u00e9sactiv\u00e9e</div>
              <div class="text-xs text-slate-500 mt-1">Activez le bouton Preview pour r\u00e9afficher le flux</div>
            </div>
          </div>

          <div class="absolute top-3 right-3 bg-slate-950/85 backdrop-blur border border-slate-800 px-2.5 py-1 rounded-lg text-xs font-mono text-cyan-400 shadow-lg flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
            <span id="preview-fps-badge">60 FPS</span>
          </div>

          <div class="absolute bottom-3 left-3 bg-slate-950/85 backdrop-blur border border-slate-800 px-3 py-1.5 rounded-lg text-xs font-mono text-cyan-400 flex items-center gap-2 shadow-lg">
            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span id="source-label-overlay">Recherche des sources NDI...</span>
          </div>
        </div>

        <!-- Profile Selector Dropdown -->
        <div class="mt-4">
          <select id="source-select" onchange="changeProfile(this.value)" class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-cyan-500 font-mono">
            <option value="">Aucun profil configuré</option>
          </select>
        </div>
      </div>

      <!-- Controls & Replay Buffer Card -->
      <div class="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="bg-slate-950/60 border border-slate-800/80 rounded-lg p-4 flex flex-col justify-between">
          <div>
            <h3 class="font-semibold text-sm text-slate-300 mb-1">Clip</h3>
            <p class="text-xs text-slate-400">Sauvegarder instantanément les X dernières minutes.</p>
          </div>
          <div class="mt-4 grid grid-cols-3 gap-2">
            <button onclick="saveReplayClip(5)" class="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold py-2 px-1 rounded-lg shadow shadow-cyan-500/20 transition text-xs">5m</button>
            <button onclick="saveReplayClip(10)" class="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold py-2 px-1 rounded-lg shadow shadow-cyan-500/20 transition text-xs">10m</button>
            <button onclick="saveReplayClip(15)" class="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold py-2 px-1 rounded-lg shadow shadow-cyan-500/20 transition text-xs">15m</button>
          </div>
        </div>

        <div class="bg-slate-950/60 border border-slate-800/80 rounded-lg p-4 flex flex-col justify-between">
          <div>
            <h3 class="font-semibold text-sm text-slate-300 mb-1">Enregistrement Direct</h3>
            <p id="rec-status-text" class="text-xs text-slate-400">Prêt à enregistrer</p>
          </div>
          <button id="btn-toggle-rec" onclick="toggleRecording()" class="mt-4 w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 px-4 rounded-lg shadow-lg shadow-red-600/20 transition flex items-center justify-center gap-2">
            <div id="rec-dot" class="w-3 h-3 rounded-full bg-white"></div>
            <span id="rec-btn-label">Démarrer Enregistrement</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Column 2: Recent Clips Feed -->
    <div class="space-y-6">
      <div class="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
        <h2 class="font-semibold text-lg text-slate-200 border-b border-slate-800 pb-3 mb-4 flex justify-between items-center">
          <span>Derniers Clips Exportés</span>
          <span class="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/30">Fireshare Watch</span>
        </h2>
        <div id="clips-list" class="space-y-3 max-h-96 overflow-y-auto pr-1">
          <div class="text-xs text-slate-500 text-center py-4">Aucun enregistrement pour le moment</div>
        </div>
      </div>
    </div>
  </main>

  <!-- PAGE 2: SETTINGS & PROFILES -->
  <main id="page-settings" class="hidden flex-1 p-6 max-w-5xl mx-auto w-full space-y-6">
    <div class="flex items-center justify-between border-b border-slate-800 pb-4">
      <div>
        <h2 class="text-xl font-bold text-slate-100">Gestion des Profils & Paramètres NDI</h2>
        <p class="text-xs text-slate-400 mt-1">Créez et configurez plusieurs profils d'enregistrement associes à vos sources NDI.</p>
      </div>
      <button onclick="createNewProfile()" class="bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold px-4 py-2 rounded-lg text-xs transition flex items-center gap-1.5 shadow-lg shadow-cyan-600/20">
        <span class="text-sm leading-none">➕</span>
        Nouveau Profil
      </button>
    </div>

    <!-- List of Profiles & Form Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Profiles List Side Panel -->
      <div class="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
        <h3 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Profils Enregistrés</h3>
        <div id="profiles-list-container" class="space-y-2 max-h-[500px] overflow-y-auto pr-1">
          <!-- Dynamically populated profiles -->
        </div>
      </div>

      <!-- Selected Profile Editor Card -->
      <div class="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-lg">
        <div class="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 id="profile-editor-title" class="font-semibold text-lg text-cyan-400">Édition du Profil</h3>
          <span class="text-xs text-slate-500 font-mono" id="profile-editor-id">id: --</span>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-slate-400 mb-1">Nom du Profil</label>
            <input type="text" id="prof-name" placeholder="Ex: Gaming PC High Quality" class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500">
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-400 mb-1">Source NDI Associée</label>
            <select id="prof-source-select" class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500 font-mono text-xs">
              <option value="">Sélectionner ou saisir une source...</option>
            </select>
          </div>
        </div>

        <div class="bg-slate-950/70 border border-amber-500/20 rounded-lg p-3">
          <div class="flex items-center gap-2">
            <input type="checkbox" id="prof-auto-record" class="w-4 h-4 rounded bg-slate-950 border-slate-800 text-cyan-500 focus:ring-cyan-500">
            <label for="prof-auto-record" class="text-xs font-bold text-amber-300">Record automatique si stream NDI disponible</label>
          </div>
          <p class="text-[11px] text-slate-400 mt-1 pl-6">
            &#9888; Règle d&#39;exclusivité : L&#39;auto-record ne peut être actif que sur un seul profil pour une même source NDI.
          </p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-slate-400 mb-1">RAM Buffer Max (minutes)</label>
            <input type="number" id="prof-ram-buffer" min="1" max="60" value="5" class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500">
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-400 mb-1">Encodeur Vidéo</label>
            <select id="prof-encoder" class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500">
              <!-- Dynamically populated based on available encoders -->
            </select>
          </div>
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-400 mb-1">Débit Encodeur (Bitrate)</label>
          <input type="range" id="prof-bitrate" min="5" max="50" value="12" oninput="document.getElementById('prof-bitrate-val').textContent = this.value + ' Mbps'" class="w-full accent-cyan-400">
          <div class="flex justify-between text-xs text-slate-500 mt-1">
            <span>5 Mbps</span>
            <span id="prof-bitrate-val" class="text-cyan-400 font-mono">12 Mbps</span>
            <span>50 Mbps</span>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-slate-400 mb-1">Dossier Enregistrements (full)</label>
            <input type="text" id="prof-record-dir" placeholder="./recordings" class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm font-mono text-slate-200 focus:outline-none focus:border-cyan-500">
            <p class="text-[11px] text-slate-500 mt-1">Vide = dossier global par défaut.</p>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-400 mb-1">Dossier Clips (replay)</label>
            <input type="text" id="prof-clip-dir" placeholder="./recordings" class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm font-mono text-slate-200 focus:outline-none focus:border-cyan-500">
            <p class="text-[11px] text-slate-500 mt-1">Vide = dossier global par défaut.</p>
          </div>
        </div>

        <div class="flex justify-between items-center pt-3 border-t border-slate-800">
          <button id="btn-delete-profile" onclick="deleteCurrentProfile()" class="bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30 font-bold px-4 py-2 rounded-lg text-xs transition">
            Supprimer ce profil
          </button>
          <button onclick="saveCurrentProfile()" class="bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold px-5 py-2.5 rounded-lg text-xs transition shadow-lg shadow-cyan-600/20">
            Enregistrer les modifications
          </button>
        </div>
      </div>
    </div>
  </main>

${API_DOCS_PAGE}

  <script>
    let activeSourceName = "";
    let currentConfig = null;
    let currentAvailableEncoders = ['libx264'];
    let activeProfileId = null;
    let profileFormDirty = false;

    function escapeHtml(str) {
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function switchPage(pageId) {
      const pages = ['dashboard', 'settings', 'apidocs'];
      pages.forEach(p => {
        const el = document.getElementById('page-' + p);
        if (el) {
          if (p === pageId) {
            el.classList.remove('hidden');
            el.style.display = p === 'dashboard' ? 'grid' : 'block';
          } else {
            el.classList.add('hidden');
            el.style.display = 'none';
          }
        }
      });

      const btnDash = document.getElementById('nav-btn-dashboard');
      const btnSet = document.getElementById('nav-btn-settings');
      const btnApi = document.getElementById('nav-btn-apidocs');

      const inactiveCls = 'px-4 py-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 flex items-center gap-2 transition';
      const activeCls = 'px-4 py-2 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center gap-2 transition';

      if (btnDash) btnDash.className = pageId === 'dashboard' ? activeCls : inactiveCls;
      if (btnSet) btnSet.className = pageId === 'settings' ? activeCls : inactiveCls;
      if (btnApi) btnApi.className = pageId === 'apidocs' ? activeCls : inactiveCls;

      try {
        if (window.location.hash !== '#' + pageId) {
          if (history.pushState) {
            history.pushState(null, '', '#' + pageId);
          } else {
            window.location.hash = pageId;
          }
        }
      } catch (e) {}
    }
    window.switchPage = switchPage;

    function renderProfilesList() {
      if (!currentConfig) return;
      const profiles = currentConfig.sourceProfiles || {};
      const container = document.getElementById('profiles-list-container');
      if (!container) return;

      const keys = Object.keys(profiles);
      if (keys.length === 0) {
        container.innerHTML = '<div class="text-xs text-slate-500 text-center py-4">Aucun profil configuré</div>';
        return;
      }

      container.innerHTML = keys.map(id => {
        const prof = profiles[id];
        const isSelected = id === activeProfileId;
        const autoBadge = prof.autoRecord
          ? '<span class="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded font-bold">Auto-Rec ON</span>'
          : '<span class="text-[10px] bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded">Auto-Rec OFF</span>';

        return '<div onclick="selectProfile(\\'' + id + '\\')" class="p-3 rounded-lg border text-xs cursor-pointer transition flex flex-col gap-1 ' + (isSelected ? 'bg-cyan-500/10 border-cyan-500/50 text-cyan-200' : 'bg-slate-950/80 border-slate-800 hover:border-slate-700 text-slate-300') + '">'
          + '<div class="flex items-center justify-between font-bold">'
          + '<span>' + (prof.name || id) + '</span>'
          + autoBadge
          + '</div>'
          + '<div class="text-[11px] font-mono text-slate-500 text-ellipsis overflow-hidden">' + (prof.source || 'Aucune source') + '</div>'
          + '<div class="text-[10px] text-slate-400 flex justify-between pt-1 border-t border-slate-800/60">'
          + '<span>RAM: ' + (prof.replayBufferMinutes || 5) + ' min</span>'
          + '<span>' + (prof.bitrateMbps || 12) + ' Mbps</span>'
          + '</div>'
          + '</div>';
      }).join('');
    }

    function selectProfile(id) {
      activeProfileId = id;
      profileFormDirty = false;
      renderProfilesList();
      loadSelectedProfileToForm();
    }

    function loadSelectedProfileToForm() {
      if (profileFormDirty) return;
      if (!currentConfig || !activeProfileId) return;
      const profiles = currentConfig.sourceProfiles || {};
      const prof = profiles[activeProfileId];
      if (!prof) return;

      document.getElementById('profile-editor-title').textContent = 'Édition : ' + (prof.name || activeProfileId);
      document.getElementById('profile-editor-id').textContent = 'id: ' + activeProfileId;

      document.getElementById('prof-name').value = prof.name || '';
      document.getElementById('prof-auto-record').checked = prof.autoRecord === true;
      document.getElementById('prof-ram-buffer').value = prof.replayBufferMinutes || 5;

      const bitrateInput = document.getElementById('prof-bitrate');
      bitrateInput.value = prof.bitrateMbps || 12;
      document.getElementById('prof-bitrate-val').textContent = (prof.bitrateMbps || 12) + ' Mbps';

      document.getElementById('prof-record-dir').value = prof.recordDir || '';
      document.getElementById('prof-clip-dir').value = prof.clipDir || '';

      const profSourceSelect = document.getElementById('prof-source-select');
      if (profSourceSelect) profSourceSelect.value = prof.source || '';

      renderProfEncoderOptions(prof.encoder);
    }

    function renderProfEncoderOptions(selectedEncoder) {
      const select = document.getElementById('prof-encoder');
      if (!select) return;
      const options = [];
      if (currentAvailableEncoders.includes('h264_nvenc')) {
        options.push('<option value="h264_nvenc">NVIDIA NVENC (H.264 HQ)</option>');
      }
      if (currentAvailableEncoders.includes('hevc_nvenc')) {
        options.push('<option value="hevc_nvenc">NVIDIA NVENC (HEVC/H.265)</option>');
      }
      if (currentAvailableEncoders.includes('h264_qsv')) {
        options.push('<option value="h264_qsv">Intel QuickSync (H.264)</option>');
      }
      options.push('<option value="libx264">CPU (x264 Software)</option>');

      const currentVal = selectedEncoder || select.value || 'libx264';
      select.innerHTML = options.join('');
      select.value = currentAvailableEncoders.includes(currentVal) ? currentVal : 'libx264';
    }

    function createNewProfile() {
      const newId = 'prof-' + Date.now();
      const newProf = {
        id: newId,
        name: 'Nouveau Profil ' + (Object.keys(currentConfig.sourceProfiles || {}).length + 1),
        source: activeSourceName || 'GAMINGPC (NVIDIA GeForce RTX 3070 1)',
        autoRecord: false,
        replayBufferMinutes: 5,
        bitrateMbps: 12,
        encoder: 'libx264',
        recordDir: '',
        clipDir: ''
      };

      if (!currentConfig.sourceProfiles) currentConfig.sourceProfiles = {};
      currentConfig.sourceProfiles[newId] = newProf;

      activeProfileId = newId;
      profileFormDirty = false;
      renderProfilesList();
      loadSelectedProfileToForm();
    }

    async function saveCurrentProfile() {
      if (!activeProfileId) return;
      const name = document.getElementById('prof-name').value;
      const source = document.getElementById('prof-source-select').value;
      const autoRecord = document.getElementById('prof-auto-record').checked;
      const ramBuffer = parseInt(document.getElementById('prof-ram-buffer').value);
      const bitrate = parseInt(document.getElementById('prof-bitrate').value);
      const encoder = document.getElementById('prof-encoder').value;
      const recordDir = document.getElementById('prof-record-dir').value.trim();
      const clipDir = document.getElementById('prof-clip-dir').value.trim();

      const sourceProfiles = {};
      sourceProfiles[activeProfileId] = {
        id: activeProfileId,
        name,
        source,
        autoRecord,
        replayBufferMinutes: ramBuffer,
        bitrateMbps: bitrate,
        encoder,
        recordDir,
        clipDir
      };

      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceProfiles })
      });
      if (res.ok) profileFormDirty = false;
      fetchStatus();
    }

    async function deleteCurrentProfile() {
      if (!activeProfileId) return;
      const sourceProfiles = {};
      sourceProfiles[activeProfileId] = null; // signal deletion

      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceProfiles })
      });

      activeProfileId = null;
      fetchStatus();
    }

    async function fetchStatus() {
      try {
        const res = await fetch('/api/status');
        const data = await res.json();

        currentConfig = data.config || {};
        if (data.availableEncoders) {
          currentAvailableEncoders = data.availableEncoders;
        }
        updatePreviewUi();

        activeSourceName = data.activeSource || "";
        const overlayLabel = document.getElementById('source-label-overlay');
        overlayLabel.textContent = activeSourceName ? activeSourceName + ' \u2022 1080p60 NDI' : 'Aucune source NDI d\u00e9tect\u00e9e sur le r\u00e9seau';

        const liveBadge = document.getElementById('badge-live');
        if (liveBadge) {
          const isLive = !!data.isStreamActive;
          const liveDot = liveBadge.querySelector('.live-dot');
          const liveLabel = document.getElementById('badge-live-label');
          liveBadge.classList.toggle('bg-emerald-500/20', isLive);
          liveBadge.classList.toggle('text-emerald-400', isLive);
          liveBadge.classList.toggle('border-emerald-500/30', isLive);
          liveBadge.classList.toggle('bg-slate-700/30', !isLive);
          liveBadge.classList.toggle('text-slate-400', !isLive);
          liveBadge.classList.toggle('border-slate-600/40', !isLive);
          if (liveDot) {
            liveDot.classList.toggle('bg-emerald-400', isLive);
            liveDot.classList.toggle('bg-slate-500', !isLive);
            liveDot.classList.toggle('animate-ping', isLive);
          }
          if (liveLabel) liveLabel.textContent = isLive ? 'LIVE' : 'HORS LIGNE';
        }

        const profileList = Object.values(currentConfig.sourceProfiles || {});
        const sourceProfiles = profileList.filter(p => p.source === activeSourceName);
        const activeProfile = sourceProfiles.find(p => p.autoRecord) || sourceProfiles[0];
        const profileBadge = document.getElementById('badge-active-profile');
        const profileBadgeName = document.getElementById('badge-active-profile-name');
        if (profileBadge && profileBadgeName) {
          if (activeProfile) {
            profileBadge.classList.remove('hidden');
            profileBadgeName.textContent = activeProfile.name;
            profileBadge.title = (activeProfile.bitrateMbps || '--') + ' Mbps \u2022 ' + (activeProfile.encoder || '--') + (activeProfile.autoRecord ? ' \u2022 Auto-record' : '');
          } else {
            profileBadge.classList.add('hidden');
          }
        }

        const fpsBadge = document.getElementById('preview-fps-badge');
        if (fpsBadge) {
          fpsBadge.textContent = (data.config?.video?.fps || 60) + ' FPS';
        }

        document.getElementById('stat-ram').textContent = data.buffer?.bufferDurationMinutes + ' min';

        // Populate Source Dropdowns (Dashboard & Settings)
        const select = document.getElementById('source-select');
        const profSourceSelect = document.getElementById('prof-source-select');
        const currentProfSourceVal = profSourceSelect ? profSourceSelect.value : "";

        const profileEntries = Object.entries(currentConfig.sourceProfiles || {});
        if (profileEntries.length > 0) {
          const profiles = currentConfig.sourceProfiles;
          const selectedProfileId = (activeProfileId && profiles[activeProfileId] && profiles[activeProfileId].source === activeSourceName)
            ? activeProfileId
            : (activeProfile ? activeProfile.id : null);
          let profileOptions = '<option value="" disabled' + (selectedProfileId ? '' : ' selected') + '>S\u00e9lectionner un profil...</option>';
          profileOptions += profileEntries.map(([id, prof]) =>
            '<option value="' + id + '" ' + (id === selectedProfileId ? 'selected' : '') + '>' + escapeHtml(prof.name || id) + ' \u2014 ' + escapeHtml(prof.source || 'source non assign\u00e9e') + '</option>'
          ).join('');
          select.innerHTML = profileOptions;
        }

        if (data.sources && data.sources.length > 0 && profSourceSelect) {
          profSourceSelect.innerHTML = data.sources.map(src =>
            '<option value="' + src + '" ' + (src === (currentProfSourceVal || activeSourceName) ? 'selected' : '') + '>' + src + '</option>'
          ).join('');
        }

        // Update API Key UI
        if (currentConfig.apiKey) {
          const apiKeyInput = document.getElementById('api-key-input');
          if (apiKeyInput && !apiKeyInput.getAttribute('data-user-editing')) {
            apiKeyInput.value = currentConfig.apiKey;
          }
          document.querySelectorAll('.api-key-display').forEach(el => {
            el.textContent = currentConfig.apiKey;
          });
        }

        // Select initial profile if none active
        const profiles = currentConfig.sourceProfiles || {};
        const profileKeys = Object.keys(profiles);
        if (!activeProfileId && profileKeys.length > 0) {
          activeProfileId = profileKeys[0];
        }

        renderProfilesList();
        loadSelectedProfileToForm();

        // Recording Status UI
        const btnRec = document.getElementById('btn-toggle-rec');
        const recLabel = document.getElementById('rec-btn-label');
        const recStatus = document.getElementById('rec-status-text');

        if (data.isRecording) {
          recLabel.textContent = 'Arr\u00eat (' + data.recordingDurationSeconds + 's)';
          recStatus.textContent = 'Enregistrement en cours...';
          recStatus.className = 'text-xs text-red-400 font-bold animate-pulse';
          btnRec.className = 'mt-4 w-full bg-slate-800 hover:bg-slate-700 text-red-400 font-bold py-3 px-4 rounded-lg border border-red-500/50 shadow-lg transition flex items-center justify-center gap-2';
        } else {
          recLabel.textContent = 'D\u00e9marrer Enregistrement';
          recStatus.textContent = 'Pr\u00eat \u00e0 enregistrer';
          recStatus.className = 'text-xs text-slate-400';
          btnRec.className = 'mt-4 w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 px-4 rounded-lg shadow-lg shadow-red-600/20 transition flex items-center justify-center gap-2';
        }

        // Recent Clips UI
        const clipsContainer = document.getElementById('clips-list');
        if (data.recentClips && data.recentClips.length > 0) {
          clipsContainer.innerHTML = data.recentClips.map(clip =>
            '<div class="bg-slate-950 border border-slate-800/80 p-3 rounded-lg flex items-center justify-between text-xs">'
            + '<div>'
            + '<div class="font-mono text-slate-200 font-semibold text-ellipsis overflow-hidden max-w-[180px]">' + clip.filename + '</div>'
            + '<div class="text-slate-500">' + (clip.type === 'clip' ? 'Replay Clip' : 'Enregistrement') + ' &bull; ' + clip.duration + 's</div>'
            + '</div>'
            + '<span class="bg-cyan-500/10 text-cyan-400 px-2 py-1 rounded border border-cyan-500/20 font-bold">Fireshare</span>'
            + '</div>'
          ).join('');
        }
      } catch (e) {}
    }

    async function changeSource(sourceName) {
      if (!sourceName) return;
      activeSourceName = sourceName;
      document.getElementById('source-label-overlay').textContent = sourceName;
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedSource: sourceName })
      });
      const img = document.getElementById('preview-img');
      if (img && currentConfig.previewEnabled !== false) img.src = '/api/preview.mjpeg?t=' + Date.now();
      fetchStatus();
    }

    async function changeProfile(profileId) {
      if (!profileId) return;
      const profiles = currentConfig.sourceProfiles || {};
      const prof = profiles[profileId];
      if (!prof) return;
      activeProfileId = profileId;
      profileFormDirty = false;
      renderProfilesList();
      loadSelectedProfileToForm();
      if (prof.source) {
        await changeSource(prof.source);
      } else {
        fetchStatus();
      }
    }

    async function toggleRecording() {
      await fetch('/api/streamdeck/toggle-rec', { method: 'POST' });
      fetchStatus();
    }

    async function togglePreview() {
      const enabled = !(currentConfig.previewEnabled !== false);
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ previewEnabled: enabled })
      });
      fetchStatus();
    }

    function updatePreviewUi() {
      const enabled = currentConfig.previewEnabled !== false;
      const btn = document.getElementById('btn-toggle-preview');
      const label = document.getElementById('btn-toggle-preview-label');
      const img = document.getElementById('preview-img');
      const overlay = document.getElementById('preview-disabled-overlay');
      if (btn) {
        btn.classList.toggle('bg-emerald-500/15', enabled);
        btn.classList.toggle('text-emerald-300', enabled);
        btn.classList.toggle('border-emerald-500/30', enabled);
        btn.classList.toggle('hover:bg-emerald-500/25', enabled);
        btn.classList.toggle('bg-slate-700/30', !enabled);
        btn.classList.toggle('text-slate-400', !enabled);
        btn.classList.toggle('border-slate-600/40', !enabled);
        btn.classList.toggle('hover:bg-slate-700/50', !enabled);
      }
      if (label) label.textContent = enabled ? 'ON' : 'OFF';
      if (img) {
        if (enabled) {
          if (!img.src || img.src.indexOf('/api/preview.mjpeg') === -1) {
            img.src = '/api/preview.mjpeg?t=' + Date.now();
          }
        } else {
          img.removeAttribute('src');
        }
      }
      if (overlay) overlay.classList.toggle('hidden', enabled);
    }

    async function saveReplayClip(minutes) {
      const res = await fetch('/api/streamdeck/clip?minutes=' + (minutes || 5), { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.duration && data.duration < minutes * 60) {
          alert('Seulement ' + Math.round(data.duration / 60) + ' min de replay disponibles (demande : ' + minutes + ' min)');
        }
      } else {
        alert('Erreur lors de la sauvegarde du replay');
      }
      fetchStatus();
    }

    function toggleApiKeyVisibility() {
      const input = document.getElementById('api-key-input');
      if (input.type === 'password') {
        input.type = 'text';
      } else {
        input.type = 'password';
      }
    }

    async function saveApiKey() {
      const keyInput = document.getElementById('api-key-input');
      const newKey = keyInput ? keyInput.value.trim() : '';
      if (!newKey) return;
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: newKey })
      });
      keyInput.removeAttribute('data-user-editing');
      fetchStatus();
    }

    async function testApiEndpoint(action) {
      const apiKey = currentConfig?.apiKey || '';
      let url = '';
      if (action === 'start') url = '/api/record/start';
      if (action === 'stop') url = '/api/record/stop';
      if (action === 'replay') {
        const mins = document.getElementById('test-replay-mins').value || 5;
        url = '/api/replay/save?minutes=' + mins;
      }

      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'X-API-Key': apiKey }
        });
        const result = await res.json();
        alert('Résultat API (' + res.status + ') :\\n' + JSON.stringify(result, null, 2));
      } catch (e) {
        alert('Erreur lors de l\\u0027appel API : ' + e.message);
      }
      fetchStatus();
    }

    function initPage() {
      let page = window.location.hash.replace('#', '');
      if (!page && window.location.pathname === '/settings') page = 'settings';
      if (!page && window.location.pathname === '/api-docs') page = 'apidocs';
      if (!['dashboard', 'settings', 'apidocs'].includes(page)) page = 'dashboard';
      switchPage(page);
    }

    if (document.readyState === 'loading') {
      window.addEventListener('DOMContentLoaded', initPage);
    } else {
      initPage();
    }

    window.addEventListener('DOMContentLoaded', () => {
      const keyInput = document.getElementById('api-key-input');
      if (keyInput) {
        keyInput.addEventListener('input', () => keyInput.setAttribute('data-user-editing', 'true'));
      }

      ['prof-name', 'prof-source-select', 'prof-auto-record', 'prof-ram-buffer', 'prof-bitrate', 'prof-encoder'].forEach(id => {
        const field = document.getElementById(id);
        if (field) {
          field.addEventListener('input', () => { profileFormDirty = true; });
          field.addEventListener('change', () => { profileFormDirty = true; });
        }
      });

      setInterval(fetchStatus, 2000);
      fetchStatus();
    });

    window.addEventListener('hashchange', initPage);
    window.addEventListener('popstate', initPage);
  </script>
</body>
</html>`;
}
