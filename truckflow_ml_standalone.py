"""
TruckFlow ML Companion — Version standalone (fichier unique)
============================================================
Lancement :
  1. pip install streamlit pandas scikit-learn plotly joblib xgboost
  2. streamlit run truckflow_ml_standalone.py
"""

import json
import re
import sys
from datetime import datetime
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.metrics import accuracy_score, mean_absolute_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

# ── Dossiers ────────────────────────────────────────────────────────────────
ROOT       = Path(__file__).parent
DATA_DIR   = ROOT / "tf_sessions"
MODELS_DIR = ROOT / "tf_models"
DATA_DIR.mkdir(exist_ok=True)
MODELS_DIR.mkdir(exist_ok=True)

CADENCE_SILO = 18
CADENCE_PICK = 600
MIN_SAMPLES  = 10

# ============================================================================
# EXTRACTION
# ============================================================================

def _parse_creneau(creneau):
    if not creneau or creneau.lower() in ("libre", "manuel", ""):
        return None, None
    m = re.match(r"(\d{1,2})\s*[-/h]\s*(\d{1,2})", str(creneau))
    if m:
        return int(m.group(1)), int(m.group(2))
    m = re.match(r"(\d{1,2})h?$", str(creneau))
    if m:
        h = int(m.group(1))
        return h, h + 1
    return None, None

def _delta_min(a, b):
    if not a or not b:
        return None
    try:
        da = datetime.fromisoformat(a.replace("Z", "+00:00"))
        db = datetime.fromisoformat(b.replace("Z", "+00:00"))
        diff = (db - da).total_seconds() / 60
        return round(diff, 1) if diff >= 0 else None
    except Exception:
        return None

def extract_trucks(sessions):
    rows = []
    for session in sessions:
        for t in session.get("completed", []):
            ts = t.get("timestamps", {})
            if not ts.get("arr") or not ts.get("dep"):
                continue
            details   = t.get("deliveryDetails", [])
            pal_silo  = sum(d.get("palSilo", 0) or 0 for d in details)
            colis_pick= sum(d.get("colisPick", 0) or 0 for d in details)
            colis_silo= sum(d.get("colisSilo", 0) or 0 for d in details)
            cr_s, cr_e= _parse_creneau(t.get("creneau", ""))
            total_min = _delta_min(ts.get("arr"), ts.get("dep"))
            load_min  = _delta_min(ts.get("chg"), ts.get("fin_chg") or ts.get("dep"))
            wait_min  = _delta_min(ts.get("arr"), ts.get("quai"))
            ponct     = (t.get("ponctualite") or {}).get("status", "inconnu")
            was_late  = 1 if "retard" in ponct else 0
            rows.append({
                "date": t.get("date",""),
                "transporteur": (t.get("transporteur","") or "?").strip().upper(),
                "creneau": t.get("creneau",""),
                "creneau_start": cr_s,
                "nb_deliveries": len(t.get("deliveries",[])),
                "pal_silo": pal_silo,
                "colis_silo": colis_silo,
                "colis_pick": colis_pick,
                "hr_silo_theorique": round(pal_silo / CADENCE_SILO, 3),
                "hr_pick_theorique": round(colis_pick / CADENCE_PICK, 3),
                "wait_min": wait_min,
                "load_min": load_min,
                "total_min": total_min,
                "was_late": was_late,
                "ponct_status": ponct,
            })
    if not rows:
        return pd.DataFrame()
    df = pd.DataFrame(rows)
    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    df = df[df["total_min"].between(1, 600)].copy()
    return df.reset_index(drop=True)

