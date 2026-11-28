# -*- coding: utf-8 -*-
"""
Lee salida/ruletas.json, salida/resultados.json (personas simuladas) y salida/regalo-abuso.json
y escribe salida/analitica_palma_blanca.xlsx, salida/resultados.csv, salida/analisis.json y salida/reporte.html.
Las conclusiones y hallazgos se escriben a mano en conclusiones.json y hallazgos.json (después de ver los datos).
Uso: python3 analizar.py
"""
import json, math, csv, os, collections, html, datetime, re
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
from openpyxl.chart import BarChart, Reference
from openpyxl.utils import get_column_letter

AQUI = os.path.dirname(os.path.abspath(__file__)); SAL = os.path.join(AQUI, "salida")
leer = lambda n, d=None: json.load(open(os.path.join(SAL, n), encoding="utf-8")) if os.path.exists(os.path.join(SAL, n)) else d
RU = leer("ruletas.json", {}); SIM = leer("resultados.json", {"meta": {}, "resultados": []}); AB = leer("regalo-abuso.json", {})
S = SIM["resultados"]
# En la corrida de 1,000 la computadora se suspendió mientras corrían las sesiones 200–499: esas sesiones
# tienen tiempos inflados y "no respondió" falsos. Se cuentan sus recorridos y resultados, pero no sus fallas ni tiempos.
SUSP_RANGO = tuple(int(x) for x in os.environ.get("SUSP_RANGO", "200,500").split(",")) if SIM["meta"].get("n", 0) >= 1000 else (0, 0)
susp = lambda s: SUSP_RANGO[0] <= s["id"] < SUSP_RANGO[1]
S_OK = [s for s in S if not susp(s)]
# Si la pantalla del regalo seguía abierta, el simulador volvía a leer el mismo resultado sin girar (< 1.5 s): se quitan.
for s in S: s["ruleta"] = [x for x in s.get("ruleta", []) if x.get("ms", 9999) > 1500]
CONC = json.load(open(os.path.join(AQUI, "conclusiones.json"), encoding="utf-8")) if os.path.exists(os.path.join(AQUI, "conclusiones.json")) else []
HALL = json.load(open(os.path.join(AQUI, "hallazgos.json"), encoding="utf-8")) if os.path.exists(os.path.join(AQUI, "hallazgos.json")) else []

# ---------------- estadística ----------------
def gammaln(x):
    c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5]
    y = x; t = x + 5.5; t -= (x + 0.5) * math.log(t); s = 1.000000000190015
    for k in c: y += 1; s += k / y
    return -t + math.log(2.5066282746310005 * s / x)
def gammaq(a, x):
    if x <= 0: return 1.0
    g = gammaln(a)
    if x < a + 1:
        ap = a; s = d = 1 / a
        for _ in range(500):
            ap += 1; d *= x / ap; s += d
            if abs(d) < abs(s) * 1e-13: break
        return 1 - s * math.exp(-x + a * math.log(x) - g)
    b = x + 1 - a; c = 1e300; d = 1 / b; h = d
    for i in range(1, 500):
        an = -i * (i - a); b += 2; d = an * d + b; d = d if abs(d) > 1e-300 else 1e-300; c = b + an / c; c = c if abs(c) > 1e-300 else 1e-300; d = 1 / d; de = d * c; h *= de
        if abs(de - 1) < 1e-13: break
    return math.exp(-x + a * math.log(x) - g) * h
def chi2(obs, esp):
    cats = [k for k in esp if esp[k] > 0]; x = sum((obs.get(k, 0) - esp[k]) ** 2 / esp[k] for k in cats); gl = len(cats) - 1
    p = gammaq(gl / 2, x / 2) if gl > 0 else 1.0; mn = min(esp[k] for k in cats) if cats else 0
    if mn < 5: v = f"No alcanzan los datos (se esperan {mn:.1f} por opción; hacen falta 5)"
    elif p < 0.01: v = "Tiene sesgo: la diferencia es demasiado grande para ser casualidad"
    elif p < 0.05: v = "Posible sesgo leve: conviene repetir con más tiros"
    else: v = "Es pareja: las diferencias son normales del azar"
    return {"chi2": round(x, 2), "gl": gl, "p": round(p, 4), "min_esperado": round(mn, 2), "veredicto": v}
def p95(a):
    if not a: return None
    s = sorted(a); return s[min(len(s) - 1, math.ceil(0.95 * len(s)) - 1)]
media = lambda a: (sum(a) / len(a)) if a else None

# ---------------- 1. Ruleta del Modo Antro ----------------
A = RU.get("antro", {}); cas = A.get("casillas", []); preg = A.get("probRegalo", 0.01)
tit = {}  # id → nombre visible (copias repetidas se juntan)
for c in cas: tit.setdefault(c["titulo"], c["id"])
canon = {c["id"]: tit[c["titulo"]] for c in cas}; nombre = {tit[c["titulo"]]: c["titulo"] for c in cas}; nombre["regalo"] = "REGALO (casilla dorada)"
def esperado_antro(modo):
    e = collections.Counter()
    pool = [c for c in cas if not (modo == "15 min después de un shot" and c["alcohol"])]
    W = sum(c["peso"] for c in pool)
    for c in pool: e[canon[c["id"]]] += (1 - preg) * c["peso"] / W
    e["regalo"] += preg
    return e
ruleta = {}
for modo, seq in A.get("modos", {}).items():
    ids = [x["id"] if x["id"] == "regalo" else canon.get(x["id"], x["id"]) for x in seq]; n = len(ids)
    obs = collections.Counter(ids)
    if modo == "uso real (1 giro por minuto)": esp1 = None
    else: esp1 = esperado_antro(modo)
    filas = []
    for k in (list(esp1.keys()) if esp1 else sorted(obs, key=lambda k: -obs[k])):
        filas.append({"espacio": nombre.get(k, k), "id": k, "veces": obs.get(k, 0), "esperado_pct": esp1[k] if esp1 else None})
    # rachas del regalo
    pos = [i for i, x in enumerate(ids) if x == "regalo"]
    gaps = [b - a for a, b in zip([-1] + pos, pos + [n])]
    seguidas = mx = 0
    for x in ids: seguidas = seguidas + 1 if x == "regalo" else 0; mx = max(mx, seguidas)
    ruleta[modo] = {"n": n, "filas": filas, "chi": chi2(obs, {k: v * n for k, v in esp1.items()}) if esp1 else None,
                    "regalo": {"veces": len(pos), "cada": round(n / len(pos), 1) if pos else None, "racha_sin": max(gaps) if gaps else n, "racha_seguida": mx, "esperado": round(preg * n, 1), "gaps": gaps[:-1] if pos else []}}

# ---------------- 2. Tragamonedas, ruleta de juegos, dedos, botella ----------------
def no_repite(seq, opciones):
    obs = collections.Counter(x["resultado"] for x in seq if x.get("listo", True)); esp = collections.Counter()
    for x in seq:
        if not x.get("listo", True): continue
        pool = [o for o in opciones if o != x.get("antes")] or opciones
        for o in pool: esp[o] += 1 / len(pool)
    return obs, esp
