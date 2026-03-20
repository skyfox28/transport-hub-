"""
trainer.py — Entraîne les 3 modèles ML et les sauvegarde en .pkl.

Modèles :
  1. load_time   : RandomForest Regressor  → prédit total_min par camion
  2. capacity    : RandomForest Classifier → prédit OK / TENDU / SURCHARGE par journée
  3. delay_risk  : RandomForest Classifier → prédit was_late (1/0) par camion

Chaque modèle est une sklearn Pipeline (encodage + modèle).
"""

import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.metrics import (
    accuracy_score, mean_absolute_error, r2_score, classification_report
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import LabelEncoder, OneHotEncoder, StandardScaler

from ml.extractor import extract_trucks, extract_daily

MODELS_DIR = Path(__file__).parent.parent / "models"
MODELS_DIR.mkdir(exist_ok=True)

MIN_SAMPLES_REGRESSION   = 10   # min lignes pour entraîner le modèle 1 & 3
MIN_SAMPLES_DAILY        = 5    # min journées pour entraîner le modèle 2


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _save(model, name: str):
    path = MODELS_DIR / f"{name}.pkl"
    joblib.dump(model, path)
    return path


def _load(name: str):
    path = MODELS_DIR / f"{name}.pkl"
    if path.exists():
        return joblib.load(path)
    return None


def _build_truck_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Prépare les features par camion pour les modèles 1 et 3.
    Features : transporteur (cat), creneau_start, nb_deliveries,
               pal_silo, colis_pick, hr_silo_theorique, hr_pick_theorique
    """
    feat = df[["transporteur", "creneau_start", "nb_deliveries",
               "pal_silo", "colis_pick",
               "hr_silo_theorique", "hr_pick_theorique"]].copy()
    feat["creneau_start"] = feat["creneau_start"].fillna(-1).astype(int)
    return feat


def _make_truck_pipeline(estimator) -> Pipeline:
    preprocessor = ColumnTransformer([
        ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False),
         ["transporteur"]),
        ("num", StandardScaler(),
         ["creneau_start", "nb_deliveries", "pal_silo",
          "colis_pick", "hr_silo_theorique", "hr_pick_theorique"]),
    ])
    return Pipeline([("prep", preprocessor), ("model", estimator)])


# ---------------------------------------------------------------------------
# Modèle 1 — Durée de chargement (régression)
# ---------------------------------------------------------------------------

def train_load_time(truck_df: pd.DataFrame) -> dict:
    """
    Entraîne le modèle de prédiction de durée totale (arr→dep).
    Retourne les métriques d'évaluation.
    """
    df = truck_df.dropna(subset=["total_min", "pal_silo", "colis_pick"]).copy()
    if len(df) < MIN_SAMPLES_REGRESSION:
        return {"error": f"Pas assez de données ({len(df)} < {MIN_SAMPLES_REGRESSION})"}

    X = _build_truck_features(df)
    y = df["total_min"]

    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, random_state=42)

    model = _make_truck_pipeline(
        RandomForestRegressor(n_estimators=150, max_depth=8, random_state=42, n_jobs=-1)
    )
    model.fit(X_tr, y_tr)

    y_pred = model.predict(X_te)
    metrics = {
        "mae_min":  round(mean_absolute_error(y_te, y_pred), 1),
        "r2":       round(r2_score(y_te, y_pred), 3),
        "n_train":  len(X_tr),
        "n_test":   len(X_te),
    }

    _save(model, "load_time")
    return metrics


# ---------------------------------------------------------------------------
# Modèle 2 — Capacité journalière (classification)
# ---------------------------------------------------------------------------

def train_capacity(daily_df: pd.DataFrame) -> dict:
    """
    Entraîne le modèle de stress journalier : OK / TENDU / SURCHARGE.
    """
    df = daily_df.dropna(subset=["stress_label"]).copy()
    if len(df) < MIN_SAMPLES_DAILY:
        return {"error": f"Pas assez de journées ({len(df)} < {MIN_SAMPLES_DAILY})"}

    features = ["nb_trucks", "nb_deliveries", "pal_silo_total",
                "colis_pick_total", "hr_silo_needed", "hr_pick_needed"]
    X = df[features]
    y = df["stress_label"]

    # Garder au moins 1 exemple de chaque classe dans train si possible
    if len(df) >= 10:
        X_tr, X_te, y_tr, y_te = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y if y.nunique() > 1 else None
        )
    else:
        X_tr, X_te, y_tr, y_te = X, X, y, y

    scaler = StandardScaler()
    X_tr_s = scaler.fit_transform(X_tr)
    X_te_s = scaler.transform(X_te)

    model = RandomForestClassifier(
        n_estimators=200, max_depth=6, random_state=42, class_weight="balanced", n_jobs=-1
    )
    model.fit(X_tr_s, y_tr)

    y_pred = model.predict(X_te_s)
    acc = accuracy_score(y_te, y_pred)

    # Sauvegarder scaler + modèle ensemble
    bundle = {"scaler": scaler, "model": model, "features": features}
    _save(bundle, "capacity")

    return {
        "accuracy": round(acc * 100, 1),
        "n_train":  len(X_tr),
        "n_test":   len(X_te),
        "classes":  list(model.classes_),
    }


# ---------------------------------------------------------------------------
# Modèle 3 — Risque de retard par camion (classification)
# ---------------------------------------------------------------------------

def train_delay_risk(truck_df: pd.DataFrame) -> dict:
    """
    Entraîne le modèle de prédiction de retard (was_late 0/1).
    """
    df = truck_df.dropna(subset=["was_late", "pal_silo", "colis_pick"]).copy()
    if len(df) < MIN_SAMPLES_REGRESSION:
        return {"error": f"Pas assez de données ({len(df)} < {MIN_SAMPLES_REGRESSION})"}

    # Enrichir avec le taux historique de retard par transporteur
    carrier_retard = df.groupby("transporteur")["was_late"].mean().to_dict()
    df["carrier_retard_rate"] = df["transporteur"].map(carrier_retard).fillna(0.5)

    X_base = _build_truck_features(df)
    X_base["carrier_retard_rate"] = df["carrier_retard_rate"].values
    y = df["was_late"]

    if y.nunique() < 2:
        return {"error": "Toutes les livraisons ont le même statut — impossible d'entraîner"}

    X_tr, X_te, y_tr, y_te = train_test_split(
        X_base, y, test_size=0.2, random_state=42, stratify=y
    )

    model = _make_truck_pipeline(
        RandomForestClassifier(
            n_estimators=200, max_depth=6, random_state=42,
            class_weight="balanced", n_jobs=-1
        )
    )
    model.fit(X_tr, y_tr)
    y_pred = model.predict(X_te)

    # Stocker aussi le taux de retard par transporteur pour enrichir les prédictions futures
    bundle = {"pipeline": model, "carrier_retard_map": carrier_retard}
    _save(bundle, "delay_risk")

    return {
        "accuracy":     round(accuracy_score(y_te, y_pred) * 100, 1),
        "n_train":      len(X_tr),
        "n_test":       len(X_te),
        "pct_retard":   round(y.mean() * 100, 1),
    }


# ---------------------------------------------------------------------------
# Point d'entrée : entraîner les 3 modèles d'un coup
# ---------------------------------------------------------------------------

def train_all(sessions: list[dict]) -> dict:
    """
    Lance l'entraînement des 3 modèles depuis une liste de sessions TruckFlow.
    Retourne un dict avec les métriques de chaque modèle.
    """
    truck_df = extract_trucks(sessions)
    daily_df = extract_daily(sessions)

    results = {}
    results["load_time"]   = train_load_time(truck_df)
    results["capacity"]    = train_capacity(daily_df)
    results["delay_risk"]  = train_delay_risk(truck_df)
    results["n_trucks"]    = len(truck_df)
    results["n_days"]      = len(daily_df)
    return results


# ---------------------------------------------------------------------------
# Chargement des modèles sauvegardés
# ---------------------------------------------------------------------------

def load_all_models() -> dict:
    return {
        "load_time":  _load("load_time"),
        "capacity":   _load("capacity"),
        "delay_risk": _load("delay_risk"),
    }
