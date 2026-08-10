# Plan d'Architecture & Spécifications techniques : NDI DockRecorder

## 1. Vue d'Ensemble & Objectifs
**NDI DockRecorder** est un logiciel conteneurisé (Docker) conçu pour capturer des flux vidéo/audio NDI sur le réseau local, gérer un **tampon de relecture (Replay Buffer)** rétroactif, enregistrer des vidéos en continu ou à la demande, et publier automatiquement les fichiers pour [Fireshare](https://github.com/ShaneIsrael/fireshare).

### Fonctionnalités Clés
- **Docker Host Network** : Découverte automatique mDNS / Avahi des sources NDI.
- **Auto-Détection NDI** : Démarrage / arrêt automatique de l'enregistrement à la détection d'une source NDI active.
- **Replay Buffer Rétroactif** : Sauvegarde instantanée des $X$ dernières minutes (stocké en `tmpfs` / RAM).
- **Intégration Stream Deck** : Contrôle à distance via API HTTP REST & WebSocket (compatible Bitfocus Companion).
- **Export Fireshare** : Formatage des fichiers MP4 et écriture directe dans le dossier d'observation Fireshare avec notifications Webhook.
- **Configuration Avancée** : Routage audio multi-canaux, choix de l'encodeur (NVENC / QuickSync / CPU x264), résolution et débit ajustable.

---

## 2. Architecture du Système

```
+-----------------------------------------------------------------------+
|                         RESEAU LOCAL (NDI)                            |
|  [OBS Studio]         [Gaming PC NDI]         [Camera NDI]            |
+-----------------------------------------------------------------------+
                                   |
                                   v
+-----------------------------------------------------------------------+
|                  NDI DockRecorder (Docker Container)                  |
|  Mode: net=host | Memory: tmpfs RAM Buffer                            |
|                                                                       |
|  +-----------------------------------------------------------------+  |
|  | NDI Discovery & Stream Monitor (libNDI / Avahi)                 |  |
|  +-----------------------------------------------------------------+  |
|                                  |                                    |
|                                  v                                    |
|  +-----------------------------------------------------------------+  |
|  | FFmpeg / GStreamer Engine                                       |  |
|  |  - Continuous Segmenter (RAM Buffer /tmp/replay_buffer)         |  |
|  |  - Active Recorder (NVENC / CPU x264 -> MP4)                     |  |
|  +-----------------------------------------------------------------+  |
|                                  ^                                    |
|                                  |                                    |
|  +-----------------------------------------------------------------+  |
|  | Control Server (REST API & WebSockets)                          |  |
|  +-----------------------------------------------------------------+  |
+-----------------------------------------------------------------------+
         |                                                 |
         v                                                 v
+------------------------+                     +------------------------+
|   Stream Deck / Client |                     |  Dossier Fireshare     |
|   (HTTP / WebSocket)   |                     |  (/media/fireshare)    |
+------------------------+                     +------------------------+
```

---

## 3. Spécification des Composants

### 3.1. Conteneurisation Docker (`Dockerfile` & `docker-compose.yml`)
- **Base** : Debian Bookworm / Ubuntu 22.04 avec runtime NDI SDK (`libndi.so`).
- **Réseau** : `network_mode: "host"` obligatoire pour la découverte mDNS du NDI.
- **Volume RAM (`tmpfs`)** : Monté sur `/tmp/replay_buffer` pour enregistrer les segments sans user le SSD/HDD.
- **Volume Vidéos** : Monté sur `/recordings` qui pointe vers le dossier Fireshare.

### 3.2. Moteur NDI & Auto-Détection (`src/ndi.mjs`)
- Utilise `libNDI` pour lister les sources disponibles (`NDIlib_find`).
- Surveille l'apparition / disparition de flux NDI configurés.
- Déclenche automatiquement `startRecording()` / `stopRecording()` selon les règles établies.

### 3.3. Replay Buffer (`src/replay-buffer.mjs`)
- FFmpeg découpe le flux NDI en segments `.ts` de 2 secondes enregistrés dans `/tmp/replay_buffer`.
- Un processus de nettoyage supprime les segments plus vieux que la fenêtre sélectionnée (ex: 5 min = 150 segments).
- Lors de l'appel `/api/replay/save?minutes=X`, les segments récents sont assemblés sans réencodage (`-c copy`) dans le dossier de destination Fireshare.

### 3.4. API Stream Deck & WebSocket (`src/index.mjs`)
Endpoints REST :
- `GET /api/status` : Statut du système, sources NDI actives, état du buffer.
- `GET /api/sources` : Liste des flux NDI détectés.
- `POST /api/record/start` : Démarrer un enregistrement direct.
- `POST /api/record/stop` : Arrêter l'enregistrement.
- `POST /api/replay/save` : Sauvegarder les X dernières minutes.
- `POST /api/config` : Modifier la qualité (bitrate, encoder, audio).

WebSocket :
- Push en temps réel de la durée d'enregistrement, du niveau du vumètre audio et des alertes d'état pour les boutons Stream Deck.

### 3.5. Intégration Fireshare (`src/fireshare.mjs`)
- Formattage standard des fichiers : `YYYY-MM-DD_HH-mm-ss_[SOURCE]_[TYPE].mp4`.
- Une fois le fichier finalisé, appel HTTP optionnel vers l'API de Fireshare (`POST /api/v1/videos/scan`).

### 3.6. Configuration Vidéo et Routage Audio (`src/config.mjs`)
- **Codecs vidéo** : `h264_nvenc`, `hevc_nvenc`, `libx264`, `h264_qsv`.
- **Résolution** : Source native, 1080p, 720p.
- **Bitrate** : Slider 5 Mbps à 50 Mbps.
- **Audio** : Sélection des pistes audio NDI (Channel 1/2 stereo, multi-track mapping).

---

## 4. Plan de Déploiement et d'Enregistrement

1. Lancer la pile Docker avec `docker-compose up -d`.
2. Accéder à l'interface web sur `http://localhost:3000`.
3. Sélectionner la source NDI et valider la durée du Replay Buffer.
4. Programmer les boutons du Stream Deck avec les URLs HTTP de l'API REST.

---

## 5. Exécution locale (hors Docker)

1. Installer le SDK NDI local : `brew install --cask libndi` (headers vendored dans `vendor/ndi/`, voir `vendor/ndi/README.md`).
2. Compiler le helper natif : `npm run build` (produit `bin/ndi_capture`).
3. Lancer l'application : `npm start` (utilise `bin/ndi_capture` pour la capture/discovery NDI).