def extract_daily(sessions):
    df = extract_trucks(sessions)
    if df.empty:
        return pd.DataFrame()
    daily = df.groupby("date").agg(
        nb_trucks=("transporteur","count"),
        nb_deliveries=("nb_deliveries","sum"),
        pal_silo_total=("pal_silo","sum"),
        colis_pick_total=("colis_pick","sum"),
        nb_late=("was_late","sum"),
        avg_total_min=("total_min","mean"),
    ).reset_index()
    daily["hr_silo_needed"]  = (daily["pal_silo_total"]   / CADENCE_SILO).round(3)
    daily["hr_pick_needed"]  = (daily["colis_pick_total"] / CADENCE_PICK).round(3)
    daily["pct_retard"]      = (daily["nb_late"] / daily["nb_trucks"] * 100).round(1)
    def stress(row):
        hr = row["hr_silo_needed"] + row["hr_pick_needed"]
        if row["pct_retard"] >= 30 or hr > 10: return "SURCHARGE"
        if row["pct_retard"] >= 15 or hr > 7:  return "TENDU"
        return "OK"
    daily["stress_label"] = daily.apply(stress, axis=1)
    return daily

def extract_carrier_stats(sessions):
    df = extract_trucks(sessions)
    if df.empty:
        return pd.DataFrame()
    return df.groupby("transporteur").agg(
        nb_passages=("transporteur","count"),
        pct_retard=("was_late","mean"),
        avg_total_min=("total_min","mean"),
        avg_load_min=("load_min","mean"),
    ).reset_index().assign(pct_retard=lambda x: (x.pct_retard*100).round(1))

def load_sessions():
    sessions = []
    for f in sorted(DATA_DIR.glob("*.json")):
        try:
            sessions.append(json.loads(f.read_text(encoding="utf-8")))
        except Exception:
            pass
    return sessions

# ============================================================================
# ENTRAÎNEMENT
# ============================================================================

def _truck_features(df):
    feat = df[["transporteur","creneau_start","nb_deliveries",
               "pal_silo","colis_pick","hr_silo_theorique","hr_pick_theorique"]].copy()
    feat["creneau_start"] = feat["creneau_start"].fillna(-1).astype(int)
    return feat

def _pipeline(estimator):
    pre = ColumnTransformer([
        ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), ["transporteur"]),
        ("num", StandardScaler(), ["creneau_start","nb_deliveries","pal_silo",
                                   "colis_pick","hr_silo_theorique","hr_pick_theorique"]),
    ])
    return Pipeline([("prep", pre), ("model", estimator)])

def train_all(sessions):
    truck_df = extract_trucks(sessions)
    daily_df = extract_daily(sessions)
    results  = {"n_trucks": len(truck_df), "n_days": len(daily_df)}

    # Modèle 1 — durée chargement
    df1 = truck_df.dropna(subset=["total_min","pal_silo","colis_pick"])
    if len(df1) >= MIN_SAMPLES:
        X, y = _truck_features(df1), df1["total_min"]
        Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.2, random_state=42)
        m1 = _pipeline(RandomForestRegressor(n_estimators=150,max_depth=8,random_state=42,n_jobs=-1))
        m1.fit(Xtr, ytr)
        yp = m1.predict(Xte)
        joblib.dump(m1, MODELS_DIR/"load_time.pkl")
        results["load_time"] = {"mae_min": round(mean_absolute_error(yte,yp),1),
                                "r2": round(r2_score(yte,yp),3),
                                "n_train": len(Xtr)}
    else:
        results["load_time"] = {"error": f"Pas assez de données ({len(df1)} camions)"}

    # Modèle 2 — capacité journalière
    df2 = daily_df.dropna(subset=["stress_label"]) if not daily_df.empty else pd.DataFrame()
    if len(df2) >= 5:
        feats = ["nb_trucks","nb_deliveries","pal_silo_total","colis_pick_total",
                 "hr_silo_needed","hr_pick_needed"]
        X2, y2 = df2[feats], df2["stress_label"]
        sc = StandardScaler()
        X2s = sc.fit_transform(X2)
        m2 = RandomForestClassifier(n_estimators=200,max_depth=6,random_state=42,
                                    class_weight="balanced",n_jobs=-1)
        m2.fit(X2s, y2)
        yp2 = m2.predict(X2s)
        joblib.dump({"scaler":sc,"model":m2,"features":feats}, MODELS_DIR/"capacity.pkl")
        results["capacity"] = {"accuracy": round(accuracy_score(y2,yp2)*100,1),
                               "n_train": len(X2)}
    else:
        results["capacity"] = {"error": f"Pas assez de journées ({len(df2)})"}

    # Modèle 3 — risque retard
    df3 = truck_df.dropna(subset=["was_late","pal_silo","colis_pick"])
    if len(df3) >= MIN_SAMPLES and df3["was_late"].nunique() >= 2:
        cr_map = df3.groupby("transporteur")["was_late"].mean().to_dict()
        df3 = df3.copy()
        df3["carrier_retard_rate"] = df3["transporteur"].map(cr_map).fillna(0.5)
        X3b = _truck_features(df3)
        X3b["carrier_retard_rate"] = df3["carrier_retard_rate"].values
        y3  = df3["was_late"]
        X3tr,X3te,y3tr,y3te = train_test_split(X3b,y3,test_size=0.2,
                                                random_state=42,stratify=y3)
        m3 = _pipeline(RandomForestClassifier(n_estimators=200,max_depth=6,
                                              random_state=42,class_weight="balanced",n_jobs=-1))
        m3.fit(X3tr, y3tr)
        yp3 = m3.predict(X3te)
        joblib.dump({"pipeline":m3,"carrier_retard_map":cr_map}, MODELS_DIR/"delay_risk.pkl")
        results["delay_risk"] = {"accuracy": round(accuracy_score(y3te,yp3)*100,1),
                                 "pct_retard": round(y3.mean()*100,1),
                                 "n_train": len(X3tr)}
    else:
        results["delay_risk"] = {"error": "Pas assez de données ou tous identiques"}

    return results

