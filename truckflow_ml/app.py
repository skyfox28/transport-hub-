"""
TruckFlow ML Companion — Interface Streamlit
============================================
4 onglets :
  📊 Dashboard   — Vue globale, état des modèles
  📥 Import      — Charger les exports JSON TruckFlow, réentraîner
  🔮 Prédictions — Simuler une journée, prédire capacité + retards
  📈 Historique  — Graphiques sur les données accumulées

Lancement :
  streamlit run app.py
"""

import json
import sys
from pathlib import Path

import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st

# Ajout du dossier racine au path pour les imports relatifs
ROOT = Path(__file__).parent
sys.path.insert(0, str(ROOT))

from ml.extractor import (
    extract_trucks, extract_daily, extract_carrier_stats,
    load_sessions_from_dir, load_session_from_bytes,
)
from ml.trainer import train_all, load_all_models, MODELS_DIR
from ml.predictor import (
    predict_load_time, predict_capacity, predict_delay_risk,
    analyze_day, reload_models,
)

DATA_DIR = ROOT / "data" / "sessions"
DATA_DIR.mkdir(parents=True, exist_ok=True)

# ── Streamlit config ────────────────────────────────────────────────────────
st.set_page_config(
    page_title="TruckFlow ML",
    page_icon="🚛",
    layout="wide",
    initial_sidebar_state="collapsed",
)

# ── CSS minimal dark ─────────────────────────────────────────────────────────
st.markdown("""
<style>
  .stApp { background: #0d1117; color: #f0f6fc; }
  section[data-testid="stSidebar"] { background: #161b22; }
  .metric-card {
    background: rgba(255,255,255,.05);
    border: 1px solid rgba(160,210,255,.18);
    border-radius: 14px; padding: 16px 20px; text-align: center;
  }
  .metric-card .val { font-size: 32px; font-weight: 900; }
  .metric-card .lbl { font-size: 11px; color: #8b949e;
    text-transform: uppercase; letter-spacing: .8px; margin-top: 4px; }
  .pill {
    display: inline-block; padding: 4px 14px; border-radius: 20px;
    font-size: 13px; font-weight: 700; margin: 2px;
  }
  .pred-box {
    background: rgba(255,255,255,.04);
    border: 1px solid rgba(160,210,255,.15);
    border-radius: 14px; padding: 20px; margin-bottom: 10px;
  }
  .pred-box .big { font-size: 42px; font-weight: 900; }
  .pred-box .sub { font-size: 12px; color: #8b949e; margin-top: 4px; }
  hr { border-color: rgba(160,210,255,.12) !important; }
</style>
""", unsafe_allow_html=True)


# ── Session state ─────────────────────────────────────────────────────────────
if "sessions" not in st.session_state:
    st.session_state.sessions = load_sessions_from_dir(DATA_DIR)
if "truck_df" not in st.session_state:
    st.session_state.truck_df = extract_trucks(st.session_state.sessions)
if "daily_df" not in st.session_state:
    st.session_state.daily_df = extract_daily(st.session_state.sessions)
if "train_results" not in st.session_state:
    st.session_state.train_results = None


def refresh_data():
    st.session_state.sessions = load_sessions_from_dir(DATA_DIR)
    st.session_state.truck_df = extract_trucks(st.session_state.sessions)
    st.session_state.daily_df = extract_daily(st.session_state.sessions)


def color_pill(text: str, color: str) -> str:
    return f'<span class="pill" style="background:{color}22;color:{color};border:1px solid {color}55">{text}</span>'


# ── Navigation ────────────────────────────────────────────────────────────────
tab1, tab2, tab3, tab4 = st.tabs([
    "📊 Dashboard", "📥 Import & Entraînement",
    "🔮 Prédictions", "📈 Historique",
])


