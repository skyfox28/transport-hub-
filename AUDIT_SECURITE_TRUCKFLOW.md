# Rapport d'Audit Sécurité — TruckFlow
**Application :** `truckflow_2058.html` — Hub de transport logistique
**Date d'audit :** 2026-03-25
**Référentiels :** OWASP Top 10, ANSSI, RGPD, ISO 27001
**Commit d'application des correctifs :** `440d56a` → `cbfd0d3`

---

## Résumé exécutif

Audit complet d'une application web monofichier 100 % frontend (~7 800 lignes, ~220 fonctions JS). Six vulnérabilités identifiées, dont deux critiques (XSS, absence de CSP). Deux bugs bloquants détectés et corrigés en parallèle. Tous les points ont été corrigés sans modifier la logique métier.

---

## Vulnérabilités identifiées et corrigées

### C1 — XSS par injection HTML `[CRITIQUE]`
**OWASP A03 · ANSSI**

**Problème :** Les données SAP (noms de transporteurs, destinations, IDs livraisons) étaient injectées directement via `innerHTML` sans échappement. Une valeur malveillante dans un fichier VL06O pouvait exécuter du JavaScript arbitraire.

**Avant :**
```js
element.innerHTML = truck.name;  // injection directe, non échappée
```

**Après :** Fonction `escH()` systématique sur toute donnée utilisateur affichée en HTML.
```js
function escH(s) {
  var d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}
// usage
element.innerHTML = escH(truck.name);
```
**Ligne :** `4123` — appliqué sur l'ensemble des rendus dynamiques.

---

### C2 — Absence de Content-Security-Policy `[CRITIQUE]`
**OWASP A05 · ANSSI**

**Problème :** Aucun en-tête CSP. Toute injection XSS réussie pouvait charger des scripts externes, exfiltrer des données, ouvrir des communications vers l'extérieur.

**Après :** Meta CSP ajoutée en `<head>` (lignes 14–25) :
```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'none';
  script-src 'unsafe-inline' https://cdn.sheetjs.com;
  style-src 'unsafe-inline';
  img-src 'self' data: blob:;
  connect-src 'none';
  object-src 'none';
  base-uri 'none';
  form-action 'none';
">
```
> **Note résiduelle :** `'unsafe-inline'` est requis pour l'architecture monofichier. Pour supprimer cette contrainte, il faudrait externaliser le JS dans un fichier séparé et calculer un nonce CSP côté serveur.

---

### C3 / I5 — Dépendance CDN sans contrôle d'intégrité `[ÉLEVÉ]`
**OWASP A06 · ANSSI supply chain**