def load_models():
    def ld(name):
        p = MODELS_DIR / f"{name}.pkl"
        return joblib.load(p) if p.exists() else None
    return {"load_time": ld("load_time"), "capacity": ld("capacity"), "delay_risk": ld("delay_risk")}

# ============================================================================
# PRÉDICTIONS
# ============================================================================

def _pill(text, color):
    return f'<span style="display:inline-block;padding:3px 12px;border-radius:20px;font-size:13px;font-weight:700;background:{color}22;color:{color};border:1px solid {color}55">{text}</span>'

def pred_load_time(models, transporteur, creneau_start, nb_del, pal_silo, colis_pick):
    hr_silo = pal_silo / CADENCE_SILO
    hr_pick = colis_pick / CADENCE_PICK
    m = models.get("load_time")
    if m is None:
        minutes = (hr_silo + hr_pick) * 60 + 15
        estimated = True
    else:
        X = pd.DataFrame([{"transporteur": transporteur.strip().upper(),
                            "creneau_start": creneau_start if creneau_start else -1,
                            "nb_deliveries": nb_del, "pal_silo": pal_silo,
                            "colis_pick": colis_pick,
                            "hr_silo_theorique": hr_silo, "hr_pick_theorique": hr_pick}])
        minutes = float(m.predict(X)[0])
        estimated = False
    minutes = max(5, round(minutes))
    if minutes <= 75:   color, icon, lbl = "#4ade80", "✅", "Normal"
    elif minutes <= 100: color, icon, lbl = "#fbbf24", "⚠️", "Chargement long"
    else:               color, icon, lbl = "#f87171", "🔴", "Très long"
    return {"minutes": minutes, "color": color, "icon": icon, "label": lbl, "estimated": estimated}