# =============================================================================
# TAB 1 — DASHBOARD
# =============================================================================
with tab1:
    st.markdown("## 🚛 TruckFlow ML Companion")
    st.caption("Apprentissage automatique à partir de l'activité du hub — données extraites de TruckFlow")

    truck_df = st.session_state.truck_df
    daily_df = st.session_state.daily_df
    models   = load_all_models()

    # KPIs globaux
    c1, c2, c3, c4 = st.columns(4)
    with c1:
        st.markdown(f"""<div class="metric-card">
            <div class="val">{len(truck_df)}</div>
            <div class="lbl">Camions analysés</div>
        </div>""", unsafe_allow_html=True)
    with c2:
        st.markdown(f"""<div class="metric-card">
            <div class="val">{len(daily_df)}</div>
            <div class="lbl">Journées en mémoire</div>
        </div>""", unsafe_allow_html=True)
    with c3:
        n_models = sum(1 for v in models.values() if v is not None)
        st.markdown(f"""<div class="metric-card">
            <div class="val">{n_models}/3</div>
            <div class="lbl">Modèles entraînés</div>
        </div>""", unsafe_allow_html=True)
    with c4:
        if not truck_df.empty and "was_late" in truck_df.columns:
            pct = round(truck_df["was_late"].mean() * 100, 1)
        else:
            pct = "—"
        st.markdown(f"""<div class="metric-card">
            <div class="val">{pct}{'%' if pct != '—' else ''}</div>
            <div class="lbl">Taux de retard historique</div>
        </div>""", unsafe_allow_html=True)

    st.markdown("---")

    # État des modèles
    st.markdown("### État des modèles ML")
    mc1, mc2, mc3 = st.columns(3)
    model_info = [
        ("load_time",  "⏱ Durée chargement",    "Régression — prédit la durée totale arr→dep"),
        ("capacity",   "📦 Capacité journalière", "Classification — OK / TENDU / SURCHARGE"),
        ("delay_risk", "🔴 Risque de retard",     "Classification — probabilité de retard"),
    ]
    for col, (key, title, desc) in zip([mc1, mc2, mc3], model_info):
        with col:
            status = "✅ Entraîné" if models[key] is not None else "⏳ Non entraîné"
            color  = "#4ade80" if models[key] is not None else "#8b949e"
            st.markdown(f"""<div class="pred-box">
                <div style="font-size:16px;font-weight:800">{title}</div>
                <div class="sub" style="margin-bottom:8px">{desc}</div>
                {color_pill(status, color)}
            </div>""", unsafe_allow_html=True)

    if n_models == 0:
        st.info("💡 Aucun modèle entraîné. Va dans **📥 Import & Entraînement** pour charger un export TruckFlow et lancer l'entraînement.")

    # Résultats du dernier entraînement
    if st.session_state.train_results:
        st.markdown("---")
        st.markdown("### Résultats du dernier entraînement")
        res = st.session_state.train_results
        rc1, rc2, rc3 = st.columns(3)
        with rc1:
            r = res.get("load_time", {})
            if "error" not in r:
                st.metric("⏱ MAE durée", f"{r.get('mae_min','?')} min")
                st.metric("R²", r.get("r2", "?"))
            else:
                st.warning(r["error"])
        with rc2:
            r = res.get("capacity", {})
            if "error" not in r:
                st.metric("📦 Précision capacité", f"{r.get('accuracy','?')} %")
            else:
                st.warning(r["error"])
        with rc3:
            r = res.get("delay_risk", {})
            if "error" not in r:
                st.metric("🔴 Précision retard", f"{r.get('accuracy','?')} %")
                st.metric("% retard dans dataset", f"{r.get('pct_retard','?')} %")
            else:
                st.warning(r["error"])


