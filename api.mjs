import { getStore } from "@netlify/blobs";
import {
  createHmac,
  timingSafeEqual,
  randomBytes,
  scryptSync,
} from "node:crypto";
import seedState from "./seed-data.mjs";

const KPI_PARAMS = [
  { key: "collectionRate", label: "Collection Rate", direction: "higher", target: 0.98, weight: 0.30, formula: "Sudah Bayar ÷ (Total Pembelian − Cash)" },
  { key: "piutangBelumLunasRatio", label: "Piutang Belum Lunas / Penjualan", direction: "lower", target: 0.20, weight: 0.15, formula: "(Blm Jth Tempo + C1 + C2) ÷ Penjualan periode" },
  { key: "over30Ratio", label: "Overdue >30 Hari", direction: "lower", target: 0.40, weight: 0.20, formula: "(C3 + C4 + C5 + C6) ÷ Grand Total Piutang" },
  { key: "over120Ratio", label: "Overdue >120 Hari", direction: "lower", target: 0.30, weight: 0.25, formula: "C6 ÷ Grand Total Piutang" },
  { key: "c1Ratio", label: "Invoice 1–14 Hari", direction: "lower", target: 0.12, weight: 0.10, formula: "C1 ÷ Grand Total Piutang" },
];
const BUCKETS = ["Blm Jth Tempo","C1 (1-14)","C2 (15-30)","C3 (31-60)","C4 (61-90)","C5 (91-120)","C6 (>120)"];
const MAX_HISTORY = 1000;

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}
function cleanPath(url) {
  const u = new URL(url);
  const route = u.searchParams.get("route");
  return route || "/";
}
function store() {
  return getStore({ name: "piutang-dashboard", consistency: "strong" });
}
async function loadState() {
  const s = await store().get("state", { type: "json", consistency: "strong" });
  return s || seedState;
}
async function loadManual() {
  return (await store().get("manual-history", { type: "json", consistency: "strong" })) || {};
}
async function loadUsers() {
  return (await store().get("users", { type: "json", consistency: "strong" })) || [];
}
function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function emptyAgg() {
  const x = { salesPeriod: 0, totalPembelian: 0, cash: 0, sudahBayar: 0, piutang: 0 };
  for (const b of BUCKETS) x[b] = 0;
  return x;
}
function normalizeAgg(src = {}) {
  const x = emptyAgg();
  for (const k of Object.keys(x)) x[k] = safeNum(src[k]);
  return x;
}
function calcKpi(src = {}) {
  const a = normalizeAgg(src);
  const creditSales = Math.max(a.totalPembelian - a.cash, 0);
  const collectionRate = creditSales > 0 ? a.sudahBayar / creditSales : null;
  const belumLunas = a["Blm Jth Tempo"] + a["C1 (1-14)"] + a["C2 (15-30)"];
  const piutangBelumLunasRatio = a.salesPeriod > 0 ? belumLunas / a.salesPeriod : null;
  const over30 = a["C3 (31-60)"] + a["C4 (61-90)"] + a["C5 (91-120)"] + a["C6 (>120)"];
  const over30Ratio = a.piutang > 0 ? over30 / a.piutang : 0;
  const over120Ratio = a.piutang > 0 ? a["C6 (>120)"] / a.piutang : 0;
  const c1Ratio = a.piutang > 0 ? a["C1 (1-14)"] / a.piutang : 0;
  const actuals = { collectionRate, piutangBelumLunasRatio, over30Ratio, over120Ratio, c1Ratio };
  let totalScore = 0;
  const details = KPI_PARAMS.map(p => {
    const actual = actuals[p.key];
    let achievement = 0;
    if (actual !== null) {
      if (p.direction === "higher") achievement = p.target === 0 ? 1.2 : Math.min(actual / p.target, 1.2);
      else achievement = actual === 0 ? 1.2 : Math.min(p.target / actual, 1.2);
    }
    const weightedScore = achievement * p.weight * 100;
    totalScore += weightedScore;
    const status = achievement >= 1 ? "TERCAPAI" : achievement >= 0.9 ? "PERLU PERBAIKAN" : "BELUM TERCAPAI";
    return { ...p, actual, achievement, weightedScore, status };
  });
  const status = totalScore >= 105 ? "EXCELLENT" : totalScore >= 100 ? "TERCAPAI" : totalScore >= 90 ? "PERLU PERBAIKAN" : "BELUM TERCAPAI";
  return { totalScore, status, details, creditSales, belumLunas, over30 };
}
function roleCanUpload(role) { return role === "admin" || role === "company"; }
function sanitizeUser(u) {
  return { username: u.username, displayName: u.displayName || u.username, role: u.role, spv: u.spv || "", salesman: u.salesman || "", active: u.active !== false };
}
function b64url(data) { return Buffer.from(data).toString("base64url"); }
function sessionSecret() { return process.env.APP_SESSION_SECRET || ""; }
function signSession(profile) {
  const secret = sessionSecret();
  if (secret.length < 24) throw new Error("APP_SESSION_SECRET belum dikonfigurasi dengan aman.");
  const payload = { ...sanitizeUser(profile), exp: Date.now() + 12 * 60 * 60 * 1000 };
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}
function verifySession(token) {
  try {
    if (!token) return null;
    const [body, sig] = token.split(".");
    if (!body || !sig) return null;
    const expected = createHmac("sha256", sessionSecret()).update(body).digest("base64url");
    const a = Buffer.from(sig), b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!p.exp || p.exp < Date.now()) return null;
    return p;
  } catch { return null; }
}
function getCookie(req, name) {
  const raw = req.headers.get("cookie") || "";
  for (const p of raw.split(";")) {
    const [k, ...v] = p.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return "";
}
function requireAuth(req) {
  const p = verifySession(getCookie(req, "piutang_session"));
  if (!p) throw Object.assign(new Error("Sesi tidak valid atau sudah berakhir."), { status: 401 });
  return p;
}
function cookieHeader(token, clear = false) {
  const secure = process.env.CONTEXT !== "dev" ? "; Secure" : "";
  return `piutang_session=${clear ? "" : encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${clear ? 0 : 43200}${secure}`;
}
function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  return { salt, hash: scryptSync(password, salt, 64).toString("hex") };
}
function verifyPassword(password, user) {
  try {
    const h = scryptSync(password, user.salt, 64);
    const expected = Buffer.from(user.passwordHash, "hex");
    return h.length === expected.length && timingSafeEqual(h, expected);
  } catch { return false; }
}
function validateOrigin(req) {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try { return new URL(origin).host === new URL(req.url).host; } catch { return false; }
}
async function readBody(req) {
  const text = await req.text();
  if (text.length > 4_000_000) throw Object.assign(new Error("Payload terlalu besar."), { status: 413 });
  return text ? JSON.parse(text) : {};
}
function normalizeState(input, user) {
  if (!input || input.version !== 1) throw Object.assign(new Error("Format upload dashboard tidak valid."), { status: 400 });
  if (!input.period?.year || !input.period?.month) throw Object.assign(new Error("Periode data tidak ditemukan."), { status: 400 });
  const spvs = Array.isArray(input.spvs) ? input.spvs.slice(0, 100).map(x => ({ spv: String(x.spv || "").trim(), ...normalizeAgg(x) })).filter(x => x.spv) : [];
  const sales = Array.isArray(input.sales) ? input.sales.slice(0, 1000).map(x => ({ spv: String(x.spv || "").trim(), salesman: String(x.salesman || "").trim(), ...normalizeAgg(x) })).filter(x => x.salesman) : [];
  const openInvoices = Array.isArray(input.openInvoices) ? input.openInvoices.slice(0, 10000).map(x => ({
    rowId: String(x.rowId || "").slice(0,300), tanggalFaktur: String(x.tanggalFaktur || "").slice(0,30), overdueHari: safeNum(x.overdueHari),
    klasifikasi: String(x.klasifikasi || "").slice(0,50), noSJ: String(x.noSJ || "").slice(0,100), noFaktur: String(x.noFaktur || "").slice(0,100),
    idCustomer: String(x.idCustomer || "").slice(0,100), customer: String(x.customer || "").slice(0,250), salesman: String(x.salesman || "").slice(0,250),
    spv: String(x.spv || "").slice(0,150), gudang: String(x.gudang || "").slice(0,150), totalPembelian: safeNum(x.totalPembelian), cash: safeNum(x.cash),
    sudahBayar: safeNum(x.sudahBayar), sisaPiutang: safeNum(x.sisaPiutang), historiSales: String(x.historiSales || "").slice(0,1000),
    historiKesimpulan: String(x.historiKesimpulan || "").slice(0,1000), historiTerupdate: String(x.historiTerupdate || "").slice(0,1000),
  })).filter(x => x.rowId && x.sisaPiutang > 0) : [];
  return {
    version: 1,
    sourceFile: String(input.sourceFile || "Upload Excel").slice(0,200),
    period: { year: Number(input.period.year), month: Number(input.period.month), label: String(input.period.label || "") },
    uploadedAt: new Date().toISOString(), uploadedBy: user.username,
    company: normalizeAgg(input.company), spvs, sales, openInvoices,
  };
}
function allowedScope(user, query) {
  let spv = query.get("spv") || "";
  let salesman = query.get("salesman") || "";
  if (user.role === "spv") {
    spv = user.spv;
    if (salesman && !salesman) salesman = "";
  }
  if (user.role === "sales") {
    spv = user.spv;
    salesman = user.salesman;
  }
  return { spv, salesman };
}
function ensureInvoiceAccess(user, inv) {
  if (user.role === "admin" || user.role === "company") return true;
  if (user.role === "spv") return inv.spv === user.spv;
  if (user.role === "sales") return inv.spv === user.spv && inv.salesman === user.salesman;
  return false;
}
async function scopedData(user, reqUrl) {
  const state = await loadState();
  const manual = await loadManual();
  const query = new URL(reqUrl).searchParams;
  const { spv, salesman } = allowedScope(user, query);

  let summaryRaw = state.company;
  if (salesman) summaryRaw = state.sales.find(x => x.spv === spv && x.salesman === salesman) || emptyAgg();
  else if (spv) summaryRaw = state.spvs.find(x => x.spv === spv) || emptyAgg();

  let salesRows = state.sales || [];
  if (spv) salesRows = salesRows.filter(x => x.spv === spv);
  if (salesman) salesRows = salesRows.filter(x => x.salesman === salesman);
  const salesPerformance = salesRows.map(x => ({ ...x, kpi: x.salesPeriod > 0 ? calcKpi(x) : null, legacy: x.salesPeriod <= 0 && x.piutang > 0 }));

  let invoices = state.openInvoices || [];
  if (spv) invoices = invoices.filter(x => x.spv === spv);
  if (salesman) invoices = invoices.filter(x => x.salesman === salesman);
  invoices = invoices.map(x => ({ ...x, manualHistory: manual[x.rowId] || null }));

  let spvOptions = (state.spvs || []).map(x => x.spv).filter(Boolean).sort((a,b)=>a.localeCompare(b));
  if (user.role === "spv" || user.role === "sales") spvOptions = spvOptions.filter(x => x === user.spv);
  let salesmanOptions = (state.sales || []).filter(x => !spv || x.spv === spv).map(x => x.salesman).filter(Boolean);
  salesmanOptions = [...new Set(salesmanOptions)].sort((a,b)=>a.localeCompare(b));
  if (user.role === "sales") salesmanOptions = salesmanOptions.filter(x => x === user.salesman);

  return {
    meta: { sourceFile: state.sourceFile, period: state.period, uploadedAt: state.uploadedAt, uploadedBy: state.uploadedBy, scope: { spv, salesman } },
    user: sanitizeUser(user),
    summary: { raw: summaryRaw, kpi: calcKpi(summaryRaw) },
    salesPerformance,
    invoices,
    options: { spvs: spvOptions, salesmen: salesmanOptions },
    kpiParameters: KPI_PARAMS,
  };
}