def pred_capacity(models, nb_trucks, nb_del, pal_silo, colis_pick):
    hr_silo  = round(pal_silo / CADENCE_SILO, 2)
    hr_pick  = round(colis_pick / CADENCE_PICK, 2)
    hr_total = hr_silo + hr_pick
    details  = {"hr_silo": hr_silo, "hr_pick": hr_pick, "hr_total": round(hr_total,2),
                "pal_silo": int(pal_silo), "colis_pick": int(colis_pick)}
    bundle = models.get("capacity")
    if bundle is None:
        if hr_total > 10:   label = "SURCHARGE"
        elif hr_total > 7:  label = "TENDU"
        else:               label = "OK"
        estimated = True
        proba = None
    else:
        feats = ["nb_trucks","nb_deliveries","pal_silo_total","colis_pick_total",
                 "hr_silo_needed","hr_pick_needed"]
        X = pd.DataFrame([{"nb_trucks":nb_trucks,"nb_deliveries":nb_del,
                            "pal_silo_total":pal_silo,"colis_pick_total":colis_pick,
                            "hr_silo_needed":hr_silo,"hr_pick_needed":hr_pick}])
        Xs = bundle["scaler"].transform(X)
        label = bundle["model"].predict(Xs)[0]
        p = bundle["model"].predict_proba(Xs)[0]
        proba = {c: round(float(v)*100,1) for c,v in zip(bundle["model"].classes_,p)}
        estimated = False
    colors = {"OK":"#4ade80","TENDU":"#fbbf24","SURCHARGE":"#f87171"}
    icons  = {"OK":"✅","TENDU":"⚠️","SURCHARGE":"🔴"}
    labels = {"OK":"Charge OK","TENDU":"Journée tendue","SURCHARGE":"Surcharge — risque élevé"}
    color  = colors.get(label,"#fbbf24")
    return {"label":label,"label_fr":labels.get(label,label),"color":color,
            "icon":icons.get(label,"⚠️"),"details":details,"proba":proba,"estimated":estimated}

def pred_delay(models, transporteur, creneau_start, nb_del, pal_silo, colis_pick):
    bundle = models.get("delay_risk")
    if bundle is None:
        pct, estimated = 20.0, True
    else:
        cr_map = bundle.get("carrier_retard_map", {})
        cr_rate = cr_map.get(transporteur.strip().upper(), 0.5)
        hr_silo = pal_silo / CADENCE_SILO
        hr_pick = colis_pick / CADENCE_PICK
        X = pd.DataFrame([{"transporteur": transporteur.strip().upper(),
                            "creneau_start": creneau_start if creneau_start else -1,
                            "nb_deliveries": nb_del, "pal_silo": pal_silo,
                            "colis_pick": colis_pick, "hr_silo_theorique": hr_silo,
                            "hr_pick_theorique": hr_pick, "carrier_retard_rate": cr_rate}])
        pipe = bundle["pipeline"]
        p    = pipe.predict_proba(X)[0]
        classes = list(pipe.classes_)
        pct  = float(p[classes.index(1)]) * 100 if 1 in classes else 50.0
        estimated = False
    pct = round(pct, 1)
    if pct < 25:   color, icon, lbl = "#4ade80", "✅", "Faible risque"
    elif pct < 55: color, icon, lbl = "#fbbf24", "⚠️", "Risque modéré"
    else:          color, icon, lbl = "#f87171", "🔴", "Risque élevé"
    return {"pct": pct, "color": color, "icon": icon, "label": lbl, "estimated": estimated}

# ============================================================================
# INTERFACE STREAMLIT
# ============================================================================

st.set_page_config(page_title="TruckFlow ML", page_icon="🚛",
                   layout="wide", initial_sidebar_state="collapsed")

st.markdown("""
<style>
  .stApp{background:#0d1117;color:#f0f6fc}
  .mcard{background:rgba(255,255,255,.05);border:1px solid rgba(160,210,255,.18);
         border-radius:14px;padding:16px 20px;text-align:center}
  .mcard .val{font-size:32px;font-weight:900}
  .mcard .lbl{font-size:11px;color:#8b949e;text-transform:uppercase;letter-spacing:.8px;margin-top:4px}
  .pbox{background:rgba(255,255,255,.04);border:1px solid rgba(160,210,255,.15);
        border-radius:14px;padding:20px;margin-bottom:10px}
  hr{border-color:rgba(160,210,255,.12)!important}
</style>""", unsafe_allow_html=True)

# Session state
if "sessions" not in st.session_state:
    st.session_state.sessions = load_sessions()
if "train_results" not in st.session_state:
    st.session_state.train_results = None
if "camions" not in st.session_state:
    st.session_state.camions = []

tab1, tab2, tab3, tab4 = st.tabs(["📊 Dashboard","📥 Import & Entraînement","🔮 Prédictions","📈 Historique"])