# =============================================================================
# TAB 2 — IMPORT & ENTRAÎNEMENT
# =============================================================================
with tab2:
    st.markdown("## 📥 Import des données TruckFlow")
    st.markdown("""
**Workflow :**
1. Dans TruckFlow → bouton **Partager / Exporter session** → télécharger le fichier `.json`
2. Déposer ce fichier ici ci-dessous
3. Cliquer **Entraîner les modèles**
4. Répéter chaque soir pour que les modèles apprennent au fur et à mesure
""")

    uploaded = st.file_uploader(
        "Déposer un export session TruckFlow (JSON)",
        type=["json"],
        accept_multiple_files=True,
        key="uploader",
    )

    if uploaded:
        new_count = 0
        for f in uploaded:
            session = load_session_from_bytes(f.read())
            if session:
                dest = DATA_DIR / f.name
                dest.write_text(json.dumps(session, ensure_ascii=False), encoding="utf-8")
                new_count += 1
        if new_count:
            st.success(f"✅ {new_count} fichier(s) sauvegardé(s) dans `data/sessions/`")
            refresh_data()

    # Stats sur les données chargées
    truck_df = st.session_state.truck_df
    daily_df = st.session_state.daily_df
    st.markdown("---")
    st.markdown(f"**Données disponibles :** {len(truck_df)} camions terminés · {len(daily_df)} journées")

    if not truck_df.empty:
        st.markdown("#### Aperçu des données extraites")
        cols_show = ["date", "transporteur", "creneau", "nb_deliveries",
                     "pal_silo", "colis_pick", "total_min", "ponct_status"]
        cols_show = [c for c in cols_show if c in truck_df.columns]
        st.dataframe(
            truck_df[cols_show].sort_values("date", ascending=False).head(20),
            use_container_width=True, hide_index=True,
        )

    st.markdown("---")
    st.markdown("### 🤖 Entraîner les modèles")

    if len(truck_df) < 10:
        st.warning(f"⚠️ Seulement {len(truck_df)} camions terminés dans les données. "
                   "Il en faut au moins 10 pour entraîner les modèles 1 et 3. "
                   "Continuez à importer des exports TruckFlow.")

    btn_train = st.button("🚀 Lancer l'entraînement", type="primary",
                          disabled=len(truck_df) < 5)

    if btn_train:
        with st.spinner("Entraînement en cours..."):
            results = train_all(st.session_state.sessions)
            st.session_state.train_results = results
            reload_models()

        st.success("✅ Entraînement terminé !")
        st.json(results)