html_app = open(os.path.join(AQUI, "snapshot-app", "index.html"), encoding="utf-8").read()
DRINKS = re.findall(r'^ \{n:"([^"]+)",a:', html_app, re.M)
JUEGOS = re.findall(r'\{ *id: *"[a-z]+", *nombre: *"([^"]+)"', open(os.path.join(AQUI, "snapshot-app", "juegos-data.js"), encoding="utf-8").read())
slot_obs, slot_esp = no_repite(RU.get("slot", []), DRINKS); slot_n = sum(slot_obs.values())
jg_obs, jg_esp = no_repite(RU.get("juegos", []), JUEGOS); jg_n = sum(jg_obs.values())
slot_rep = sum(1 for x in RU.get("slot", []) if x.get("listo", True) and x.get("antes") == x.get("resultado"))
dedos = {}
for n, seq in (RU.get("dedos") or {}).items():
    n = int(n); ok = [x for x in seq if x["ganador"] >= 0]; obs = collections.Counter(x["ganador"] + 1 for x in ok)
    dedos[n] = {"rondas": len(seq), "eligio": len(ok), "obs": obs, "chi": chi2({str(k): v for k, v in obs.items()}, {str(i): len(ok) / n for i in range(1, n + 1)})}
bot_raw = (leer("ruletas-botella.json", {}) or {}).get("botella") or RU.get("botella", [])
bot = [x for i, x in enumerate(bot_raw) if i == 0 or abs(x["pone"] - bot_raw[i - 1]["pone"]) > 1e-9]   # sin mediciones repetidas
sect = lambda a: int(a // 45) % 8
bot_pone = collections.Counter(sect(x["pone"]) for x in bot); bot_rec = collections.Counter(sect(x["recibe"]) for x in bot)
bot_misma = sum(1 for x in bot if min(abs(x["pone"] - x["recibe"]), 360 - abs(x["pone"] - x["recibe"])) < 45)

# ---------------- 3. Personas simuladas ----------------
SEC = {"drinks": "Drinks", "peda": "La Peda", "antro": "Modo Antro", "quien": "¿A ver qué te toca?", "premio": "Botella premiada", "inicio": "Inicio"}
def sec_de(x): return SEC.get(x.split("/")[0], x)
porcel = collections.OrderedDict(); seccion = collections.OrderedDict(); errores = collections.Counter(); ejemplos = {}
for s in S:
    vis = []
    for x in s["recorrido"]:
        k = sec_de(x)
        if k not in vis: vis.append(k)
    for k in vis:
        d = seccion.setdefault(k, {"personas": 0, "dur": []}); d["personas"] += 1
        if not susp(s): d["dur"].append(s["duracion_ms"] / 1000)
    if susp(s): continue
    c = porcel.setdefault(s["celular"], {"sesiones": 0, "con_error": 0, "errores": 0, "atorados": 0, "desbordes": 0, "tapados": 0, "carga": []})
    c["sesiones"] += 1; c["errores"] += len(s["errores"]); c["con_error"] += bool(s["errores"]); c["atorados"] += len(s["atorados"]); c["desbordes"] += len(s["desbordes"]); c["tapados"] += len(s["tapados"])
    if s.get("carga_total_ms") is not None: c["carga"].append(s["carga_total_ms"])
    for e in s["errores"]:
        key = ("Error de JavaScript", e["msg"][:160], sec_de(e.get("seccion", "inicio")), s["celular"], e["accion"]); errores[key] += 1
    for e in s["atorados"]:
        key = ("No respondió en 10 s", e["motivo"][:160], sec_de(e.get("seccion", "inicio")), s["celular"], e["accion"]); errores[key] += 1
    for e in s["desbordes"]:
        key = ("Se sale de la pantalla", f'{e["ancho"]} px en pantalla de {e["pantalla"]} px', "", s["celular"], e["accion"]); errores[key] += 1
    for e in s["tapados"]:
        key = ("Botón tapado", "lo tapa " + e["lo_tapa"], "", s["celular"], e["accion"]); errores[key] += 1
juegos = collections.OrderedDict()
for s in S_OK:
    for j in s.get("juegos", []):
        g = juegos.setdefault(j["juego"], {"empezaron": 0, "terminaron": 0, "seg": []}); g["empezaron"] += bool(j["empezo"]); g["terminaron"] += bool(j["termino"])
        if j["empezo"] and not susp(s): g["seg"].append(j["ms"] / 1000)
P = lambda p: [s for s in S_OK if s["perfil"] == p]
emb = collections.OrderedDict()
def paso(perfil, nombre_paso, n, total): emb.setdefault(perfil, []).append((nombre_paso, n, total))
d_ = P("Drinks"); paso("Drinks", "Personas", len(d_), len(d_)); paso("Drinks", "Abrió el quiz", sum(s["embudo"]["quiz_inicio"] for s in d_), len(d_)); paso("Drinks", "Terminó el quiz", sum(s["embudo"]["quiz_fin"] for s in d_), len(d_))
pe = P("Peda en casa"); cl = [s for s in pe if s.get("peda")]; bd = [s for s in pe if s.get("cita")]
paso("La Peda (clásica)", "Empezaron", len(cl), len(cl)); paso("La Peda (clásica)", "Llegaron al resumen", sum(s["embudo"]["peda_resumen"] for s in cl), len(cl))
paso("Blind Date (Cita a Ciegas / Cupido)", "Empezaron", len(bd), len(bd)); paso("Blind Date (Cita a Ciegas / Cupido)", "Llegaron a los resultados", sum(s["embudo"]["cita_resultados"] for s in bd), len(bd))
an = P("Antro"); paso("Modo Antro", "Entraron", len(an), len(an)); paso("Modo Antro", "Pasaron la edad", sum(s["embudo"]["antro_edad"] for s in an), len(an)); paso("Modo Antro", "Completaron el registro (llegaron a la ruleta)", sum(s["embudo"]["antro_ruleta"] for s in an), len(an))
for g, v in juegos.items(): paso("¿A ver qué te toca? · " + g, "Empezaron", v["empezaron"], v["empezaron"]); paso("¿A ver qué te toca? · " + g, "Terminaron (resumen / explotó / eligió)", v["terminaron"], v["empezaron"])
pr = [s["premio"] for s in S if s.get("premio")]
premios = {"validos": sum(p["esperado"] == "válido" for p in pr), "validos_ok": sum(p["esperado"] == "válido" and p["aceptado"] for p in pr),
           "invalidos": sum(p["esperado"] == "inválido" for p in pr), "invalidos_aceptados": sum(p["esperado"] == "inválido" and p["aceptado"] for p in pr),
           "invalidos_en_mis_premios": sum(p["esperado"] == "inválido" and p["en_mis_premios"] for p in pr),
           "por_tipo": collections.Counter(f'{p["tipo"]} → {p["mostrado"]}' for p in pr)}
sim_ruleta = collections.Counter(x["id"] for s in S for x in s["ruleta"]); sim_regalo = sum(1 for s in S for x in s["ruleta"] if x["id"] == "regalo")
tiros_tot = sum(v["n"] for v in ruleta.values()) + slot_n + jg_n + sum(v["rondas"] for v in dedos.values()) + len(bot)
cel_peor = max(porcel.items(), key=lambda kv: (kv[1]["errores"] + kv[1]["atorados"] + kv[1]["desbordes"]) / max(1, kv[1]["sesiones"]))[0] if porcel else "—"
sec_mas = max(((k, v) for k, v in seccion.items() if k != "Inicio"), key=lambda kv: kv[1]["personas"])[0] if seccion else "—"
pct_err = (sum(1 for s in S_OK if s["errores"]) / len(S_OK)) if S_OK else 0
normal = ruleta.get("normal", {"regalo": {"veces": 0}, "n": 0})
json.dump({"ruleta": {m: {"n": v["n"], "chi": v["chi"], "regalo": {k: v["regalo"][k] for k in v["regalo"] if k != "gaps"}, "filas": v["filas"]} for m, v in ruleta.items()},
           "slot": {"n": slot_n, "obs": slot_obs, "esp": {k: round(v, 1) for k, v in slot_esp.items()}, "chi": chi2(slot_obs, slot_esp), "repetidos": slot_rep},
           "juegos_ruleta": {"n": jg_n, "obs": jg_obs, "chi": chi2(jg_obs, jg_esp)}, "dedos": {n: {"rondas": v["rondas"], "eligio": v["eligio"], "obs": v["obs"], "chi": v["chi"]} for n, v in dedos.items()},
           "botella": {"n": len(bot), "pone": bot_pone, "recibe": bot_rec, "chi_pone": chi2(bot_pone, {i: len(bot) / 8 for i in range(8)}), "misma_zona": bot_misma},
           "personas": len(S), "tiros_totales": tiros_tot, "pct_sesiones_con_error": pct_err, "seccion_mas_usada": sec_mas, "celular_peor": cel_peor,
           "secciones": {k: {"personas": v["personas"], "dur_prom": media(v["dur"])} for k, v in seccion.items()}, "juegos": {k: {"empezaron": v["empezaron"], "terminaron": v["terminaron"], "seg": media(v["seg"])} for k, v in juegos.items()},
           "embudos": emb, "celulares": {k: {kk: (vv if kk != "carga" else [media(vv), p95(vv)]) for kk, vv in v.items()} for k, v in porcel.items()},
           "errores": [list(k) + [v] for k, v in errores.most_common()], "premios": premios, "abuso": AB, "sim_regalo": sim_regalo, "sim_giros": sum(sim_ruleta.values()),
           "tiempos": {"carga": [media([s["carga_total_ms"] for s in S_OK if s.get("carga_total_ms")]), p95([s["carga_total_ms"] for s in S_OK if s.get("carga_total_ms")])],
                       "slot": [media([x["ms"] for s in S_OK for x in s["slot"]]), p95([x["ms"] for s in S_OK for x in s["slot"]])],
                       "ruleta": [media([x["ms"] for s in S_OK for x in s["ruleta"]]), p95([x["ms"] for s in S_OK for x in s["ruleta"]])],
                       "juegos": [media([x["ms"] for s in S_OK for x in s["juegos_ruleta"]]), p95([x["ms"] for s in S_OK for x in s["juegos_ruleta"]])]},
           "suspendidas": len(S) - len(S_OK), "duracion": [media([s["duracion_ms"] / 1000 for s in S_OK]), p95([s["duracion_ms"] / 1000 for s in S_OK])],
           "rarezas": collections.Counter(r for s in S for r in s["rarezas"]), "perfiles": collections.Counter(s["perfil"] for s in S)},
          open(os.path.join(SAL, "analisis.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1, default=str)

# =====================================================================
#   EXCEL
# =====================================================================
F = "Arial"; NEG = Font(name=F, bold=True); NORM = Font(name=F); TIT = Font(name=F, bold=True, size=14); SUB = Font(name=F, italic=True, color="555555")
HEAD_FILL = PatternFill("solid", fgColor="E8E4DA"); FINA = Side(style="thin", color="D0CCC2")
PCT = "0.0%"; PCT2 = "0.00%"
wb = Workbook(); wb.remove(wb.active)
try: wb.calculation.fullCalcOnLoad = True
except Exception: pass
def hoja(nombre): ws = wb.create_sheet(nombre); ws.sheet_view.showGridLines = False; return ws
def titulo(ws, t, sub=None):
    ws["A1"] = t; ws["A1"].font = TIT
    if sub: ws["A2"] = sub; ws["A2"].font = SUB
def tabla(ws, fila, col, cab, filas, pct_cols=(), filtro=True, anchos=None):
    for j, h in enumerate(cab):
        c = ws.cell(fila, col + j, h); c.font = NEG; c.fill = HEAD_FILL; c.alignment = Alignment(wrap_text=True, vertical="center"); c.border = Border(bottom=FINA)
    for i, f in enumerate(filas):
        for j, v in enumerate(f):
            c = ws.cell(fila + 1 + i, col + j, v); c.font = NORM
            if cab[j] in pct_cols: c.number_format = PCT2 if "esperado" in cab[j].lower() or "real" in cab[j].lower() or "Diferencia" in cab[j] else PCT
    if filtro and filas: ws.auto_filter.ref = f"{get_column_letter(col)}{fila}:{get_column_letter(col + len(cab) - 1)}{fila + len(filas)}"
    return fila + len(filas)
def ancho(ws, anchos):
    for i, a in enumerate(anchos, 1): ws.column_dimensions[get_column_letter(i)].width = a
def grafica(ws, titulo_g, cats_ref, data_refs, ancla, ytitulo="", horizontal=False, ancho_cm=18, alto_cm=9):
    ch = BarChart(); ch.type = "bar" if horizontal else "col"; ch.title = titulo_g; ch.roundedCorners = False
    for ref, tf in data_refs: ch.add_data(ref, titles_from_data=tf)
    ch.set_categories(cats_ref); ch.y_axis.title = ytitulo; ch.x_axis.delete = False; ch.y_axis.delete = False
    ch.legend.overlay = False
    if len(data_refs) == 1: ch.legend = None
    ch.width = ancho_cm; ch.height = alto_cm; ch.gapWidth = 60
    try: ch.title.overlay = False
    except Exception: pass
    ws.add_chart(ch, ancla)

# ---- 1. Resumen ----
ws = hoja("Resumen"); titulo(ws, "Analítica Palma Blanca · simulaciones", f'{len(S)} personas simuladas y {tiros_tot:,} tiros de ruletas · {datetime.date.today().strftime("%d/%m/%Y")} · servidor de prueba local')
kp = [("Personas simuladas", len(S), None), ("Tiros totales de ruletas y sorteos", tiros_tot, None),
      ("Veces que salió el REGALO en 10,000 tiros (ruleta normal)", normal["regalo"]["veces"], None),
      ("Lo esperado: 1 de cada 100 tiros", normal["regalo"].get("esperado"), None),
      ("% de personas con algún error de JavaScript", pct_err, PCT), ("Sección más usada", sec_mas, None), ("Celular con más problemas", cel_peor, None),
      ("Códigos de premio falsos aceptados (debe ser 0)", premios["invalidos_aceptados"], None)]
tabla(ws, 4, 1, ["Indicador", "Valor"], [[k, v] for k, v, _ in kp])
for i, (_, _, f) in enumerate(kp):
    if f: ws.cell(5 + i, 2).number_format = f
r0 = 5 + len(kp) + 2; ws.cell(r0, 1, "5 conclusiones").font = NEG
for i, t in enumerate(CONC[:5]): c = ws.cell(r0 + 1 + i, 1, f"{i + 1}. {t}"); c.alignment = Alignment(wrap_text=True, vertical="top"); c.font = NORM; ws.merge_cells(start_row=r0 + 1 + i, start_column=1, end_row=r0 + 1 + i, end_column=2); ws.row_dimensions[r0 + 1 + i].height = 48
r1 = r0 + 8; ws.cell(r1, 1, "Personas que entraron a cada sección").font = NEG
secs = [(k, v["personas"]) for k, v in seccion.items() if k != "Inicio"]
fin = tabla(ws, r1 + 1, 1, ["Sección", "Personas"], secs, filtro=False)
grafica(ws, "Personas por sección", Reference(ws, min_col=1, min_row=r1 + 2, max_row=fin), [(Reference(ws, min_col=2, min_row=r1 + 1, max_row=fin), True)], "D4", "Personas", True)
ancho(ws, [58, 22])

# ---- 2. Ruleta 10000 ----
ws = hoja("Ruleta 10000"); titulo(ws, "Ruleta del Modo Antro · 10,000 tiros por modo", "Misma función de sorteo de la app (elegir). % real y diferencia se calculan con fórmula.")
fila = 4; graf_hecha = False
for modo, v in ruleta.items():
    ws.cell(fila, 1, f"Modo: {modo} · {v['n']:,} tiros").font = NEG; fila += 1
    ini = fila; filas = []
    for k, f in enumerate(v["filas"]):
        rr = fila + 1 + k
        filas.append([f["espacio"], f["veces"], f"=B{rr}/{v['n']}", f["esperado_pct"] if f["esperado_pct"] is not None else "—", f"=C{rr}-D{rr}" if f["esperado_pct"] is not None else "—"])
    fin = tabla(ws, fila, 1, ["Espacio", "Veces", "% real", "% esperado", "Diferencia"], filas, pct_cols=("% real", "% esperado", "Diferencia"), filtro=not graf_hecha)
    if not graf_hecha:
        grafica(ws, "Ruleta normal: % real vs % esperado", Reference(ws, min_col=1, min_row=ini + 1, max_row=fin), [(Reference(ws, min_col=3, min_row=ini, max_row=fin), True), (Reference(ws, min_col=4, min_row=ini, max_row=fin), True)], "H4", "%", True, 20, 11)
        graf_hecha = True
    fila = fin + 1
    if v["chi"]: ws.cell(fila, 1, f"Prueba de sesgo (chi-cuadrada): {v['chi']['veredicto']} · χ² = {v['chi']['chi2']}, p = {v['chi']['p']}").font = NORM
    else: ws.cell(fila, 1, "Uso real: no hay un % esperado fijo, porque después de cada shot la ruleta pasa 15 min sin alcohol.").font = SUB
    fila += 3
for t, obs, esp, n, chi in [("Ruleta de «¿A ver qué te toca?»", jg_obs, jg_esp, jg_n, chi2(jg_obs, jg_esp))]:
    ws.cell(fila, 1, f"{t} · {n:,} tiros").font = NEG; fila += 1; filas = []
    for k, o in enumerate(JUEGOS): rr = fila + 1 + k; filas.append([o, obs.get(o, 0), f"=B{rr}/{n}", esp[o] / n if n else 0, f"=C{rr}-D{rr}"])
    fin = tabla(ws, fila, 1, ["Espacio", "Veces", "% real", "% esperado", "Diferencia"], filas, pct_cols=("% real", "% esperado", "Diferencia"), filtro=False); fila = fin + 1
    ws.cell(fila, 1, f"Prueba de sesgo: {chi['veredicto']} · χ² = {chi['chi2']}, p = {chi['p']}"); fila += 3
ws.cell(fila, 1, f"Gira la Botella («¿A ver qué te toca?») · {len(bot):,} giros dobles · a dónde apunta (8 zonas de 45°)").font = NEG; fila += 1
filas = [[f"Zona {i + 1} ({i * 45}°–{i * 45 + 45}°)", bot_pone.get(i, 0), bot_rec.get(i, 0)] for i in range(8)]
fin = tabla(ws, fila, 1, ["Zona", "PONE (1er giro)", "RECIBE (2º giro)"], filas, filtro=False); fila = fin + 1
cp = chi2(bot_pone, {i: len(bot) / 8 for i in range(8)}); ws.cell(fila, 1, f"Primer giro: p = {cp['p']}. La app elige el ángulo con Math.random()*360 (todas las direcciones igual de probables), así que esta p baja es suerte del muestreo, no un sesgo: de cada 100 pruebas a una ruleta justa, ~3 salen así. PONE y RECIBE cayeron a menos de 45° entre sí {bot_misma} veces (la app lo evita a propósito: el 2º giro nunca cae a menos de 50° del 1º).")
ancho(ws, [44, 12, 12, 12, 12])

# ---- 3. Regalo ----
ws = hoja("Regalo"); titulo(ws, "El REGALO (casilla dorada) · 1 de cada 100 tiros", "Rachas medidas en los 10,000 tiros de cada modo con la función de la app.")
filas = [[m, v["n"], v["regalo"]["veces"], v["regalo"]["esperado"], f"=IF(C{6 + i}=0,\"—\",B{6 + i}/C{6 + i})", v["regalo"]["racha_sin"], v["regalo"]["racha_seguida"]] for i, (m, v) in enumerate(ruleta.items())]
fin = tabla(ws, 5, 1, ["Modo", "Tiros", "Veces que salió", "Esperado (1%)", "Sale cada … tiros", "Racha más larga SIN regalo", "Racha más larga seguido"], filas)
for i in range(len(filas)): ws.cell(6 + i, 5).number_format = "0.0"
f2 = fin + 2; ws.cell(f2, 1, "¿Cuántos regalos puede sacar una misma persona? (probado contra el servidor de prueba)").font = NEG
ab = AB or {}
filas = [["Mismo celular, recargando la página 10 veces", ab.get("mismo_cel_10_intentos", {}).get("tickets_nuevos", "—"), "El servidor da 1 regalo por celular cada 12 horas"],
         ["Borrando datos del navegador o en incógnito, 40 intentos", ab.get("datos_borrados_40_intentos", {}).get("tickets_nuevos", "—"), "Tope de 30 por red cada 12 horas (en datos móviles la red cambia y el tope se reinicia)"],
         ["¿Se puede pedir el ticket SIN haber girado la ruleta?", "Sí" if ab.get("sin_girar_la_ruleta") else "No", "El servidor no comprueba que la ruleta haya caído en el regalo"],
         ["¿Se puede marcar un ticket como entregado SIN el PIN del staff?", "Sí" if (ab.get("marcar_entregado_sin_pin") or {}).get("quedo_reclamado") else "No", "Cualquiera que conozca el folio puede marcarlo como entregado"],
         ["Personas simuladas que ganaron el regalo girando (1,000 personas)", sim_regalo, f"de {sum(sim_ruleta.values())} giros en la simulación de personas"]]
fin2 = tabla(ws, f2 + 1, 1, ["Prueba", "Resultado", "Qué significa"], filas, filtro=False)
ws.cell(fin2 + 2, 1, "Recomendación").font = NEG
ws.cell(fin2 + 3, 1, "Que el servidor decida el giro (o firme el resultado) y solo entregue el ticket si de verdad salió el regalo; mantener 1 regalo por persona por noche; pedir el PIN del staff para marcarlo como entregado; y si es posible, ligar el regalo a la mesa o a la selfie de entrada en vez de solo al navegador.").alignment = Alignment(wrap_text=True)
ws.merge_cells(start_row=fin2 + 3, start_column=1, end_row=fin2 + 3, end_column=3); ws.row_dimensions[fin2 + 3].height = 60
# histograma de tiros entre regalos (modo normal)
g = normal["regalo"].get("gaps", []) if isinstance(normal.get("regalo"), dict) else []
cubos = [("1–25", 1, 25), ("26–50", 26, 50), ("51–100", 51, 100), ("101–200", 101, 200), ("201–300", 201, 300), ("301–500", 301, 500), ("Más de 500", 501, 10 ** 9)]
h0 = fin2 + 6; ws.cell(h0, 1, "Cada cuántos tiros salió el regalo (ruleta normal)").font = NEG
fh = tabla(ws, h0 + 1, 1, ["Tiros entre un regalo y otro", "Veces"], [[n, sum(a <= x <= b for x in g)] for n, a, b in cubos], filtro=False)
grafica(ws, "Tiros entre un regalo y el siguiente", Reference(ws, min_col=1, min_row=h0 + 2, max_row=fh), [(Reference(ws, min_col=2, min_row=h0 + 1, max_row=fh), True)], f"E{h0}", "Veces")
ancho(ws, [52, 14, 60, 14, 16, 16, 16])

# ---- 4. Tragamonedas ----
ws = hoja("Tragamonedas"); titulo(ws, f"Drink del día · {slot_n:,} giros", "No repite el drink que ya estaba: lo esperado toma eso en cuenta.")
filas = [[d, slot_obs.get(d, 0), f"=B{5 + i}/{slot_n}", slot_esp[d] / slot_n if slot_n else 0, f"=C{5 + i}-D{5 + i}"] for i, d in enumerate(DRINKS)]
fin = tabla(ws, 4, 1, ["Drink", "Veces", "% real", "% esperado", "Diferencia"], filas, pct_cols=("% real", "% esperado", "Diferencia"))
c = chi2(slot_obs, slot_esp); ws.cell(fin + 2, 1, f"Prueba de sesgo: {c['veredicto']} · χ² = {c['chi2']}, p = {c['p']} · veces que repitió el mismo drink: {slot_rep}")
grafica(ws, "Veces que salió cada drink", Reference(ws, min_col=1, min_row=5, max_row=fin), [(Reference(ws, min_col=2, min_row=4, max_row=fin), True)], "G4", "Veces", True)
ancho(ws, [26, 10, 12, 12, 12])

# ---- 5. Elegir con dedos ----
ws = hoja("Elegir con dedos"); titulo(ws, "El Dedo · ¿elige a todos parejo?", "Con 2, 4 y 8 dedos; 10,000 rondas cada uno. «Dedo 1» es el primero que tocó la pantalla.")
fila = 4; graf = []
for n, v in sorted(dedos.items()):
    ws.cell(fila, 1, f"{n} jugadores · {v['eligio']:,} rondas que eligieron a alguien de {v['rondas']:,}").font = NEG; fila += 1; ini = fila
    filas = [[f"Dedo {i}", v["obs"].get(i, 0), f"=B{fila + i}/{v['eligio']}", 1 / n, f"=C{fila + i}-D{fila + i}"] for i in range(1, n + 1)]
    fin = tabla(ws, fila, 1, ["Posición", "Veces elegido", "% real", "% esperado", "Diferencia"], filas, pct_cols=("% real", "% esperado", "Diferencia"), filtro=(n == min(dedos)))
    ws.cell(fin + 1, 1, f"Prueba de sesgo: {v['chi']['veredicto']} · χ² = {v['chi']['chi2']}, p = {v['chi']['p']}"); graf.append((ini, fin)); fila = fin + 4
if graf:
    ini, fin = graf[-1]; grafica(ws, "8 jugadores: % de veces que eligió cada dedo", Reference(ws, min_col=1, min_row=ini + 1, max_row=fin), [(Reference(ws, min_col=3, min_row=ini, max_row=fin), True), (Reference(ws, min_col=4, min_row=ini, max_row=fin), True)], "H4", "%")
ancho(ws, [40, 14, 12, 12, 12])

# ---- 6. Sesiones ----
ws = hoja("Sesiones"); titulo(ws, f"Sesiones · una fila por persona simulada ({len(S)})")
cab = ["ID", "Perfil", "Celular", "Regresa", "Carga (ms)", "Duración (s)", "Acciones", "Recorrido", "Dónde terminó", "Errores JS", "No respondió", "Se sale de pantalla", "Tapados",
       "Giros drink", "Drinks que salieron", "Giros ruleta Antro", "Ruleta salió", "Regalo", "Quiz resultado", "La Peda modo", "Jugadores", "Cartas", "Blind Date modo", "Blind Date resultados",
       "Juegos jugados", "Juegos terminados", "Dedos (ganador/dedos)", "Premio código", "Premio tipo", "App mostró", "Premio aceptado", "Compartió", "Rarezas", "Corrió con la compu suspendida"]
filas = []
for s in S:
    filas.append([s["id"], s["perfil"], s["celular"], "Sí" if s["regresa"] else "No", s.get("carga_total_ms"), round(s["duracion_ms"] / 1000, 1), s["acciones"], " > ".join(s["recorrido"]), sec_de(s["abandono"] or "inicio"),
                  len(s["errores"]), len(s["atorados"]), len(s["desbordes"]), len(s["tapados"]), len(s["slot"]), " | ".join(x["resultado"] or "" for x in s["slot"]), len(s["ruleta"]), " | ".join(nombre.get(canon.get(x["id"], x["id"]), x["id"]) for x in s["ruleta"]),
                  "Sí" if any(x["id"] == "regalo" for x in s["ruleta"]) else "No", (s.get("quiz") or {}).get("resultado", ""), (s.get("peda") or {}).get("modo", ""), (s.get("peda") or s.get("cita") or {}).get("jugadores", ""),
                  (s.get("peda") or s.get("cita") or {}).get("cartas", ""), (s.get("cita") or {}).get("modo", ""), ("Sí" if (s.get("cita") or {}).get("resultados") else "No") if s.get("cita") else "",
                  " | ".join(j["juego"] for j in s.get("juegos", [])), " | ".join(j["juego"] for j in s.get("juegos", []) if j["termino"]), " | ".join(f'{x["ganador"] + 1 if x["ganador"] >= 0 else "—"}/{x["dedos"]}' for x in s["dedo"]),
                  (s.get("premio") or {}).get("codigo", "")[:7] + "…" if s.get("premio") else "", (s.get("premio") or {}).get("tipo", ""), (s.get("premio") or {}).get("mostrado", ""), ("Sí" if s["premio"]["aceptado"] else "No") if s.get("premio") else "",
                  "Sí" if s.get("compartio") else "No", " | ".join(s["rarezas"]), "Sí" if susp(s) else "No"])
tabla(ws, 3, 1, cab, filas); ws.freeze_panes = "D4"
ancho(ws, [6, 18, 18, 9, 10, 11, 9, 60, 20, 9, 11, 11, 9, 10, 50, 10, 60, 8, 18, 12, 10, 8, 18, 12, 40, 40, 22, 12, 12, 14, 12, 10, 40, 16])
c = ws.cell(1, 5, "Los códigos de premio van recortados a propósito (no se publican completos)."); c.font = SUB
pc = collections.Counter(x["perfil"] for x in S); cc = len(cab) + 3
fpc = tabla(ws, 3, cc, ["Perfil", "Personas"], [[k, v] for k, v in pc.most_common()], filtro=False)
grafica(ws, "Personas por perfil", Reference(ws, min_col=cc, min_row=4, max_row=fpc), [(Reference(ws, min_col=cc + 1, min_row=3, max_row=fpc), True)], f"{get_column_letter(cc)}{fpc + 2}", "Personas", True)
ws.column_dimensions[get_column_letter(cc)].width = 20

# ---- 7. Secciones ----
ws = hoja("Secciones"); titulo(ws, "Secciones y juegos", "Tiempo: duración promedio de la visita completa de quienes entraron (las sesiones simuladas no separan el tiempo por sección), y de cada juego por separado.")
filas = []
fin_por_sec = {"Drinks": (sum(s["embudo"]["quiz_fin"] for s in S), sum(s["embudo"]["quiz_inicio"] for s in S), "terminó el quiz"),
               "La Peda": (sum(s["embudo"]["peda_resumen"] for s in S) + sum(s["embudo"]["cita_resultados"] for s in S), sum(1 for s in S if s.get("peda") or s.get("cita")), "llegó al resumen"),
               "Modo Antro": (sum(s["embudo"]["antro_ruleta"] for s in S), sum(s["embudo"]["antro_inicio"] for s in S), "llegó a la ruleta"),
               "Botella premiada": (sum(1 for p in pr if p["mostrado"]), len(pr), "vio su boleto")}
for k, v in seccion.items():
    if k == "Inicio": continue
    t = fin_por_sec.get(k); i = len(filas) + 5
    filas.append([k, v["personas"], round(media(v["dur"]) or 0, 1), (t[1] if t else None), (t[0] if t else None), f"=IF(D{i}>0,E{i}/D{i},\"—\")" if t else "—", t[2] if t else ""])
for g, v in juegos.items():
    i = len(filas) + 5; filas.append(["   " + g, v["empezaron"], round(media(v["seg"]) or 0, 1), v["empezaron"], v["terminaron"], f"=IF(D{i}>0,E{i}/D{i},\"—\")", "terminó (resumen / explotó / eligió)"])
fin = tabla(ws, 4, 1, ["Sección / juego", "Personas", "Tiempo promedio (s)", "Empezaron", "Terminaron", "% que terminó", "Qué cuenta como terminar"], filas, pct_cols=("% que terminó",))
grafica(ws, "Personas por sección y juego", Reference(ws, min_col=1, min_row=5, max_row=fin), [(Reference(ws, min_col=2, min_row=4, max_row=fin), True)], "I4", "Personas", True, 18, 11)
ancho(ws, [30, 10, 14, 11, 11, 13, 34])

# ---- 8. Embudos ----
ws = hoja("Embudos"); titulo(ws, "Embudos · ¿hasta dónde llega la gente?", f"Solo las {len(S_OK)} sesiones que corrieron con la compu despierta (las suspendidas se cortaban por tiempo, no por la app).")
filas = []
for perfil, pasos_ in emb.items():
    for nm, n, tot in pasos_:
        i = len(filas) + 5; filas.append([perfil, nm, n, tot, f"=IF(D{i}>0,C{i}/D{i},\"—\")"])
fin = tabla(ws, 4, 1, ["Flujo", "Paso", "Personas", "De", "%"], filas, pct_cols=("%",))
grafica(ws, "Personas en cada paso", Reference(ws, min_col=2, min_row=5, max_row=fin), [(Reference(ws, min_col=3, min_row=4, max_row=fin), True)], "G4", "Personas", True, 18, 14)
ancho(ws, [38, 44, 10, 8, 10])

# ---- 9. Errores ----
ws = hoja("Errores"); titulo(ws, "Errores y fallas", f"Errores de JavaScript, acciones que no respondieron en 10 s, cosas que se salen de la pantalla y botones tapados. Sin las {len(S) - len(S_OK)} sesiones que corrieron con la compu suspendida.")
filas = [list(k) + [v] for k, v in errores.most_common()] or [["Ninguno", "", "", "", "", 0]]
fin = tabla(ws, 4, 1, ["Tipo", "Detalle", "Sección", "Celular", "Acción que lo causó", "Veces"], filas)
tip = collections.Counter(); [tip.__setitem__(k[0], tip[k[0]] + v) for k, v in errores.items()]
t0 = fin + 3; ws.cell(t0, 1, "Total por tipo").font = NEG
ft = tabla(ws, t0 + 1, 1, ["Tipo", "Veces"], [[k, v] for k, v in tip.items()] or [["Ninguno", 0]], filtro=False)
grafica(ws, "Fallas por tipo", Reference(ws, min_col=1, min_row=t0 + 2, max_row=ft), [(Reference(ws, min_col=2, min_row=t0 + 1, max_row=ft), True)], f"H{t0}", "Veces")
ancho(ws, [22, 60, 20, 18, 30, 8])

# ---- 10. Celulares ----
ws = hoja("Celulares"); titulo(ws, "Por modelo de celular", f"Carga medida en el servidor de prueba local; en la vida real depende de la señal. Sin las {len(S) - len(S_OK)} sesiones que corrieron con la compu suspendida.")
filas = []
for k, v in porcel.items():
    i = len(filas) + 5; filas.append([k, v["sesiones"], v["con_error"], f"=IF(B{i}>0,C{i}/B{i},0)", v["errores"], v["atorados"], v["desbordes"], v["tapados"], round(media(v["carga"]) or 0), p95(v["carga"]) or 0])
fin = tabla(ws, 4, 1, ["Celular", "Sesiones", "Con error JS", "% con error", "Errores JS", "No respondió", "Se sale de pantalla", "Tapados", "Carga promedio (ms)", "Carga p95 (ms)"], filas, pct_cols=("% con error",))
grafica(ws, "Problemas por celular (no respondió + tapados + se sale)", Reference(ws, min_col=1, min_row=5, max_row=fin), [(Reference(ws, min_col=6, min_row=4, max_row=fin), True), (Reference(ws, min_col=7, min_row=4, max_row=fin), True), (Reference(ws, min_col=8, min_row=4, max_row=fin), True)], "B12", "Veces")
ancho(ws, [20, 10, 12, 12, 11, 12, 14, 9, 16, 14])

# ---- 11. Premios ----
ws = hoja("Premios"); titulo(ws, "Botellas premiadas", "Códigos probados con ?premio= en el servidor de prueba.")
filas = [["Códigos VÁLIDOS probados", premios["validos"]], ["Válidos que la app aceptó", premios["validos_ok"]], ["Códigos FALSOS probados", premios["invalidos"]],
         ["Falsos que la app aceptó por error (debe ser 0)", premios["invalidos_aceptados"]], ["Falsos que quedaron en «Mis premios» (debe ser 0)", premios["invalidos_en_mis_premios"]]]
fin = tabla(ws, 4, 1, ["Prueba", "Cantidad"], filas, filtro=False)
t0 = fin + 3; ws.cell(t0, 1, "Por tipo de código → lo que mostró la app").font = NEG
ft = tabla(ws, t0 + 1, 1, ["Tipo → mostró", "Veces"], [[k, v] for k, v in premios["por_tipo"].most_common()])
grafica(ws, "Códigos por tipo y resultado", Reference(ws, min_col=1, min_row=t0 + 2, max_row=ft), [(Reference(ws, min_col=2, min_row=t0 + 1, max_row=ft), True)], "E4", "Veces", True)
ancho(ws, [50, 12])
wb.save(os.path.join(SAL, "analitica_palma_blanca.xlsx"))

# ---- resultados.csv (sin los códigos completos) ----
with open(os.path.join(SAL, "resultados.csv"), "w", newline="", encoding="utf-8-sig") as f:
    w = csv.writer(f); w.writerow(cab); w.writerows(filas_ses if (filas_ses := [r[:] for r in [[c.value for c in row] for row in wb["Sesiones"].iter_rows(min_row=4)]]) else [])
print("Listo: salida/analitica_palma_blanca.xlsx, salida/resultados.csv, salida/analisis.json")

# =====================================================================
#   REPORTE HTML
# =====================================================================
E = lambda x: html.escape(str(x if x is not None else ""))
def barras(titulo_b, sub, filas_b, veredicto=None, fmt=lambda v: f"{v:,}"):
    mx = max([max(o, e or 0) for _, o, e in filas_b] + [1])
    hay_esp = any(e is not None for _, _, e in filas_b)
    out = [f'<figure class="graf"><figcaption><b>{E(titulo_b)}</b><span>{E(sub)}</span></figcaption>']
    if hay_esp: out.append('<div class="leyenda"><span><i class="sw-barra"></i>Real</span><span><i class="sw-esp"></i>Esperado si es justo</span></div>')
    out.append('<div class="filas">')
    for k, o, e in filas_b:
        tip = f"{k}: {fmt(o)}" + (f" · esperado {fmt(round(e, 1)) if isinstance(e, (int, float)) else e}" if e is not None else "")
        out.append(f'<div class="fila" tabindex="0" data-tip="{E(tip)}"><span class="et">{E(k)}</span><span class="pista"><span class="barra" style="width:{o / mx * 100:.2f}%"></span>' + (f'<span class="esp" style="left:{e / mx * 100:.2f}%"></span>' if e is not None else "") + f'</span><span class="num">{E(fmt(o))}</span></div>')
    out.append("</div>")
    if veredicto: out.append(f'<p class="veredicto {"bien" if "pareja" in veredicto.lower() else "mal" if "sesgo" in veredicto.lower() and "posible" not in veredicto.lower() else "neutro"}">{E(veredicto)}</p>')
    out.append("</figure>"); return "".join(out)
def tabla_h(cab, filas_t): return '<div class="tabla"><table><tr>' + "".join(f"<th>{E(c)}</th>" for c in cab) + "</tr>" + "".join("<tr>" + "".join(f"<td>{E(c)}</td>" for c in f) + "</tr>" for f in filas_t) + "</table></div>"
rn = ruleta.get("normal"); partes = []
if rn: partes.append(barras(f"Ruleta del Modo Antro · {rn['n']:,} tiros (modo normal)", "veces que salió cada espacio", [(f["espacio"], f["veces"], (f["esperado_pct"] or 0) * rn["n"]) for f in rn["filas"]], rn["chi"]["veredicto"] + f" (p = {rn['chi']['p']})"))
for m in ("15 min después de un shot", "Hoy no tomo"):
    v = ruleta.get(m)
    if v: partes.append(barras(f"Ruleta del Antro · {m}", f"{v['n']:,} tiros", [(f["espacio"], f["veces"], (f["esperado_pct"] or 0) * v["n"]) for f in v["filas"]], v["chi"]["veredicto"] + f" (p = {v['chi']['p']})"))
cs = chi2(slot_obs, slot_esp); partes.append(barras(f"Drink del día · {slot_n:,} giros", f"repitió el mismo drink {slot_rep} veces", [(d, slot_obs.get(d, 0), slot_esp[d]) for d in DRINKS], cs["veredicto"] + f" (p = {cs['p']})"))
cj = chi2(jg_obs, jg_esp); partes.append(barras(f"Ruleta de «¿A ver qué te toca?» · {jg_n:,} giros", "", [(j, jg_obs.get(j, 0), jg_esp[j]) for j in JUEGOS], cj["veredicto"] + f" (p = {cj['p']})"))
for n, v in sorted(dedos.items()): partes.append(barras(f"El Dedo con {n} jugadores · {v['eligio']:,} rondas", "Dedo 1 = el primero en tocar", [(f"Dedo {i}", v["obs"].get(i, 0), v["eligio"] / n) for i in range(1, n + 1)], v["chi"]["veredicto"] + f" (p = {v['chi']['p']})"))
cb = chi2(bot_pone, {i: len(bot) / 8 for i in range(8)}); partes.append(barras(f"Gira la Botella · {len(bot):,} giros (a quién apunta en el 1er giro)", "8 zonas de 45°", [(f"Zona {i + 1}", bot_pone.get(i, 0), len(bot) / 8) for i in range(8)], f"Es pareja: la app elige la dirección totalmente al azar; la p = {cb['p']} es suerte del muestreo"))
reg_tab = tabla_h(["Modo", "Tiros", "Veces que salió el regalo", "Sale cada … tiros", "Racha más larga sin regalo", "Racha más larga seguido"], [[m, f"{v['n']:,}", v["regalo"]["veces"], v["regalo"]["cada"] or "—", v["regalo"]["racha_sin"], v["regalo"]["racha_seguida"]] for m, v in ruleta.items()])
ab = AB or {}
abuso_tab = tabla_h(["Prueba", "Resultado"], [["Mismo celular recargando 10 veces → tickets", ab.get("mismo_cel_10_intentos", {}).get("tickets_nuevos", "—")], ["Borrando datos / incógnito, 40 intentos → tickets", ab.get("datos_borrados_40_intentos", {}).get("tickets_nuevos", "—")], ["Pedir el ticket sin girar la ruleta", "Sí se puede" if ab.get("sin_girar_la_ruleta") else "No"], ["Marcar como entregado sin PIN del staff", "Sí se puede" if (ab.get("marcar_entregado_sin_pin") or {}).get("quedo_reclamado") else "No"]])
sec_b = barras("Personas por sección", f"{len(S)} personas simuladas", [(k, v["personas"], None) for k, v in seccion.items() if k != "Inicio"])
jue_b = barras("Juegos de «¿A ver qué te toca?»: empezaron vs terminaron", "la rayita es cuántos empezaron", [(g, v["terminaron"], v["empezaron"]) for g, v in juegos.items()])
emb_tab = tabla_h(["Flujo", "Paso", "Personas", "%"], [[p, nm, n, f"{(n / tot * 100) if tot else 0:.0f}%"] for p, ps in emb.items() for nm, n, tot in ps])
cel_tab = tabla_h(["Celular", "Sesiones", "Con error JS", "No respondió", "Se sale", "Tapados", "Carga prom. (ms)", "Carga p95 (ms)"], [[k, v["sesiones"], v["con_error"], v["atorados"], v["desbordes"], v["tapados"], round(media(v["carga"]) or 0), p95(v["carga"]) or 0] for k, v in porcel.items()])
err_tab = tabla_h(["Tipo", "Detalle", "Sección", "Celular", "Acción", "Veces"], [list(k) + [v] for k, v in errores.most_common(20)]) if errores else '<p class="nota">Ninguna falla.</p>'
pre_tab = tabla_h(["Prueba", "Cantidad"], [["Válidos probados / aceptados", f'{premios["validos"]} / {premios["validos_ok"]}'], ["Falsos probados", premios["invalidos"]], ["Falsos aceptados por error", premios["invalidos_aceptados"]], ["Falsos en «Mis premios»", premios["invalidos_en_mis_premios"]]])
hall_h = "".join(f'<article class="g-{E(h.get("gravedad", "media"))}"><h3>{i + 1}. {E(h["titulo"])}<span class="etq">Gravedad {E(h.get("gravedad", "media"))}</span></h3><dl><dt>Qué pasa</dt><dd>{E(h["que"])}</dd><dt>En qué celular</dt><dd>{E(h["celular"])}</dd><dt>Cómo reproducirlo</dt><dd>{E(h["reproducir"])}</dd><dt>Corrección propuesta</dt><dd>{E(h["correccion"])}</dd></dl></article>' for i, h in enumerate(HALL[:5]))
css = open(os.path.join(AQUI, "reporte.css"), encoding="utf-8").read() if os.path.exists(os.path.join(AQUI, "reporte.css")) else ""
pagina = f"""<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Analítica Palma Blanca</title><style>{css}</style></head><body><main>
<h1>Analítica de la app Palma Blanca</h1><p class="sub">{len(S):,} personas simuladas en celulares y {tiros_tot:,} tiros de ruletas con la lógica de la app · {datetime.date.today().strftime("%d/%m/%Y")} · servidor de prueba local</p>
<div class="kpis"><div class="kpi"><b>{normal['regalo']['veces']}</b><span>veces que salió el regalo en 10,000 tiros (esperado ~100)</span></div><div class="kpi"><b>{pct_err * 100:.1f}%</b><span>personas con error de JavaScript</span></div>
<div class="kpi"><b>{E(sec_mas)}</b><span>sección más usada</span></div><div class="kpi"><b>{E(cel_peor)}</b><span>celular con más problemas</span></div><div class="kpi"><b>{premios['invalidos_aceptados']}</b><span>códigos falsos aceptados (debe ser 0)</span></div></div>
<h2>Lo más importante</h2><div class="hall">{hall_h or '<p class="nota">Pendiente.</p>'}</div>
<h2>¿Las ruletas son justas?</h2><p class="nota">La barra es cuántas veces salió; la rayita, cuántas veces debería salir si es justa (con las reglas de la app: pesos, no repetir, 15 min sin shots).</p><div class="grid2">{''.join(partes)}</div>
<h2>El regalo</h2>{reg_tab}<h3>¿Cuántos regalos puede sacar una persona?</h3>{abuso_tab}
<h2>¿Qué usa la gente?</h2><div class="grid2">{sec_b}{jue_b}</div><h3>Embudos</h3>{emb_tab}
<h2>Errores y celulares</h2>{cel_tab}<h3>Fallas encontradas</h3>{err_tab}
<h2>Botellas premiadas</h2>{pre_tab}
<h2>Cómo se hizo</h2><p class="nota">Ruletas: 10,000 tiros de cada una llamando a las funciones de la app en el navegador (ruleta del Antro) o usando sus botones con el reloj adelantado (drink del día, ruleta de juegos, El Dedo, botella). Personas: Playwright con Chrome sin ventana emulando iPhone 13, iPhone SE, Pixel 7, Galaxy S8 y Android de 360 px con pantalla táctil; esperas humanas de 0.3 a 3 s; 20% regresa con su memoria del navegador. La computadora se suspendió mientras corrían las sesiones 200–499: sus recorridos y resultados sí cuentan, pero sus fallas y tiempos no. Los iPhone se imitan con Chrome: fallas exclusivas de Safari no aparecen. Para repetir: <code>node ruletas.mjs</code>, <code>node simular.mjs</code>, <code>node regalo-abuso.mjs</code> y <code>python3 analizar.py</code> en la carpeta pruebas.</p>
</main><div id="tip" role="tooltip"></div><script>const tip=document.getElementById("tip");function ver(e){{const f=e.target.closest("[data-tip]");if(!f){{tip.style.opacity=0;return}}tip.textContent=f.dataset.tip;const r=f.getBoundingClientRect();tip.style.left=Math.min(innerWidth-270,Math.max(8,(e.clientX||r.left)+12))+"px";tip.style.top=((e.clientY||r.top)+16)+"px";tip.style.opacity=1}}document.addEventListener("mousemove",ver);document.addEventListener("focusin",ver);</script></body></html>"""
open(os.path.join(SAL, "reporte.html"), "w", encoding="utf-8").write(pagina)
print("Listo: salida/reporte.html")
