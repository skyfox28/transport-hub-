# CLAUDE.md — Contexte du projet TruckFlow

## Projet

Application web monofichier HTML — outil de gestion logistique d'un hub de transport (quais, camions, livraisons).
**Auteur** : Galaad Poivey — Développé avec Claude (Anthropic)
**Écran cible** : 24 pouces (1920×1080) — layout optimisé `max-width:1920px`

---

## Fichier actif

| Fichier | Version | État |
|---------|---------|------|
| `TruckFlow_v1.52.html` | v1.52 | **Version courante** |
| `TruckFlow_v1.51.html` | v1.51 | Archivé |
| `TruckFlow_v1.50.html` | v1.50 | Archivé |
| `TruckFlow_v1.49.html` | v1.49 | Archivé |
| `TruckFlow_v1.48.html` | v1.48 | Archivé |
| `TruckFlow_v1.47.html` | v1.47 | Archivé |
| `TruckFlow_v1.45.html` | v1.45 | Archivé |
| `TruckFlow_v1.44.html` | v1.44 | Archivé |

> **Règle de versioning** : chaque modification crée un nouveau fichier (ex: v1.44 → v1.45) et met à jour `APP_VERSION` dans le JS (`var APP_VERSION = 'vX.XX'` ligne ~1825).

---

## Structure de l'application HTML

L'app est organisée en **8 onglets** :

| ID tab | Onglet | Description |
|--------|--------|-------------|
| `syn` | **Synthèse** | KPIs globaux, ponctualité, vue semaine/jour, cadences |
| `liv` | **Livraisons** | Recherche, filtres, détail articles par livraison |
| `cam` | **Camions** | Timestamps, créneaux, split, verrouillage, mode montage |
| `plan` | **Planning** | Timeline 5h-22h, assignation créneaux, Gantt |
| `quai` | **Plan de quai** | Layout visuel Q2→Q11 + Allées + Épis |
| `stat` | **Statistiques** | Ponctualité, comparatif transporteurs, heatmap |
| `arch` | **Archive** | Camions terminés (10 jours rétention) |
| `emb` | **Emballages** | Suivi emballages |

---

## Système d'authentification (v1.44)

### Fonctionnement
- Écran de login plein-écran à l'ouverture (`#auth-overlay`)
- Hash SHA-256 des mots de passe — jamais stockés en clair
- `sessionStorage.tf_auth = '1'` après login
- `sessionStorage.tf_user = '<username>'` stocke l'utilisateur connecté
- Purge automatique des données localStorage à la fermeture

### Comptes existants

| Utilisateur | Rôle | Accès |
|------------|------|-------|
| `galaad` | Admin | Tout |
| `caserta` | Admin | Tout |
| `mccormick` | Opérateur restreint | Camions + Import/Export/VL06O/Monitor |
| `live` | Live Monitor | Monitor uniquement + sync réseau auto |

> **Ajouter un compte** : modifier `_TF_AUTH_USERS` (~ligne 11059 dans v1.44) avec le hash SHA-256 du mot de passe.
> Commande : `echo -n "motdepasse" | sha256sum`

> **Ajouter un profil restreint** : ajouter le username dans `_TF_RESTRICTED_PROFILES` (tableau juste après `_TF_AUTH_USERS`).

### Profil McCormick (opérateur restreint)
- **Onglets visibles** : Camions uniquement (tous les autres masqués)
- **Fonctions autorisées** :
  - Import VL06O (bouton `↑ VL06O`)
  - Import session (bouton `↑ Sync`)
  - Export session (bouton `↓ Partager`)
  - Mode Monitor (dans le menu `⋯`)
- **Fonctions masquées** :
  - Onglets : Synthèse, Livraisons, Planning, Plan de quai, Stats, Archive, Emballages
  - Boutons header : Mobile, Excel, Rapport
  - Menu `⋯` : Journal d'activité, Réglages alertes, Purger les données
- **Badge** : affiche `MCCORMICK` en bleu dans le header
- **switchTab verrouillé** : seul l'onglet `cam` est accessible programmatiquement