# =============================================================================
# TAB 3 — PRÉDICTIONS
# =============================================================================
with tab3:
    st.markdown("## 🔮 Prédictions pour une journée")
    st.caption("Saisir les volumes prévus (depuis le VL06O du matin) pour obtenir les prédictions.")

    models = load_all_models()
    if all(v is None for v in models.values()):
        st.warning("⚠️ Aucun modèle entraîné. Importe d'abord des données dans l'onglet **📥 Import**.")

    # ── Capacité journalière ──────────────────────────────────────────────────
    st.markdown("### 📦 Capacité globale de la journée")
    pc1, pc2, pc3, pc4 = st.columns(4)
    with pc1:
        nb_trucks_in = st.number_input("Nombre de camions prévus", min_value=1, max_value=50, value=10)
    with pc2:
        nb_del_in = st.number_input("Nombre de livraisons total", min_value=1, max_value=200, value=30)
    with pc3:
        pal_in = st.number_input("Palettes silo (total)", min_value=0, max_value=500, value=60)
    with pc4:
        pick_in = st.number_input("Colis picking (total)", min_value=0, max_value=50000, value=1200)

    if st.button("Analyser la capacité", type="primary"):
        cap = predict_capacity(nb_trucks_in, nb_del_in, pal_in, pick_in)

        col_res, col_det = st.columns([1, 2])
        with col_res:
            st.markdown(f"""<div class="pred-box" style="border-color:{cap['color']}55">
                <div class="big" style="color:{cap['color']}">{cap['icon']}</div>
                <div style="font-size:22px;font-weight:800;color:{cap['color']}">{cap['label_fr']}</div>
                {color_pill(cap['label'], cap['color'])}
                {'<br><small style="color:#8b949e">Estimation théorique (pas de modèle)</small>' if cap.get('estimated') else ''}
            </div>""", unsafe_allow_html=True)

        with col_det:
            d = cap["details"]
            st.markdown(f"""<div class="pred-box">
                <div style="font-size:14px;font-weight:700;margin-bottom:8px">Détail théorique</div>
                <div>⏱ Heures silo estimées : <b>{d['hr_silo']}h</b> ({d['pal_silo']} pal ÷ 18 pal/h)</div>
                <div>⏱ Heures picking estimées : <b>{d['hr_pick']}h</b> ({d['colis_pick']} colis ÷ 600 col/h)</div>
                <div style="margin-top:8px;font-size:16px;font-weight:800">
                  Total estimé : {d['hr_total']}h de travail
                </div>
            </div>""", unsafe_allow_html=True)

            if "proba" in cap:
                proba = cap["proba"]
                fig = go.Figure(go.Bar(
                    x=list(proba.keys()),
                    y=list(proba.values()),
                    marker_color=["#4ade80", "#f87171", "#fbbf24"][:len(proba)],
                ))
                fig.update_layout(
                    title="Probabilités par classe",
                    yaxis_title="Probabilité (%)",
                    template="plotly_dark",
                    height=220,
                    margin=dict(t=30, b=20, l=20, r=20),
                )
                st.plotly_chart(fig, use_container_width=True)

    st.markdown("---")

    # ── Prédiction par camion ─────────────────────────────────────────────────
    st.markdown("### 🚛 Prédiction par camion")
    st.caption("Ajoute les camions prévus un par un pour obtenir une prédiction individuelle.")

    if "camions_preview" not in st.session_state:
        st.session_state.camions_preview = []

    # Récupérer la liste des transporteurs connus
    truck_df = st.session_state.truck_df
    known_carriers = sorted(truck_df["transporteur"].unique().tolist()) if not truck_df.empty else []
    carrier_options = known_carriers if known_carriers else ["BERNARD", "FELBELU", "POIDEVIN"]

    with st.expander("➕ Ajouter un camion", expanded=True):
        ac1, ac2, ac3, ac4, ac5 = st.columns(5)
        with ac1:
            tr_name = st.selectbox("Transporteur", carrier_options + ["Autre..."])
            if tr_name == "Autre...":
                tr_name = st.text_input("Nom transporteur")
        with ac2:
            cr_h = st.number_input("Créneau (heure départ)", min_value=5, max_value=22, value=10)
        with ac3:
            tr_del = st.number_input("Nb livraisons", min_value=1, max_value=30, value=3)
        with ac4:
            tr_pal = st.number_input("Pal silo", min_value=0, max_value=100, value=5)
        with ac5:
            tr_pick = st.number_input("Colis picking", min_value=0, max_value=5000, value=100)

        if st.button("Ajouter ce camion"):
            st.session_state.camions_preview.append({
                "transporteur":  tr_name,
                "creneau_start": cr_h,
                "nb_deliveries": tr_del,
                "pal_silo":      tr_pal,
                "colis_pick":    tr_pick,
            })

    if st.session_state.camions_preview:
        if st.button("🗑 Vider la liste"):
            st.session_state.camions_preview = []
            st.rerun()

        result = analyze_day(st.session_state.camions_preview)

        for i, t in enumerate(result.get("trucks", [])):
            lt = t["load_time"]
            dr = t["delay_risk"]
            c_name = t["transporteur"]
            cren = f"{t['creneau_start']}h-{t['creneau_start']+2}h" if t.get("creneau_start") else "libre"

            st.markdown(f"""<div class="pred-box" style="border-color:{lt['color']}44">
                <div style="display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap">
                  <div style="flex:1;min-width:160px">
                    <div style="font-size:16px;font-weight:900">{c_name}</div>
                    <div class="sub">Créneau {cren} · {t['nb_deliveries']} livraisons
                      · {t['pal_silo']} pal · {t['colis_pick']} colis</div>
                  </div>
                  <div style="text-align:center;min-width:120px">
                    <div style="font-size:11px;color:#8b949e;text-transform:uppercase">Durée prédite</div>
                    <div style="font-size:28px;font-weight:900;color:{lt['color']}">{lt['minutes']} min</div>
                    {color_pill(lt['icon']+' '+lt['label'], lt['color'])}
                  </div>
                  <div style="text-align:center;min-width:120px">
                    <div style="font-size:11px;color:#8b949e;text-transform:uppercase">Risque retard</div>
                    <div style="font-size:28px;font-weight:900;color:{dr['color']}">{dr['pct']}%</div>
                    {color_pill(dr['icon']+' '+dr['label'], dr['color'])}
                  </div>
                </div>
            </div>""", unsafe_allow_html=True)