**Problème :** SheetJS (bibliothèque d'import/export Excel) chargé depuis un CDN externe sans `integrity` (SRI) ni vérification de l'API. Un CDN compromis pouvait injecter du code malveillant.

**Après :**
```js
var s = document.createElement('script');
s.src = XLSX_CDN_URL;
s.crossOrigin = 'anonymous';          // active la vérification CORS
s.onload = function() {
  // Vérification minimale de l'API attendue
  if (!window.XLSX || typeof XLSX.read !== 'function'
      || typeof XLSX.utils !== 'object'
      || typeof XLSX.writeFile !== 'function') {
    console.error('[TruckFlow] SheetJS API invalide — bibliothèque rejetée');
    window._xlsxLoadFailed = true;
    delete window.XLSX;
  }
};
```
**Recommandation restante :** Héberger `xlsx.full.min.js` en local (intranet) et ajouter `integrity="sha384-<HASH>"`. Procédure documentée dans le code (ligne 1588).

---

### C4 — Donnée personnelle SAP exposée (RGPD) `[MOYEN]`
**RGPD Art. 4 & 32 · ANSSI**

**Problème :** Le champ `Créé par` importé depuis VL06O contient l'identifiant SAP de l'opérateur (ex : `PDURAND`) — donnée personnelle directe affichée en clair dans les tableaux.

**Après :** Pseudonymisation via `_maskCree()` (ligne 4133) :
```js
function _maskCree(v) {
  if (!v || v === '—') return v || '—';
  var s = String(v).trim();
  if (s.length <= 1) return s;
  return escH(s.charAt(0)) + '***';  // "PDURAND" → "P***"
}
```
> **Note :** La valeur brute reste en mémoire pour la recherche interne uniquement. Pour une conformité totale, validation DPO requise pour suppression complète du champ.

---

### I3 — BroadcastChannel sans authentification `[MOYEN]`
**OWASP A04**

**Problème :** La synchronisation entre onglets via `BroadcastChannel` n'authentifiait pas les messages. Toute page de la même origine pouvait envoyer de faux messages de sync et écraser les données.

**Après :** Jeton de session aléatoire partagé entre les onglets légitimes (lignes 1641–1658) :
```js
var _tfSessionToken = (function() {
  try {
    var k = 'tf_session_token';
    var t = sessionStorage.getItem(k);
    if (!t) {
      t = Math.random().toString(36).slice(2)
        + Math.random().toString(36).slice(2);
      sessionStorage.setItem(k, t);
    }
    return t;
  } catch(e) {
    // sessionStorage indisponible (iframe sandboxé, politique entreprise)
    return Math.random().toString(36).slice(2)
         + Math.random().toString(36).slice(2);
  }
})();

// Validation à la réception
_bc.onmessage = function(ev) {
  // AUDIT I3 : valider le token avant d'accepter tout message
  if (!ev.data || ev.data.tok !== _tfSessionToken) return;
  // traitement...
};
```

---

### I6 — Export de données sans avertissement RGPD `[FAIBLE]`
**RGPD Art. 5 · ISO 27001 A.5.33**

**Problème :** La fonction `exportSession()` générait et téléchargeait directement un fichier JSON contenant la totalité des données (livraisons SAP, timestamps, archives) sans aucun avertissement.

**Après :** Dialogue de confirmation obligatoire avant tout export (ligne 3560) :
```js
var warnMsg = '⚠️ EXPORT DE DONNÉES SENSIBLES\n\n'
  + 'Ce fichier contiendra :\n'
  + '• ' + totalTrucks + ' camion(s) avec timestamps et notes\n'
  + '• ' + totalDelivs + ' livraison(s) SAP avec destinations\n\n'
  + 'Ce fichier NE DOIT PAS être :\n'
  + '  – Envoyé par email non chiffré\n'
  + '  – Stocké sur un cloud personnel\n'
  + '  – Transmis à un outil IA externe\n\n'
  + 'Confirmer l\'export vers un espace sécurisé ?';
if (!confirm(warnMsg)) return;
```

---

## Bugs bloquants corrigés

### B1 — Gel au démarrage : `sessionStorage` sans try/catch
**Commit `c321891`**

`sessionStorage.getItem()` appelé sans protection. Dans un environnement entreprise (iframe sandboxé, cookies bloqués), cela levait une `SecurityError` non interceptée qui gelait toute l'application au chargement. Corrigé par un bloc try/catch avec token éphémère de fallback.

---

### B2 — SyntaxError bloquant tout le JavaScript
**Commit `cbfd0d3`**

Un commentaire `/* AUDIT I3 */` avait été placé à l'intérieur du bloc d'extraction de code Monitor :

```js
// Pattern affecté :
var _js = (function() { /* ... code JS ... */ }).toString().match(/\/\*([\s\S]*)\*\//)[1];
```

Le `*/` du commentaire d'audit fermait prématurément le bloc `/* */` extérieur, produisant `Uncaught SyntaxError: Unexpected token ';'` qui bloquait **l'intégralité du JS** au démarrage. Corrigé en remplaçant par un commentaire `//` sur une seule ligne.

---

## Risques résiduels

| Risque | Niveau | Action requise |
|--------|--------|---------------|
| `'unsafe-inline'` dans CSP | Moyen | Externaliser JS + nonce CSP côté serveur |
| SRI SheetJS absent | Moyen | Héberger en local + calculer hash SHA-384 |
| Champ `Créé par` en mémoire | Faible | Validation DPO pour suppression complète |
| `localStorage` non chiffré | Faible | Acceptable pour application intranet |
| Pas d'authentification utilisateur | Info | Hors périmètre (gestion par l'infrastructure) |

---

## Références commits

| Commit | Description |
|--------|-------------|
| `440d56a` | Application des 6 correctifs de sécurité |
| `c321891` | Correctif gel démarrage (sessionStorage + double-escape) |
| `bef90b2` | Correctif dashboard vide (try/catch silencieux) |
| `cbfd0d3` | Correctif SyntaxError critique (commentaire Monitor IIFE) |