async function handleLogin(req) {
  if (!sessionSecret() || sessionSecret().length < 24) return json({ error: "APP_SESSION_SECRET belum di-set di Netlify." }, 503);
  const { username = "", password = "" } = await readBody(req);
  const u = String(username).trim();
  if (!u || !password) return json({ error: "Username dan password wajib diisi." }, 400);
  let profile = null;
  const adminUser = process.env.ADMIN_USERNAME || "";
  const adminPass = process.env.ADMIN_PASSWORD || "";
  if (adminUser && adminPass && u === adminUser && password === adminPass) {
    profile = { username: adminUser, displayName: "Administrator", role: "admin", spv: "", salesman: "", active: true };
  } else {
    const users = await loadUsers();
    const found = users.find(x => x.username === u && x.active !== false);
    if (found && verifyPassword(password, found)) profile = found;
  }
  if (!profile) return json({ error: "Username atau password salah." }, 401);
  const token = signSession(profile);
  return json({ ok: true, user: sanitizeUser(profile) }, 200, { "set-cookie": cookieHeader(token) });
}

async function handleUsers(req, user) {
  if (user.role !== "admin") return json({ error: "Hanya admin yang dapat mengelola user." }, 403);
  const s = store();
  const users = await loadUsers();
  if (req.method === "GET") return json({ users: users.map(sanitizeUser) });
  if (req.method === "POST") {
    const body = await readBody(req);
    const username = String(body.username || "").trim();
    const password = String(body.password || "");
    const role = String(body.role || "").trim();
    if (!/^[A-Za-z0-9._-]{3,40}$/.test(username)) return json({ error: "Username minimal 3 karakter, gunakan huruf/angka/._-." }, 400);
    if (password.length < 8) return json({ error: "Password minimal 8 karakter." }, 400);
    if (!["company","spv","sales"].includes(role)) return json({ error: "Role tidak valid." }, 400);
    if (users.some(x => x.username === username) || username === process.env.ADMIN_USERNAME) return json({ error: "Username sudah digunakan." }, 409);
    if (role === "spv" && !body.spv) return json({ error: "SPV wajib dipilih untuk role SPV." }, 400);
    if (role === "sales" && (!body.spv || !body.salesman)) return json({ error: "SPV dan salesman wajib dipilih untuk role Sales." }, 400);
    const hp = hashPassword(password);
    users.push({ username, displayName: String(body.displayName || username).slice(0,100), role, spv: String(body.spv || ""), salesman: String(body.salesman || ""), active: true, salt: hp.salt, passwordHash: hp.hash, createdAt: new Date().toISOString() });
    await s.setJSON("users", users);
    return json({ ok: true, users: users.map(sanitizeUser) });
  }
  if (req.method === "DELETE") {
    const username = new URL(req.url).searchParams.get("username") || "";
    const next = users.filter(x => x.username !== username);
    if (next.length === users.length) return json({ error: "User tidak ditemukan." }, 404);
    await s.setJSON("users", next);
    return json({ ok: true, users: next.map(sanitizeUser) });
  }
  return json({ error: "Method tidak didukung." }, 405);
}

