"""
predictor.py — Inférence : utilise les modèles sauvegardés pour prédire.

3 fonctions publiques :
  predict_load_time(truck_features)   → {minutes, label, color, icon}
  predict_capacity(day_features)      → {label, color, icon, details}
  predict_delay_risk(truck_features)  → {pct, label, color, icon}
"""

import numpy as np
import pandas as pd

from ml.trainer import load_all_models

CADENCE_SILO = 18
CADENCE_PICK = 600

# Seuils configurables
SEUIL_LOAD_ORANGE = 75   # min → au-delà : risque dépasse créneau
SEUIL_LOAD_ROUGE  = 100  # min → très long

_models = None


def _get_models():
    global _models
    if _models is None:
        _models = load_all_models()
    return _models


def reload_models():
    """À appeler après un réentraînement."""
    global _models
    _models = load_all_models()


# ---------------------------------------------------------------------------
# Modèle 1 — Durée de chargement
# ---------------------------------------------------------------------------

def predict_load_time(
    transporteur: str,
    creneau_start: int | None,
    nb_deliveries: int,
    pal_silo: float,
    colis_pick: float,
) -> dict:
    """
    Prédit la durée totale (arrivée → départ) d'un camion en minutes.
    """
    models = _get_models()
    m = models.get("load_time")

    hr_silo = pal_silo / CADENCE_SILO
    hr_pick = colis_pick / CADENCE_PICK

    if m is None:
        # Fallback : estimation théorique simple
        minutes_theory = (hr_silo + hr_pick) * 60 + 15  # +15min de marge
        return _load_result(minutes_theory, estimated=True)

    X = pd.DataFrame([{
        "transporteur":       transporteur.strip().upper(),
        "creneau_start":      creneau_start if creneau_start is not None else -1,
        "nb_deliveries":      nb_deliveries,
        "pal_silo":           pal_silo,
        "colis_pick":         colis_pick,
        "hr_silo_theorique":  hr_silo,
        "hr_pick_theorique":  hr_pick,
    }])
    minutes = float(m.predict(X)[0])
    return _load_result(minutes, estimated=False)


def _load_result(minutes: float, estimated: bool) -> dict:
    minutes = max(5.0, round(minutes, 0))
    if minutes <= SEUIL_LOAD_ORANGE:
        color, icon, label = "#4ade80", "✅", "Normal"
    elif minutes <= SEUIL_LOAD_ROUGE:
        color, icon, label = "#fbbf24", "⚠️", "Chargement long"
    else:
        color, icon, label = "#f87171", "🔴", "Très long — risque retard"
    return {
        "minutes":   int(minutes),
        "label":     label,
        "color":     color,
        "icon":      icon,
        "estimated": estimated,
    }


# ---------------------------------------------------------------------------
# Modèle 2 — Capacité journalière
# ---------------------------------------------------------------------------

def predict_capacity(
    nb_trucks: int,
    nb_deliveries: int,
    pal_silo_total: float,
    colis_pick_total: float,
) -> dict:
    """
    Prédit si la journée est gérable : OK / TENDU / SURCHARGE.
    Fournit aussi les détails théoriques (heures silo + picking).
    """
    models = _get_models()
    bundle = models.get("capacity")

    hr_silo = round(pal_silo_total / CADENCE_SILO, 2)
    hr_pick = round(colis_pick_total / CADENCE_PICK, 2)
    hr_total = hr_silo + hr_pick

    details = {
        "hr_silo":    hr_silo,
        "hr_pick":    hr_pick,
        "hr_total":   round(hr_total, 2),
        "pal_silo":   int(pal_silo_total),
        "colis_pick": int(colis_pick_total),
    }

    if bundle is None:
        # Fallback purement théorique
        label = _capacity_theory(hr_total)
        return {**_capacity_result(label), "details": details, "estimated": True}

    X = pd.DataFrame([{
        "nb_trucks":        nb_trucks,
        "nb_deliveries":    nb_deliveries,
        "pal_silo_total":   pal_silo_total,
        "colis_pick_total": colis_pick_total,
        "hr_silo_needed":   hr_silo,
        "hr_pick_needed":   hr_pick,
    }])

    scaler = bundle["scaler"]
    model  = bundle["model"]
    X_s    = scaler.transform(X)
    label  = model.predict(X_s)[0]

    # Probabilités pour chaque classe
    proba = model.predict_proba(X_s)[0]
    classes = list(model.classes_)
    proba_dict = {c: round(float(p) * 100, 1) for c, p in zip(classes, proba)}

    return {
        **_capacity_result(label),
        "details":   details,
        "proba":     proba_dict,
        "estimated": False,
    }