### Fonctions clés auth
```
tfLogin()              — vérifie username + hash pwd, stocke tf_auth + tf_user
tfRunApp()             — démarre l'app (init + restrictions)
applyProfileRestrictions() — applique le masquage selon tf_user
tfChooseImportSession() — post-login : importer session JSON
tfChooseImportVL06O()  — post-login : importer VL06O
tfChooseFresh()        — post-login : session vierge
tfShowQuitModal()      — modal quitter + exporter
tfPurgeAndQuit()       — purge localStorage + reload
```

---

## Fonctionnalités récentes (depuis v1.42)

### v1.43 — Bug montage + Export auto
- **Fix `toggleMontageGroup`** : le filtre de sélection de groupe respecte maintenant `_montageDateFilter` — évite de sélectionner les livraisons de toutes les dates d'un transporteur quand un filtre date est actif
- **Export session automatique horaire** : option dans Réglages alertes (`⚙`) → "Export session automatique" → "Toutes les heures". Fonction `autoExportSession()` silencieuse (sans `confirm`). Persisté dans `tf_alert_cfg.autoExport`.

### v1.44 — Système de profils
- Ajout compte `mccormick` (opérateur restreint)
- `applyProfileRestrictions()` appelée dans `tfRunApp()`
- Badge utilisateur dans le header pour les profils restreints

### v1.45 — Badge admin + switch + Excel/PDF McCormick + bouton Undo
- Badge vert pour admin (galaad, caserta), bleu pour restricted (mccormick)
- Bouton "Changer de session" dans le menu `⋯`
- Excel et PDF autorisés pour McCormick
- Bouton `↩ Annuler` dans le header — `_undoStack`, `pushUndo()`, `doUndo()`
- Undo restore les archives : capture `trucks`, `timestamps` ET `_completedTrucks`

### v1.46 — Sauvegarde d'urgence
- `_buildSessionPayload()` / `_saveBackupSessionSync()` — écrit dans `tf_emergency_backup`
- Hook sur `save()`, `visibilitychange`, `beforeunload`, `pagehide`
- Bouton `🛟 Restaurer sauvegarde d'urgence` dans le modal login
- `tfRestoreBackup()` — restaure la session complète
- `tf_emergency_backup` exclu du `tfPurgeAndQuit()`

### v1.47 — Mode Monitor amélioré
- Sélecteur de date dans Monitor (`#monDateInp`) — voir un autre jour
- Compteur "Partis" correct : les camions archivés (`_completedTrucks`) sont inclus dans les KPIs et la section Partis
- `getCompleted()` dans Monitor — lit `tf_completed`
- Fix COMPANS dans Monitor : 2 timestamps seulement (arr + dep)

### v1.48 — Sync réseau (File System Access API)
- Bouton `📡 Réseau` dans le header principal — `toggleNetSync()`
- `openNetworkSync()` : `showSaveFilePicker` → choisir/créer un fichier sur un partage réseau
- `_writeNetSync()` : écrit le payload JSON dans le fichier après chaque `save()`
- Bouton `📡 Connexion réseau` dans le Monitor — `toggleNetMon()`
- `openNetworkMonitor()` : `showOpenFilePicker` → ouvrir le fichier réseau
- `_pollNetFile()` : poll toutes les 10s, met à jour localStorage puis appelle `render()`
- Indicateur visuel (point vert/rouge animé) dans les deux interfaces
- McCormick ne voit pas le bouton `📡 Réseau` (ajouté à `applyProfileRestrictions`)

### v1.49 — Profil Live Monitor
- Compte `live` / mot de passe `1963` — hash identique à caserta/mccormick
- `_TF_LIVE_PROFILES = ['live']` : liste des profils qui ouvrent directement le Monitor
- Login `live` → `tfRunApp()` détecte le profil → appelle `openLiveMonitor()`
- `openLiveMonitor()` : appelle `openTruckMonitor({live:true})`
- `openTruckMonitor(opts)` modifié : si `live`, écrit dans `window` courant (pas de nouvelle fenêtre), injecte `_isLiveProfile=true`, titre `📡 TruckFlow Live`
- Splash plein écran au démarrage : bouton unique "Choisir le fichier réseau" → `openNetworkMonitor()` → splash se ferme si connexion OK
- Page transformée en Monitor pur, sans aucun accès à l'app principale