# =============================================================================
# TAB 4 — HISTORIQUE
# =============================================================================
with tab4:
    st.markdown("## 📈 Historique & Tendances")

    truck_df = st.session_state.truck_df
    daily_df = st.session_state.daily_df

    if truck_df.empty:
        st.info("Aucune donnée disponible. Importe des exports TruckFlow dans l'onglet **📥 Import**.")
    else:
        # Ponctualité dans le temps
        st.markdown("### Ponctualité par jour")
        if not daily_df.empty:
            fig = px.bar(
                daily_df.sort_values("date"),
                x="date", y=["nb_trucks"],
                color_discrete_sequence=["#0a84ff"],
                template="plotly_dark",
                labels={"value": "Camions", "date": "Date"},
            )
            pct_col = daily_df.sort_values("date").copy()
            pct_col["pct_ok"] = 100 - pct_col["pct_retard"]
            fig.add_scatter(
                x=pct_col["date"], y=pct_col["pct_ok"],
                name="% À l'heure", yaxis="y2", mode="lines+markers",
                line=dict(color="#4ade80", width=2),
                marker=dict(size=6),
            )
            fig.update_layout(
                yaxis2=dict(overlaying="y", side="right", range=[0, 105],
                            title="% ponctualité", showgrid=False),
                height=300, margin=dict(t=20, b=20),
            )
            st.plotly_chart(fig, use_container_width=True)

        # Volume silo + picking
        st.markdown("### Volumes journaliers")
        if not daily_df.empty:
            fig2 = px.bar(
                daily_df.sort_values("date"),
                x="date",
                y=["pal_silo_total", "hr_silo_needed", "hr_pick_needed"],
                barmode="group",
                template="plotly_dark",
                labels={"value": "Volume / Heures", "date": "Date"},
                color_discrete_map={
                    "pal_silo_total":  "#0a84ff",
                    "hr_silo_needed":  "#fb923c",
                    "hr_pick_needed":  "#a78bfa",
                },
                height=280,
            )
            fig2.update_layout(margin=dict(t=10, b=20))
            st.plotly_chart(fig2, use_container_width=True)

        # Durée par transporteur
        st.markdown("### Durée moyenne par transporteur")
        carrier_stats = extract_carrier_stats(st.session_state.sessions)
        if not carrier_stats.empty:
            cs = carrier_stats.sort_values("avg_total_min", ascending=True)
            fig3 = px.bar(
                cs, x="avg_total_min", y="transporteur",
                orientation="h",
                color="pct_retard",
                color_continuous_scale=["#4ade80", "#fbbf24", "#f87171"],
                range_color=[0, 50],
                template="plotly_dark",
                labels={
                    "avg_total_min": "Durée moyenne arr→dep (min)",
                    "transporteur":  "Transporteur",
                    "pct_retard":    "% retard",
                },
                text="nb_passages",
                height=max(250, len(cs) * 35),
            )
            fig3.update_traces(texttemplate="%{text} passages", textposition="outside")
            fig3.update_layout(margin=dict(t=10, b=20))
            st.plotly_chart(fig3, use_container_width=True)

        # Tableau carrier stats
        st.markdown("### Stats détaillées par transporteur")
        st.dataframe(carrier_stats, use_container_width=True, hide_index=True)
