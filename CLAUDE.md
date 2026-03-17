# CLAUDE.md — Contexte du projet TruckFlow

## Projet

Application web monofichier HTML : **`truckflow_2058.html`** (~7800 lignes, ~220 fonctions)
Outil de gestion logistique d'un hub de transport (quais, camions, livraisons).
**Version Alpha** — Auteur : Galaad Poivey — Développé avec Claude (Anthropic)
**Écran cible** : 24 pouces (1920×1080) — layout optimisé `max-width:1920px`

---

## Structure de l'application HTML

L'app est organisée en **7 onglets principaux** :

| Onglet | Description |
|--------|-------------|
| **Synthèse** | KPIs globaux, ponctualité, vue semaine/jour (cartes glass individuelles), cadences |
| **Livraisons** | Recherche, filtres, détail articles par livraison |
| **Camions** | Filtres (ponctualité, période, statut "en cours"), timestamps, créneaux, split, verrouillage, indépendant des reimports VL06O |
| **Planning** | Timeline 5h-22h, assignation créneaux, lien vers camion |
| **Plan de quai** | Layout visuel Q2→Q11 + Allées + Épis, assignation statuts, flux manuels (en développement) |
| **Statistiques** | Ponctualité, temps entre étapes, comparatif par jour, comparatif transporteurs (lit données live + archivées) |
| **Archive** | Camions terminés consultables (10 jours de rétention), détail livraisons, timestamps, ponctualité |

### Fonctionnalités clés
- **Import VL06O** : import de données SAP, colonnes détectées automatiquement, validation erreurs
- **Partage & Export** : sauvegarde JSON (inclut archive), sync entre onglets (BroadcastChannel), export Excel, purge détaillée
- **Workflow quotidien** : 6 étapes (import → synthèse → assignation quai → suivi → export → purge)
- **Notifications** : alertes retard camion + chargement long, seuils configurables, son optionnel, checker démarré dès init()
- **Verrouillage** : figer camions + livraisons, préservation temporalité
- **Indépendance camions** : les camions avec timestamps conservent leurs livraisons même absentes du reimport VL06O
- **Archive camions terminés** : `_completedTrucks[]` avec rétention 10 jours, inclus dans export/import session, stats lisent live + archivé
- **Suivi activité** : cadences sortie silo (pal/h) et ramasse colis (col/h)
- **Dashboard briefing** : récapitulatif automatique après import VL06O
- **Barre de progression** : % camions terminés dans le header
- **Journal d'activité** : historique horodaté de toutes les actions
- **Drag & drop** : déplacer livraisons entre camions visuellement
- **Mode compact** : cartes camion réduites à une ligne
- **Auto-refresh** : mise à jour des chronos toutes les 30 secondes + couleurs camions toutes les 5 secondes
- **Animations** : flash vert à la complétion d'un camion
- **Tooltips KPI** : détails enrichis au survol des indicateurs
- **Thème clair/sombre** : toggle avec persistance localStorage
- **Recherche globale** : livraisons et camions depuis le header
- **ETA camions** : estimation heure de départ basée sur les temps moyens historiques
- **Gantt interactif** : barres de progression réelles sur le planning
- **Raccourcis clavier** : navigation rapide (1-7 onglets, Ctrl+F, Ctrl+Z, C, T, ?)
- **Mode TV** : affichage grandes polices pour écran mural
- **Rapport PDF** : génération rapport complet imprimable
- **Sparklines** : mini-graphiques tendance 7 jours sur les KPIs
- **Scoring transporteurs** : note pondérée ponctualité/temps chargement (5 étoiles)
- **Heatmap horaire** : carte de chaleur occupation jour×heure
- **Système Undo** : annulation des dernières actions (Ctrl+Z)
- **Notes camions** : commentaires libres par camion avec persistance
- **Filtre avancé** : multi-critères (transporteur, période, ponctualité, statut "en cours", quai)
- **Archive quotidienne** : export/import fichier JSON séparé (90 jours max), auto-archivage avant chaque import VL06O
- **Prédiction retard** : badge de risque sur les camions basé sur l'historique transporteur + créneau
- **Comparatif semaine** : KPIs semaine actuelle vs précédente avec deltas colorés
- **Temps optimal quai** : classement des quais par temps de rotation moyen
- **Alerte surcharge créneau** : détection temps réel des créneaux à 70%+ de capacité
- **Vue Kanban** : colonnes En attente → Arrivé → À quai → En chargement → Parti
- **Timeline verticale** : frise chronologique détaillée par camion avec durées inter-étapes
- **Export rapport email** : copie texte formaté dans le presse-papier (touche E)
- **Checklist de clôture** : vérification fin de journée avec auto-détection
- **Marqueur priorité** : étiquettes Urgent / Normal / Flexible par camion
- **Courbe tendance ponctualité** : graphique SVG sur 30 jours depuis l'archive
- **Top 3 / Flop 3 transporteurs** : podium visuel basé sur l'historique archivé
- **Compteurs temps réel** : widgets sur site / en attente / en chargement / partis
- **Templates créneaux** : sauvegarder et réappliquer des configurations types de journée

---

## Design & Layout

- **Liquid Glassmorphism** : `backdrop-filter:saturate(200%) blur(28px)`, bordures cyan `rgba(160,210,255,.18)`, gradient surfaces, `--glass-glow` inner glow 4 côtés
- **4 orbs animés** : Blue 1000px, Violet 900px, Cyan 700px, Amber 600px, blur 80px sur fond `#0d1117`
- **Layout 24"** : `.main` max-width 1920px, `.hdr-in` / `.tabs-in` max-width 1920px
- **Vue Semaine & Vue Jour** : même pattern de cartes glass individuelles (`.syn-ponct` conteneur + `.spc` cartes en grille)
- **Classe utilitaire `.glass-panel`** : panneau glass réutilisable avec `::before` lumineux
- **Grille KPI jour** : `repeat(5,1fr)` par défaut, responsive 3 cols sous 1200px, 2 cols sous 700px

---

## Persistance des données

| Clé localStorage | Contenu |
|-----------------|---------|
| `th10_trucks` | Tableau des camions |
| `th10_ts` | Timestamps par camion |
| `th10_deliveries` | Livraisons importées |
| `th10_articles` | Articles par livraison |
| `tf_completed` | Camions terminés archivés (10 jours) |
| `tf_*` | Config/features diverses |

- `save()` sérialise trucks, timestamps, deliveries, articles dans localStorage
- `init()` charge depuis localStorage au démarrage
- `exportSession()` inclut `completed: _completedTrucks`
- `importSession()` restaure les camions archivés

---

## Fichiers produits

| Fichier | Description |
|---------|-------------|
| `truckflow_2058.html` | Fichier source principal |
| `TruckFlow_Documentation_Technique.docx` | Documentation technique complète |
| `TruckFlow_Presentation.pptx` | Présentation réunion (12 slides) |

---

## Notes techniques

- Application **100% frontend** (HTML + CSS + JS vanilla, monofichier)
- ~7 800 lignes de code, ~220 fonctions JavaScript
- Design Apple-style dark theme (liquid glassmorphism) + light theme
- Dépendance unique : SheetJS (CDN) pour import/export Excel
- Compatible navigateur moderne (Chrome, Edge, Firefox)
- Toutes les fonctions développées par IA
- `autoGenTrucks()` : camions avec timestamps traités comme verrouillés (conservent leurs livraisons)
- `cleanCompletedTrucks()` : archive le camion dans `_completedTrucks` avant suppression
- `computeTimingStats()` / `computeCarrierStats()` : fusionnent données live + archivées