# ── TAB 1 DASHBOARD ──────────────────────────────────────────────────────────
with tab1:
    st.markdown("## 🚛 TruckFlow ML Companion")
    st.caption("Apprentissage automatique à partir de l'activité du hub")

    truck_df = extract_trucks(st.session_state.sessions)
    daily_df = extract_daily(st.session_state.sessions)
    models   = load_models()
    n_models = sum(1 for v in models.values() if v is not None)

    c1,c2,c3,c4 = st.columns(4)
    for col, val, lbl in [
        (c1, len(truck_df), "Camions analysés"),
        (c2, len(daily_df), "Journées en mémoire"),
        (c3, f"{n_models}/3", "Modèles entraînés"),
        (c4, f"{round(truck_df['was_late'].mean()*100,1)}%" if not truck_df.empty else "—", "Taux de retard"),
    ]:
        with col:
            st.markdown(f'<div class="mcard"><div class="val">{val}</div><div class="lbl">{lbl}</div></div>',
                        unsafe_allow_html=True)

    st.markdown("---")
    st.markdown("### État des modèles")
    mc1,mc2,mc3 = st.columns(3)
    for col,(key,title,desc) in zip([mc1,mc2,mc3],[
        ("load_time","⏱ Durée chargement","Prédit la durée totale arr→dep"),
        ("capacity","📦 Capacité journalière","OK / TENDU / SURCHARGE"),
        ("delay_risk","🔴 Risque de retard","Probabilité de retard par camion"),
    ]):
        with col:
            ok = models[key] is not None
            st.markdown(f'<div class="pbox"><b>{title}</b><br><small style="color:#8b949e">{desc}</small><br>'
                        +_pill("✅ Entraîné" if ok else "⏳ Non entraîné","#4ade80" if ok else "#8b949e")
                        +'</div>', unsafe_allow_html=True)

    if n_models == 0:
        st.info("💡 Va dans **📥 Import** pour charger un export TruckFlow JSON et entraîner les modèles.")

    if st.session_state.train_results:
        st.markdown("---")
        st.markdown("### Résultats du dernier entraînement")
        r = st.session_state.train_results
        rc1,rc2,rc3 = st.columns(3)
        with rc1:
            v = r.get("load_time",{})
            if "error" not in v: st.metric("⏱ Erreur moyenne",f"{v.get('mae_min','?')} min"); st.metric("R²",v.get("r2","?"))
            else: st.warning(v["error"])
        with rc2:
            v = r.get("capacity",{})
            if "error" not in v: st.metric("📦 Précision capacité",f"{v.get('accuracy','?')}%")
            else: st.warning(v["error"])
        with rc3:
            v = r.get("delay_risk",{})
            if "error" not in v: st.metric("🔴 Précision retard",f"{v.get('accuracy','?')}%")
            else: st.warning(v["error"])

# ── TAB 2 IMPORT ─────────────────────────────────────────────────────────────
with tab2:
    st.markdown("## 📥 Import des données TruckFlow")
    st.markdown("""
**Comment faire :**
1. Dans TruckFlow → bouton **Partager** → **Exporter session JSON**
2. Déposer le fichier `.json` ici
3. Cliquer **Entraîner les modèles**
4. Répéter chaque soir pour que le ML s'améliore
""")
    uploaded = st.file_uploader("Déposer export session TruckFlow (JSON)",
                                type=["json"], accept_multiple_files=True)
    if uploaded:
        for f in uploaded:
            try:
                data = json.loads(f.read().decode("utf-8"))
                (DATA_DIR / f.name).write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
            except Exception:
                st.error(f"Erreur lecture {f.name}")
        st.success(f"✅ {len(uploaded)} fichier(s) importé(s)")
        st.session_state.sessions = load_sessions()

    truck_df = extract_trucks(st.session_state.sessions)
    daily_df = extract_daily(st.session_state.sessions)
    st.info(f"**Données disponibles :** {len(truck_df)} camions terminés · {len(daily_df)} journées")

    if not truck_df.empty:
        st.markdown("#### Aperçu")
        cols = [c for c in ["date","transporteur","creneau","nb_deliveries",
                             "pal_silo","colis_pick","total_min","ponct_status"]
                if c in truck_df.columns]
        st.dataframe(truck_df[cols].sort_values("date",ascending=False).head(20),
                     use_container_width=True, hide_index=True)

    st.markdown("---")
    if len(truck_df) < 5:
        st.warning(f"⚠️ Seulement {len(truck_df)} camions. Importer plus de sessions pour de meilleures prédictions.")

    if st.button("🚀 Entraîner les modèles", type="primary", disabled=len(truck_df)<3):
        with st.spinner("Entraînement en cours..."):
            results = train_all(st.session_state.sessions)
            st.session_state.train_results = results
        st.success("✅ Modèles entraînés !")
        st.json(results)