export default async (req) => {
  try {
    const path = cleanPath(req.url);
    if (req.method !== "GET" && !validateOrigin(req)) return json({ error: "Origin request tidak valid." }, 403);

    if (path === "/health" && req.method === "GET") return json({ ok: true, service: "piutang-api" });
    if (path === "/login" && req.method === "POST") return await handleLogin(req);
    if (path === "/logout" && req.method === "POST") return json({ ok: true }, 200, { "set-cookie": cookieHeader("", true) });

    const user = requireAuth(req);
    if (path === "/me" && req.method === "GET") return json({ user: sanitizeUser(user) });
    if (path === "/data" && req.method === "GET") return json(await scopedData(user, req.url));
    if (path === "/data" && req.method === "POST") {
      if (!roleCanUpload(user.role)) return json({ error: "Role ini tidak diizinkan meng-upload data." }, 403);
      const body = await readBody(req);
      const next = normalizeState(body, user);
      await store().setJSON("state", next);
      return json({ ok: true, meta: { sourceFile: next.sourceFile, period: next.period, uploadedAt: next.uploadedAt, uploadedBy: next.uploadedBy } });
    }
    if (path === "/history" && req.method === "POST") {
      const body = await readBody(req);
      const rowId = String(body.rowId || "");
      const text = String(body.text || "").trim().slice(0, MAX_HISTORY);
      if (!rowId) return json({ error: "Invoice tidak valid." }, 400);
      const state = await loadState();
      const inv = (state.openInvoices || []).find(x => x.rowId === rowId);
      if (!inv) return json({ error: "Invoice tidak ditemukan pada data terbaru." }, 404);
      if (!ensureInvoiceAccess(user, inv)) return json({ error: "Anda tidak berhak mengubah invoice ini." }, 403);
      const manual = await loadManual();
      if (text) manual[rowId] = { text, updatedAt: new Date().toISOString(), updatedBy: user.username };
      else delete manual[rowId];
      await store().setJSON("manual-history", manual);
      return json({ ok: true, manualHistory: manual[rowId] || null });
    }
    if (path === "/users") return await handleUsers(req, user);
    return json({ error: "Endpoint tidak ditemukan." }, 404);
  } catch (err) {
    console.error(err);
    return json({ error: err?.message || "Terjadi kesalahan server." }, err?.status || 500);
  }
};
