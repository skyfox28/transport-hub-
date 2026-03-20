"""
extractor.py — Parse les exports JSON TruckFlow vers des DataFrames pandas.

Données sources :
  - session["completed"]   → camions terminés (timestamps + deliveryDetails)
  - session["deliveries"]  → volumes par livraison (palSilo, colisPick)
  - session["trucks"]      → camions actifs (pour journées en cours)
"""

import json
import re
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
import numpy as np

CADENCE_SILO = 18    # palettes/heure (identique à TruckFlow)
CADENCE_PICK = 600   # colis/heure


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _parse_creneau(creneau: str) -> tuple[int | None, int | None]:
    """
    Retourne (heure_debut, heure_fin) depuis un string créneau.
    Exemples : "14-16" → (14,16), "8h" → (8,9), "libre" → (None,None)
    """
    if not creneau or creneau.lower() in ("libre", "manuel", ""):
        return None, None
    # "14-16", "10-12", "8-10"
    m = re.match(r"(\d{1,2})\s*[-/h]\s*(\d{1,2})", creneau)
    if m:
        return int(m.group(1)), int(m.group(2))
    # "14h", "8h"
    m = re.match(r"(\d{1,2})h?$", creneau)
    if m:
        h = int(m.group(1))
        return h, h + 1
    return None, None


def _iso_to_dt(s: str | None) -> datetime | None:
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        return None


def _delta_min(a: str | None, b: str | None) -> float | None:
    """Minutes entre deux timestamps ISO (b - a)."""
    da, db = _iso_to_dt(a), _iso_to_dt(b)
    if da is None or db is None:
        return None
    diff = (db - da).total_seconds() / 60
    return round(diff, 1) if diff >= 0 else None


def _carrier_encode(name: str) -> str:
    return (name or "INCONNU").strip().upper()


# ---------------------------------------------------------------------------
# Extraction principale : camions terminés → DataFrame par camion
# ---------------------------------------------------------------------------

def extract_trucks(sessions: list[dict]) -> pd.DataFrame:
    """
    Extrait un DataFrame d'un camion terminé par ligne.

    Colonnes :
      date, transporteur, itin, creneau, creneau_start, creneau_end,
      quai, nb_deliveries,
      pal_silo, colis_silo, colis_pick, hr_silo_theorique, hr_pick_theorique,
      wait_min (arr→quai), prep_min (quai→chg), load_min (chg→dep ou fin_chg),
      total_min (arr→dep), was_late (1/0), ponct_status
    """
    rows = []
    for session in sessions:
        completed = session.get("completed", [])
        for t in completed:
            ts = t.get("timestamps", {})
            # Timestamps obligatoires : arr + dep
            if not ts.get("arr") or not ts.get("dep"):
                continue

            details = t.get("deliveryDetails", [])
            pal_silo   = sum(d.get("palSilo", 0) or 0 for d in details)
            colis_silo = sum(d.get("colisSilo", 0) or 0 for d in details)
            colis_pick = sum(d.get("colisPick", 0) or 0 for d in details)

            cr_start, cr_end = _parse_creneau(t.get("creneau", ""))

            # Durées
            wait_min  = _delta_min(ts.get("arr"),     ts.get("quai"))
            prep_min  = _delta_min(ts.get("quai"),    ts.get("chg"))
            load_min  = _delta_min(ts.get("chg"),     ts.get("fin_chg") or ts.get("dep"))
            total_min = _delta_min(ts.get("arr"),     ts.get("dep"))

            ponct = t.get("ponctualite", {}) or {}
            status = ponct.get("status", "inconnu")
            was_late = 1 if "retard" in status else 0

            rows.append({
                "date":               t.get("date", ""),
                "transporteur":       _carrier_encode(t.get("transporteur", "")),
                "itin":               t.get("itin", ""),
                "creneau":            t.get("creneau", ""),
                "creneau_start":      cr_start,
                "creneau_end":        cr_end,
                "quai":               t.get("quai"),
                "nb_deliveries":      len(t.get("deliveries", [])),
                "pal_silo":           pal_silo,
                "colis_silo":         colis_silo,
                "colis_pick":         colis_pick,
                "hr_silo_theorique":  round(pal_silo / CADENCE_SILO, 3),
                "hr_pick_theorique":  round(colis_pick / CADENCE_PICK, 3),
                "wait_min":           wait_min,
                "prep_min":           prep_min,
                "load_min":           load_min,
                "total_min":          total_min,
                "was_late":           was_late,
                "ponct_status":       status,
            })

    if not rows:
        return pd.DataFrame()

    df = pd.DataFrame(rows)
    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    # Filtrer les valeurs aberrantes (total < 0 ou > 600 min)
    df = df[df["total_min"].between(1, 600, inclusive="both")].copy()
    return df.reset_index(drop=True)