# ── TAB 3 PRÉDICTIONS ─────────────────────────────────────────────────────────
with tab3:
    st.markdown("## 🔮 Prédictions pour une journée")
    models = load_models()

    st.markdown("### 📦 Capacité globale")
    pc1,pc2,pc3,pc4 = st.columns(4)
    with pc1: nb_t = st.number_input("Camions prévus",1,50,10)
    with pc2: nb_d = st.number_input("Livraisons total",1,200,30)
    with pc3: pal  = st.number_input("Palettes silo",0,500,60)
    with pc4: pick = st.number_input("Colis picking",0,50000,1200)

    if st.button("Analyser la capacité", type="primary"):
        cap = pred_capacity(models, nb_t, nb_d, pal, pick)
        col_r, col_d = st.columns([1,2])
        with col_r:
            st.markdown(f'<div class="pbox" style="border-color:{cap["color"]}55;text-align:center">'
                        f'<div style="font-size:48px">{cap["icon"]}</div>'
                        f'<div style="font-size:22px;font-weight:900;color:{cap["color"]}">{cap["label_fr"]}</div>'
                        +(_pill("Estimation théorique","#8b949e") if cap["estimated"] else "")
                        +'</div>', unsafe_allow_html=True)
        with col_d:
            d = cap["details"]
            st.markdown(f'<div class="pbox">'
                        f'<b>Détail des heures</b><br><br>'
                        f'⏱ Silo : <b>{d["hr_silo"]}h</b> ({d["pal_silo"]} pal ÷ 18 pal/h)<br>'
                        f'⏱ Picking : <b>{d["hr_pick"]}h</b> ({d["colis_pick"]} colis ÷ 600 col/h)<br><br>'
                        f'<span style="font-size:18px;font-weight:900">Total estimé : {d["hr_total"]}h</span>'
                        f'</div>', unsafe_allow_html=True)
            if cap.get("proba"):
                fig = go.Figure(go.Bar(
                    x=list(cap["proba"].keys()), y=list(cap["proba"].values()),
                    marker_color=["#4ade80","#fbbf24","#f87171"][:len(cap["proba"])]))
                fig.update_layout(template="plotly_dark",height=200,
                                  margin=dict(t=10,b=10,l=10,r=10),
                                  yaxis_title="Probabilité (%)")
                st.plotly_chart(fig, use_container_width=True)

    st.markdown("---")
    st.markdown("### 🚛 Prédiction par camion")

    truck_df2 = extract_trucks(st.session_state.sessions)
    known = sorted(truck_df2["transporteur"].unique()) if not truck_df2.empty else ["BERNARD"]
    options = known + (["Autre..."] if known else [])

    with st.expander("➕ Ajouter un camion", expanded=True):
        a1,a2,a3,a4,a5 = st.columns(5)
        with a1:
            tr = st.selectbox("Transporteur", options)
            if tr == "Autre...": tr = st.text_input("Nom")
        with a2: cr_h = st.number_input("Créneau (heure)", 5, 22, 10)
        with a3: n_d  = st.number_input("Nb livraisons", 1, 30, 3)
        with a4: p_s  = st.number_input("Pal silo", 0, 100, 5)
        with a5: c_p  = st.number_input("Colis picking", 0, 5000, 100)
        if st.button("Ajouter"):
            st.session_state.camions.append(
                {"transporteur":tr,"creneau_start":cr_h,"nb_deliveries":n_d,
                 "pal_silo":p_s,"colis_pick":c_p})
            st.rerun()

    if st.session_state.camions:
        if st.button("🗑 Vider la liste"):
            st.session_state.camions = []
            st.rerun()
        for t in st.session_state.camions:
            lt = pred_load_time(models,t["transporteur"],t["creneau_start"],
                                t["nb_deliveries"],t["pal_silo"],t["colis_pick"])
            dr = pred_delay(models,t["transporteur"],t["creneau_start"],
                            t["nb_deliveries"],t["pal_silo"],t["colis_pick"])
            cren = f"{t['creneau_start']}h-{t['creneau_start']+2}h"
            st.markdown(f'<div class="pbox" style="border-color:{lt["color"]}44">'
                f'<div style="display:flex;gap:20px;flex-wrap:wrap;align-items:center">'
                f'<div style="flex:1"><b style="font-size:16px">{t["transporteur"]}</b><br>'
                f'<span style="color:#8b949e;font-size:12px">Créneau {cren} · {t["nb_deliveries"]} livraisons · {t["pal_silo"]} pal · {t["colis_pick"]} colis</span></div>'
                f'<div style="text-align:center;min-width:110px">'
                f'<div style="font-size:10px;color:#8b949e;text-transform:uppercase">Durée prédite</div>'
                f'<div style="font-size:28px;font-weight:900;color:{lt["color"]}">{lt["minutes"]} min</div>'
                +_pill(lt["icon"]+" "+lt["label"],lt["color"])+'</div>'
                f'<div style="text-align:center;min-width:110px">'
                f'<div style="font-size:10px;color:#8b949e;text-transform:uppercase">Risque retard</div>'
                f'<div style="font-size:28px;font-weight:900;color:{dr["color"]}">{dr["pct"]}%</div>'
                +_pill(dr["icon"]+" "+dr["label"],dr["color"])+'</div>'
                '</div></div>', unsafe_allow_html=True)