### v1.50 — Fix timestamps sur date passée dans le Monitor
- `_nowTs()` : helper Monitor qui retourne `_monDate + heure locale courante`
- **Bug corrigé** : `stampM()` utilisait `new Date().toISOString().slice(0,10)` → remplacé par `_monDate`
- **Bug corrigé** : `stamp()` (timestamp immédiat) utilisait `new Date().toISOString()` → remplacé par `_nowTs()`
- **Bug corrigé** : `_stampDepNow()` utilisait `new Date().toISOString()` → remplacé par `_nowTs()`
- Résultat : toute saisie dans le Monitor (manuelle ou auto) est enregistrée à la date sélectionnée dans `#monDateInp`

---

## Mode Montage (`_montageMode`)

- Activé depuis l'onglet Camions
- `_montageDateFilter` : filtre par date (null = toutes dates)
- `_montageSelected` : objet `{id: true}` des livraisons sélectionnées
- `toggleMontageGroup(itin)` : sélectionne toutes les livraisons d'un transporteur **pour la date filtrée**
- `confirmMontage()` : crée le camion avec `locked:true` et `_montage:true`
- Les camions montage sont indépendants des reimports VL06O

---

## Persistance des données

| Clé localStorage | Contenu |
|-----------------|---------|
| `th10_trucks` | Tableau des camions |
| `th10_ts` | Timestamps par camion |
| `th10_deliveries` | Livraisons importées |
| `th10_articles` | Articles par livraison |
| `tf_completed` | Camions terminés archivés (10 jours) |
| `tf_alert_cfg` | Seuils alertes + son + export auto |
| `tf_theme` | Thème clair/sombre |
| `tf_palettes` | Données palettes |
| `tf_history` | Historique actions |
| `tf_purge_warned` | Date dernier avertissement purge |

---

## Design & Layout

- **Liquid Glassmorphism** : `backdrop-filter:saturate(200%) blur(28px)`, bordures cyan `rgba(160,210,255,.18)`, `--glass-glow` inner glow
- **4 orbs animés** : Blue 1000px, Violet 900px, Cyan 700px, Amber 600px, fond `#0d1117`
- **Layout 24"** : `.main` max-width 1920px
- **Classe `.glass-panel`** : panneau glass réutilisable avec `::before` lumineux
- **Grille KPI jour** : `repeat(5,1fr)`, responsive 3 cols < 1200px, 2 cols < 700px

---

## Notes techniques

- Application **100% frontend** (HTML + CSS + JS vanilla, monofichier)
- ~7 800+ lignes, ~220+ fonctions JavaScript
- Dépendance unique : SheetJS (CDN) pour import/export Excel
- Compatible Chrome, Edge, Firefox
- `autoGenTrucks()` : camions avec timestamps traités comme verrouillés
- `cleanCompletedTrucks()` : archive dans `_completedTrucks` avant suppression
- `computeTimingStats()` / `computeCarrierStats()` : fusionnent données live + archivées
- `BroadcastChannel` pour sync multi-onglets (token sécurisé)

---

## Idées / Évolutions à prévoir

- Profils supplémentaires : si besoin d'un 4e compte, ajouter dans `_TF_AUTH_USERS` + optionnellement dans `_TF_RESTRICTED_PROFILES`
- Personnaliser les droits d'un profil restreint : modifier `applyProfileRestrictions()` — la liste des IDs à masquer est dans le tableau `['hdrBtnMobile','excelMenuWrap',...]`
- Import choice modal pour McCormick : actuellement il voit les 3 options (session, VL06O, vierge) — possible de masquer "Session vierge" si besoin