# ---------------------------------------------------------------------------
# Extraction journalière → DataFrame par journée
# ---------------------------------------------------------------------------

def extract_daily(sessions: list[dict]) -> pd.DataFrame:
    """
    Agrège les données au niveau journée pour le modèle de capacité.

    Colonnes :
      date, nb_trucks, nb_deliveries,
      pal_silo_total, colis_pick_total,
      hr_silo_needed, hr_pick_needed,
      pct_retard, avg_total_min, stress_label
    """
    truck_df = extract_trucks(sessions)
    if truck_df.empty:
        return pd.DataFrame()

    daily = (
        truck_df
        .groupby("date")
        .agg(
            nb_trucks        = ("transporteur", "count"),
            nb_deliveries    = ("nb_deliveries", "sum"),
            pal_silo_total   = ("pal_silo", "sum"),
            colis_pick_total = ("colis_pick", "sum"),
            nb_late          = ("was_late", "sum"),
            avg_total_min    = ("total_min", "mean"),
        )
        .reset_index()
    )

    daily["hr_silo_needed"]  = (daily["pal_silo_total"]   / CADENCE_SILO).round(3)
    daily["hr_pick_needed"]  = (daily["colis_pick_total"] / CADENCE_PICK).round(3)
    daily["pct_retard"]      = (daily["nb_late"] / daily["nb_trucks"] * 100).round(1)

    # Label de stress journalier (cible pour le modèle capacité)
    # Basé sur % camions en retard et heures de travail nécessaires
    def stress_label(row):
        hr_total = row["hr_silo_needed"] + row["hr_pick_needed"]
        if row["pct_retard"] >= 30 or hr_total > 10:
            return "SURCHARGE"
        elif row["pct_retard"] >= 15 or hr_total > 7:
            return "TENDU"
        else:
            return "OK"

    daily["stress_label"] = daily.apply(stress_label, axis=1)
    return daily


# ---------------------------------------------------------------------------
# Statistiques transporteurs
# ---------------------------------------------------------------------------

def extract_carrier_stats(sessions: list[dict]) -> pd.DataFrame:
    """
    Retourne les stats historiques par transporteur :
    ponctualité %, durée moyenne chargement, etc.
    Utilisé comme feature enrichie pour les prédictions.
    """
    df = extract_trucks(sessions)
    if df.empty:
        return pd.DataFrame()

    stats = (
        df.groupby("transporteur")
        .agg(
            nb_passages    = ("transporteur", "count"),
            pct_retard     = ("was_late", "mean"),
            avg_total_min  = ("total_min", "mean"),
            avg_load_min   = ("load_min", "mean"),
            avg_wait_min   = ("wait_min", "mean"),
        )
        .reset_index()
    )
    stats["pct_retard"] = (stats["pct_retard"] * 100).round(1)
    return stats


# ---------------------------------------------------------------------------
# Chargement de fichiers
# ---------------------------------------------------------------------------

def load_sessions_from_dir(directory: str | Path) -> list[dict]:
    """Charge tous les fichiers JSON dans le dossier data/sessions/."""
    sessions = []
    p = Path(directory)
    for f in sorted(p.glob("*.json")):
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
            if isinstance(data, dict):
                sessions.append(data)
        except Exception:
            pass
    return sessions


def load_session_from_bytes(content: bytes) -> dict | None:
    """Charge un JSON depuis des bytes (upload Streamlit)."""
    try:
        return json.loads(content.decode("utf-8"))
    except Exception:
        return None