def _capacity_theory(hr_total: float) -> str:
    if hr_total > 10:
        return "SURCHARGE"
    elif hr_total > 7:
        return "TENDU"
    return "OK"


def _capacity_result(label: str) -> dict:
    mapping = {
        "OK":       {"color": "#4ade80", "icon": "✅", "label_fr": "Charge OK"},
        "TENDU":    {"color": "#fbbf24", "icon": "⚠️", "label_fr": "Journée tendue"},
        "SURCHARGE":{"color": "#f87171", "icon": "🔴", "label_fr": "Surcharge — risque élevé"},
    }
    r = mapping.get(label, mapping["TENDU"])
    return {"label": label, **r}


# ---------------------------------------------------------------------------
# Modèle 3 — Risque de retard
# ---------------------------------------------------------------------------

def predict_delay_risk(
    transporteur: str,
    creneau_start: int | None,
    nb_deliveries: int,
    pal_silo: float,
    colis_pick: float,
) -> dict:
    """
    Prédit la probabilité que ce camion soit en retard (0–100 %).
    """
    models = _get_models()
    bundle = models.get("delay_risk")

    hr_silo = pal_silo / CADENCE_SILO
    hr_pick = colis_pick / CADENCE_PICK

    if bundle is None:
        # Fallback : 20% par défaut
        return _delay_result(20.0, estimated=True)

    pipeline = bundle["pipeline"]
    carrier_map = bundle.get("carrier_retard_map", {})
    carrier_rate = carrier_map.get(transporteur.strip().upper(), 0.5)

    X = pd.DataFrame([{
        "transporteur":        transporteur.strip().upper(),
        "creneau_start":       creneau_start if creneau_start is not None else -1,
        "nb_deliveries":       nb_deliveries,
        "pal_silo":            pal_silo,
        "colis_pick":          colis_pick,
        "hr_silo_theorique":   hr_silo,
        "hr_pick_theorique":   hr_pick,
        "carrier_retard_rate": carrier_rate,
    }])

    proba = pipeline.predict_proba(X)[0]
    classes = list(pipeline.classes_)
    # Probabilité que was_late == 1
    if 1 in classes:
        idx = classes.index(1)
        pct = float(proba[idx]) * 100
    else:
        pct = 50.0

    return _delay_result(pct, estimated=False)


def _delay_result(pct: float, estimated: bool) -> dict:
    pct = round(pct, 1)
    if pct < 25:
        color, icon, label = "#4ade80", "✅", "Faible risque"
    elif pct < 55:
        color, icon, label = "#fbbf24", "⚠️", "Risque modéré"
    else:
        color, icon, label = "#f87171", "🔴", "Risque élevé"
    return {
        "pct":       pct,
        "label":     label,
        "color":     color,
        "icon":      icon,
        "estimated": estimated,
    }


# ---------------------------------------------------------------------------
# Analyse d'une journée complète (plusieurs camions)
# ---------------------------------------------------------------------------

def analyze_day(trucks_input: list[dict]) -> dict:
    """
    Reçoit une liste de camions prévus (dict avec transporteur, creneau_start,
    nb_deliveries, pal_silo, colis_pick) et retourne :
      - capacité globale de la journée
      - durée prédite + risque retard par camion
    """
    if not trucks_input:
        return {}

    # Agrégats journée
    total_pal  = sum(t.get("pal_silo", 0)   for t in trucks_input)
    total_pick = sum(t.get("colis_pick", 0) for t in trucks_input)
    total_del  = sum(t.get("nb_deliveries", 0) for t in trucks_input)

    capacity = predict_capacity(
        nb_trucks=len(trucks_input),
        nb_deliveries=total_del,
        pal_silo_total=total_pal,
        colis_pick_total=total_pick,
    )

    # Prédictions par camion
    per_truck = []
    for t in trucks_input:
        lt = predict_load_time(
            transporteur=t.get("transporteur", "?"),
            creneau_start=t.get("creneau_start"),
            nb_deliveries=t.get("nb_deliveries", 1),
            pal_silo=t.get("pal_silo", 0),
            colis_pick=t.get("colis_pick", 0),
        )
        dr = predict_delay_risk(
            transporteur=t.get("transporteur", "?"),
            creneau_start=t.get("creneau_start"),
            nb_deliveries=t.get("nb_deliveries", 1),
            pal_silo=t.get("pal_silo", 0),
            colis_pick=t.get("colis_pick", 0),
        )
        per_truck.append({**t, "load_time": lt, "delay_risk": dr})

    return {"capacity": capacity, "trucks": per_truck}