# ── TAB 4 HISTORIQUE ──────────────────────────────────────────────────────────
with tab4:
    st.markdown("## 📈 Historique & Tendances")
    truck_df = extract_trucks(st.session_state.sessions)
    daily_df = extract_daily(st.session_state.sessions)

    if truck_df.empty:
        st.info("Importe des exports TruckFlow dans **📥 Import** pour voir les graphiques.")
    else:
        if not daily_df.empty:
            st.markdown("### Ponctualité & volumes par jour")
            fig = px.bar(daily_df.sort_values("date"),x="date",y="nb_trucks",
                         template="plotly_dark",labels={"nb_trucks":"Camions","date":"Date"},
                         color_discrete_sequence=["#0a84ff"],height=280)
            pct_col = daily_df.sort_values("date")
            fig.add_scatter(x=pct_col["date"],y=100-pct_col["pct_retard"],
                            name="% À l'heure",yaxis="y2",mode="lines+markers",
                            line=dict(color="#4ade80",width=2))
            fig.update_layout(yaxis2=dict(overlaying="y",side="right",range=[0,105],
                                          showgrid=False),margin=dict(t=10,b=20))
            st.plotly_chart(fig, use_container_width=True)

        st.markdown("### Durée moyenne par transporteur")
        cs = extract_carrier_stats(st.session_state.sessions)
        if not cs.empty:
            fig2 = px.bar(cs.sort_values("avg_total_min"),x="avg_total_min",y="transporteur",
                          orientation="h",color="pct_retard",template="plotly_dark",
                          color_continuous_scale=["#4ade80","#fbbf24","#f87171"],
                          range_color=[0,50],text="nb_passages",
                          labels={"avg_total_min":"Durée moy. (min)","pct_retard":"% retard"},
                          height=max(250,len(cs)*35))
            fig2.update_traces(texttemplate="%{text} passages",textposition="outside")
            fig2.update_layout(margin=dict(t=10,b=20))
            st.plotly_chart(fig2, use_container_width=True)
            st.dataframe(cs, use_container_width=True, hide_index=True)
