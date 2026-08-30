import { useState, useEffect, useRef, useCallback } from "react";
import {
  ShieldCheck, LayoutDashboard, ClipboardList, History, Camera, MapPin,
  Building2, Video, PhoneCall, AlertTriangle, LogOut, ChevronRight,
  CheckCircle2, Clock, Users, FileWarning, PlusCircle, Shuffle,
  Fingerprint, ArrowLeft, ArrowRight, Inbox, Settings as Settings2, Loader2
} from "lucide-react";

/* ---------------------------------------------------------
   BACKEND CONNECTION
   Change API_BASE to your deployed Render URL when you host it.
   Local dev default assumes `uvicorn main:app --reload` on :8000
--------------------------------------------------------- */
const API_BASE = "https://nigrani-setu-backend.onrender.com";
const WS_BASE = API_BASE.replace(/^http/, "ws");

async function apiRequest(path, { method = "GET", token, body, isForm = false } = {}) {
  const headers = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (body && !isForm) headers["Content-Type"] = "application/json";

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  });

  if (!res.ok) {
    let detail = "Something went wrong";
    try { detail = (await res.json()).detail || detail; } catch (_) {}
    throw new Error(detail);
  }
  if (res.status === 204) return null;
  return res.json();
}

/* ---------------------------------------------------------
   DESIGN TOKENS — unchanged from the approved UI/UX pass
--------------------------------------------------------- */
const FONT_IMPORT = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap');
`;

function Stamp({ status }) {
  const map = {
    verified: { label: "Verified", color: "#2F6B4F", rotate: "-6deg" },
    flagged: { label: "Flagged", color: "#B33A2E", rotate: "5deg" },
    pending: { label: "Pending", color: "#8A6D1D", rotate: "-3deg" },
  };
  const s = map[status] || map.pending;
  return (
    <div className="inline-flex items-center justify-center border-2 rounded-full px-3 py-1 select-none"
      style={{ borderColor: s.color, color: s.color, transform: `rotate(${s.rotate})`, borderStyle: "dashed", fontFamily: "'JetBrains Mono', monospace" }}>
      <span className="text-[10px] font-semibold tracking-[0.15em] uppercase">{s.label}</span>
    </div>
  );
}

function AuditTag({ children }) {
  return <span className="text-[11px] text-slate-500 tracking-wide" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{children}</span>;
}

function TopClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  return (
    <div className="flex items-center gap-2 text-slate-400">
      <Clock size={14} />
      <AuditTag>{now.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</AuditTag>
    </div>
  );
}

function EmptyState({ icon: Icon, title, sub }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 bg-white rounded-2xl border border-dashed border-stone-300">
      <Icon size={28} className="text-slate-300 mb-3" />
      <p className="text-sm font-medium text-slate-600">{title}</p>
      {sub && <p className="text-xs text-slate-400 mt-1 max-w-xs">{sub}</p>}
    </div>
  );
}

function ErrorBanner({ message }) {
  if (!message) return null;
  return (
    <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2 mb-4">
      {message}
    </div>
  );
}

/* ---------------------------------------------------------
   LANDING
--------------------------------------------------------- */
function Landing({ onEnter }) {
  const portals = [
    { id: "inspector", label: "Inspector Portal", icon: ClipboardList, sub: "File inspection reports from the field" },
    { id: "department", label: "Department Portal", icon: LayoutDashboard, sub: "Monitor institutes in real time" },
    { id: "admin", label: "Admin Portal", icon: Settings2, sub: "Register institutes, inspectors, run assignments" },
  ];
  return (
    <div className="min-h-screen bg-stone-100 flex flex-col items-center justify-center px-6">
      <div className="w-14 h-14 rounded-2xl bg-slate-900 flex items-center justify-center mb-4"><ShieldCheck size={26} color="#E8A33D" /></div>
      <h1 className="text-2xl font-semibold text-slate-900" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Nigrani Setu</h1>
      <p className="text-slate-500 text-sm mt-1 mb-10 text-center max-w-sm">DoSJE Real-Time Monitoring &amp; Inspection Platform — choose your portal to continue</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-3xl">
        {portals.map((p) => {
          const Icon = p.icon;
          return (
            <button key={p.id} onClick={() => onEnter(p.id)} className="bg-white border border-stone-200 rounded-2xl p-6 text-left hover:border-slate-900 hover:shadow-sm transition-all flex flex-col gap-3">
              <div className="w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center"><Icon size={18} className="text-slate-700" /></div>
              <div><p className="text-sm font-semibold text-slate-900">{p.label}</p><p className="text-xs text-slate-500 mt-0.5">{p.sub}</p></div>
              <span className="flex items-center gap-1 text-xs text-slate-400 mt-auto">Continue <ArrowRight size={12} /></span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   AUTH SCREEN — now calls the real backend
--------------------------------------------------------- */
function AuthScreen({ role, onBack, onAuthed }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [loginId, setLoginId] = useState("");
  const [district, setDistrict] = useState("");
  const [division, setDivision] = useState("Elderly Care Division");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const roleMeta = {
    inspector: { title: "Inspector", allowSignup: true, idLabel: "Inspector ID" },
    department: { title: "Department Official", allowSignup: true, idLabel: "Official ID" },
    admin: { title: "Admin", allowSignup: false, idLabel: "Admin ID" },
  }[role];

  const canSubmit = mode === "login" ? loginId && password : name && loginId && password;

  async function handleSubmit() {
    setError(""); setLoading(true);
    try {
      const path = mode === "login" ? "/auth/login" : `/auth/signup/${role}`;
      const body = mode === "login"
        ? { login_id: loginId, password }
        : { name, login_id: loginId, password, district: role === "inspector" ? district : undefined, division: role === "department" ? division : undefined };
      const data = await apiRequest(path, { method: "POST", body });
      onAuthed(data.user, data.access_token);
    } catch (e) {
      setError(e.message || "Could not reach the server — is the backend running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-stone-100 flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-slate-500 mb-6 hover:text-slate-800"><ArrowLeft size={14} /> All portals</button>
        <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm">
          <p className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 inline-block px-2.5 py-1 rounded-full uppercase tracking-wide mb-3">{roleMeta.title} Portal</p>

          {roleMeta.allowSignup ? (
            <div className="flex border-b border-stone-200 mb-5">
              {["login", "signup"].map((m) => (
                <button key={m} onClick={() => { setMode(m); setError(""); }} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${mode === m ? "border-slate-900 text-slate-900" : "border-transparent text-slate-400"}`}>
                  {m === "login" ? "Sign in" : "Create account"}
                </button>
              ))}
            </div>
          ) : (
            <h3 className="text-lg font-semibold text-slate-900 mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Admin sign in</h3>
          )}

          {!roleMeta.allowSignup && <p className="text-xs text-slate-400 mb-4">Admin accounts are provisioned internally via the backend and can't be self-registered from this screen.</p>}

          <ErrorBanner message={error} />

          {mode === "signup" && roleMeta.allowSignup && (
            <>
              <label className="block text-xs font-medium text-slate-500 mb-1">Full name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-slate-900" placeholder="e.g. Ramesh Kumar" />
            </>
          )}

          <label className="block text-xs font-medium text-slate-500 mb-1">{roleMeta.idLabel}</label>
          <input value={loginId} onChange={(e) => setLoginId(e.target.value)} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-slate-900" placeholder={mode === "signup" ? "Choose an ID" : "Enter your ID"} />

          {mode === "signup" && role === "inspector" && (
            <>
              <label className="block text-xs font-medium text-slate-500 mb-1">Assigned district</label>
              <input value={district} onChange={(e) => setDistrict(e.target.value)} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-slate-900" placeholder="e.g. Muzaffarpur" />
            </>
          )}

          {mode === "signup" && role === "department" && (
            <>
              <label className="block text-xs font-medium text-slate-500 mb-1">Division</label>
              <select value={division} onChange={(e) => setDivision(e.target.value)} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-slate-900">
                <option>Elderly Care Division</option><option>Disability Welfare Division</option><option>Skill Development Division</option>
              </select>
            </>
          )}

          <label className="block text-xs font-medium text-slate-500 mb-1">Password</label>
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm mb-5 focus:outline-none focus:ring-2 focus:ring-slate-900" placeholder="••••••••" />

          <button disabled={!canSubmit || loading} onClick={handleSubmit}
            className={`w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium ${canSubmit && !loading ? "bg-slate-900 text-white hover:bg-slate-800" : "bg-stone-200 text-stone-400 cursor-not-allowed"}`}>
            {loading && <Loader2 size={15} className="animate-spin" />}
            {mode === "login" ? "Sign in" : "Create account & continue"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   SHELL
--------------------------------------------------------- */
function Shell({ title, subtitle, navItems, activePage, setActivePage, onLogout, children }) {
  return (
    <div className="min-h-screen bg-stone-100 flex" style={{ fontFamily: "'Inter', sans-serif" }}>
      <aside className="w-60 bg-slate-900 text-slate-300 flex flex-col shrink-0">
        <div className="flex items-center gap-2 px-5 py-5 border-b border-slate-800">
          <ShieldCheck size={20} color="#E8A33D" />
          <span className="text-white font-semibold text-sm tracking-wide" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Nigrani Setu</span>
        </div>
        <nav className="flex-1 py-4 px-3 flex flex-col gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activePage === item.id;
            return (
              <button key={item.id} onClick={() => setActivePage(item.id)} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-left ${active ? "bg-slate-800 text-white" : "hover:bg-slate-800/60 text-slate-400"}`}>
                <Icon size={16} color={active ? "#E8A33D" : "#94a3b8"} />{item.label}
              </button>
            );
          })}
        </nav>
        <div className="px-3 pb-4">
          <button onClick={onLogout} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:bg-slate-800/60 w-full"><LogOut size={16} /> Log out</button>
        </div>
      </aside>
      <main className="flex-1 min-w-0">
        <header className="h-16 bg-white border-b border-stone-200 flex items-center justify-between px-8">
          <div><h2 className="text-lg font-semibold text-slate-900" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{title}</h2>{subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}</div>
          <TopClock />
        </header>
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}

/* ---------------------------------------------------------
   INSPECTOR PORTAL — real API calls
--------------------------------------------------------- */
function InspectorPortal({ account, token, onLogout }) {
  const [page, setPage] = useState("home");
  const [assignment, setAssignment] = useState(undefined); // undefined = loading, null = none
  const [reports, setReports] = useState([]);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(null);

  const [beneficiariesPresent, setBeneficiariesPresent] = useState("");
  const [attendance, setAttendance] = useState(null);
  const [hygiene, setHygiene] = useState("Good");
  const [notes, setNotes] = useState("");
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [coords, setCoords] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  const navItems = [
    { id: "home", label: "Home", icon: LayoutDashboard },
    { id: "form", label: "Inspection Form", icon: ClipboardList },
    { id: "history", label: "History", icon: History },
  ];

  const loadAssignment = useCallback(async () => {
    try {
      const data = await apiRequest("/assignments/mine", { token });
      setAssignment(data);
    } catch (e) { setError(e.message); }
  }, [token]);

  const loadHistory = useCallback(async () => {
    try {
      const data = await apiRequest("/reports/mine", { token });
      setReports(data);
    } catch (e) { setError(e.message); }
  }, [token]);

  useEffect(() => { loadAssignment(); }, [loadAssignment]);
  useEffect(() => { if (page === "history") loadHistory(); }, [page, loadHistory]);

  function handleCapture(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => setCoords(null)
      );
    }
  }

  async function handleSubmit() {
    setSubmitting(true); setError("");
    try {
      const form = new FormData();
      form.append("institute_id", assignment.institute_id);
      form.append("beneficiaries_present", beneficiariesPresent);
      form.append("attendance_status", attendance);
      form.append("hygiene", hygiene);
      form.append("notes", notes || "");
      if (coords) { form.append("latitude", coords.lat); form.append("longitude", coords.lng); }
      form.append("photo", photoFile);

      const report = await apiRequest("/reports", { method: "POST", token, body: form, isForm: true });
      setSubmitted(report);
      setAssignment(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setPage("home"); setSubmitted(null); setPhotoFile(null); setPhotoPreview(null);
    setCoords(null); setBeneficiariesPresent(""); setAttendance(null); setNotes("");
  }

  return (
    <Shell title="Inspector Portal" subtitle={`Signed in as ${account.name}`} navItems={navItems} activePage={page} setActivePage={setPage} onLogout={onLogout}>
      <ErrorBanner message={error} />

      {page === "home" && (
        <div className="max-w-2xl">
          {assignment === undefined ? (
            <div className="flex items-center gap-2 text-slate-400 text-sm"><Loader2 size={16} className="animate-spin" /> Checking for an assignment…</div>
          ) : !assignment ? (
            <EmptyState icon={Inbox} title="No inspection assigned yet" sub="The Admin's random assignment engine will place a draw here once it runs." />
          ) : (
            <div className="bg-white rounded-2xl border border-stone-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full uppercase tracking-wide">Assigned — random draw</span>
                <AuditTag>{assignment.id}</AuditTag>
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{assignment.institute_name}</h3>
              <p className="text-sm text-slate-500 mb-5">Window: {assignment.window}</p>
              <button onClick={() => setPage("form")} className="bg-slate-900 text-white px-5 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-slate-800">Start inspection <ChevronRight size={15} /></button>
            </div>
          )}
        </div>
      )}

      {page === "form" && !submitted && assignment && (
        <div className="max-w-2xl">
          <button onClick={() => setPage("home")} className="flex items-center gap-1 text-sm text-slate-500 mb-4 hover:text-slate-800"><ArrowLeft size={14} /> Back</button>
          <div className="bg-white rounded-2xl border border-stone-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Inspection checklist</h3>
            <p className="text-sm text-slate-500 mb-6">{assignment.institute_name}</p>

            <div className="mb-5">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Beneficiaries physically present</label>
              <input type="number" value={beneficiariesPresent} onChange={(e) => setBeneficiariesPresent(e.target.value)} placeholder="Enter count" className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
            </div>

            <div className="mb-5">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Staff attendance verified</label>
              <div className="flex gap-3">
                <button onClick={() => setAttendance("matches")} className={`flex-1 border rounded-lg py-2 text-sm ${attendance === "matches" ? "border-slate-900 bg-slate-900 text-white" : "border-stone-300 text-slate-600 hover:border-slate-900"}`}>Matches register</button>
                <button onClick={() => setAttendance("discrepancy")} className={`flex-1 border rounded-lg py-2 text-sm ${attendance === "discrepancy" ? "border-red-600 bg-red-600 text-white" : "border-stone-300 text-slate-600 hover:border-slate-900"}`}>Discrepancy found</button>
              </div>
            </div>

            <div className="mb-5">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Hygiene &amp; facility condition</label>
              <select value={hygiene} onChange={(e) => setHygiene(e.target.value)} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-900">
                <option>Good</option><option>Needs attention</option><option>Poor</option>
              </select>
            </div>

            <div className="mb-5">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Add any observations" className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Evidence capture</label>
              <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleCapture} className="hidden" />
              <button onClick={() => fileInputRef.current?.click()} className={`w-full border-2 border-dashed rounded-xl py-8 flex flex-col items-center gap-2 transition-colors overflow-hidden ${photoFile ? "border-emerald-400 bg-emerald-50" : "border-stone-300 hover:border-slate-500"}`}>
                {photoFile ? (
                  <>
                    <img src={photoPreview} alt="captured" className="h-20 rounded-lg object-cover" />
                    <span className="text-sm text-emerald-700 font-medium flex items-center gap-1"><CheckCircle2 size={15} /> Photo captured</span>
                  </>
                ) : (<><Camera size={22} className="text-slate-400" /><span className="text-sm text-slate-500">Open camera to capture photo</span></>)}
              </button>
              {photoFile && (
                <div className="flex items-center gap-2 mt-2 text-slate-500">
                  <MapPin size={13} />
                  <AuditTag>{coords ? `${coords.lat.toFixed(4)}°, ${coords.lng.toFixed(4)}°` : "Location unavailable — enable permission"}</AuditTag>
                </div>
              )}
              <p className="text-xs text-slate-400 mt-1">This opens your device camera directly (no gallery picker) so the photo and geo-tag stay authentic.</p>
            </div>

            <button onClick={handleSubmit} disabled={!photoFile || !beneficiariesPresent || !attendance || submitting}
              className={`w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium ${photoFile && beneficiariesPresent && attendance && !submitting ? "bg-slate-900 text-white hover:bg-slate-800" : "bg-stone-200 text-stone-400 cursor-not-allowed"}`}>
              {submitting && <Loader2 size={15} className="animate-spin" />} Submit report
            </button>
          </div>
        </div>
      )}

      {page === "form" && submitted && (
        <div className="max-w-lg">
          <div className="bg-white rounded-2xl border border-stone-200 p-8 flex flex-col items-center text-center">
            <CheckCircle2 size={40} className="text-emerald-600 mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Report submitted</h3>
            <AuditTag>{submitted.id} · logged {new Date(submitted.submitted_at).toLocaleString("en-IN")}</AuditTag>
            <p className="text-sm text-slate-500 mt-3 mb-6">Saved to the database and pushed to the Department dashboard in real time.</p>
            <button onClick={resetForm} className="bg-slate-900 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-800">Back to home</button>
          </div>
        </div>
      )}

      {page === "history" && (
        <div className="max-w-3xl">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Submitted reports</h3>
          {reports.length === 0 ? <EmptyState icon={History} title="No reports filed yet" /> : (
            <div className="flex flex-col gap-3">
              {reports.map((r) => (
                <div key={r.id} className="bg-white rounded-xl border border-stone-200 p-4 flex items-center justify-between">
                  <div><p className="text-sm font-medium text-slate-900">{r.institute_name}</p><AuditTag>{r.id} · {new Date(r.submitted_at).toLocaleString("en-IN")}</AuditTag></div>
                  <Stamp status={r.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Shell>
  );
}

/* ---------------------------------------------------------
   DEPARTMENT DASHBOARD — live via WebSocket
--------------------------------------------------------- */
function DepartmentDashboard({ account, token, onLogout }) {
  const [page, setPage] = useState("overview");
  const [institutes, setInstitutes] = useState([]);
  const [reports, setReports] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [vcOpen, setVcOpen] = useState(false);
  const [error, setError] = useState("");
  const [live, setLive] = useState(false);

  const navItems = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "institutes", label: "Institutes", icon: Building2 },
    { id: "alerts", label: "Alerts", icon: FileWarning },
  ];

  const loadAll = useCallback(async () => {
    try {
      const [inst, rep, alr] = await Promise.all([
        apiRequest("/institutes", { token }),
        apiRequest("/reports", { token }),
        apiRequest("/alerts", { token }),
      ]);
      setInstitutes(inst); setReports(rep); setAlerts(alr);
    } catch (e) { setError(e.message); }
  }, [token]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Real-time push — this is the WebSocket the backend's /ws/dashboard exposes
  useEffect(() => {
    const socket = new WebSocket(`${WS_BASE}/ws/dashboard?token=${token}`);
    socket.onopen = () => setLive(true);
    socket.onclose = () => setLive(false);
    socket.onmessage = (event) => {
      const { event: type, data } = JSON.parse(event.data);
      if (type === "new_report") setReports((prev) => [data, ...prev]);
      if (type === "new_alert") setAlerts((prev) => [data, ...prev]);
    };
    return () => socket.close();
  }, [token]);

  const selectedInstitute = institutes.find((i) => i.id === selectedId);
  const instituteReports = selectedInstitute ? reports.filter((r) => r.institute_id === selectedInstitute.id) : [];
  const latestReport = instituteReports[0];

  if (selectedInstitute) {
    return (
      <Shell title={selectedInstitute.name} subtitle={`Signed in as ${account.name}`} navItems={navItems} activePage={page} setActivePage={(p) => { setSelectedId(null); setPage(p); }} onLogout={onLogout}>
        <button onClick={() => setSelectedId(null)} className="flex items-center gap-1 text-sm text-slate-500 mb-5 hover:text-slate-800"><ArrowLeft size={14} /> Back to institutes</button>
        <div className="grid grid-cols-3 gap-5 mb-6">
          <div className="col-span-2 bg-white rounded-2xl border border-stone-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Latest inspection report</h3>
              {latestReport && <Stamp status={latestReport.status} />}
            </div>
            {latestReport ? (
              <>
                <AuditTag>{latestReport.id} · {latestReport.inspector_name} · {new Date(latestReport.submitted_at).toLocaleString("en-IN")}</AuditTag>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="bg-stone-50 rounded-xl p-3"><p className="text-xs text-slate-400 mb-1">Claimed present</p><p className="text-xl font-semibold text-slate-900" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{latestReport.beneficiaries_claimed}</p></div>
                  <div className="bg-stone-50 rounded-xl p-3"><p className="text-xs text-slate-400 mb-1">Reported present</p><p className={`text-xl font-semibold ${latestReport.status === "flagged" ? "text-red-600" : "text-slate-900"}`} style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{latestReport.beneficiaries_present}</p></div>
                </div>
                {latestReport.distance_from_institute_meters != null && (
                  <div className={`flex items-center gap-2 mt-3 text-xs rounded-lg px-3 py-2 ${latestReport.distance_from_institute_meters > 500 ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
                    <MapPin size={13} />
                    Evidence captured {Math.round(latestReport.distance_from_institute_meters)}m from registered site
                    {latestReport.distance_from_institute_meters > 500 ? " — outside 500m geofence" : " — within geofence"}
                  </div>
                )}
                {latestReport.photo_url && (
                  <img src={`${API_BASE}${latestReport.photo_url}`} alt="Field evidence" className="mt-4 rounded-xl w-full max-h-56 object-cover border border-stone-200" />
                )}
              </>
            ) : <EmptyState icon={Inbox} title="No inspection filed for this institute yet" />}
          </div>
          <div className="bg-white rounded-2xl border border-stone-200 p-5 flex flex-col items-center justify-center text-center">
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Compliance</p>
            <p className={`text-4xl font-semibold ${!latestReport ? "text-slate-300" : latestReport.status === "flagged" ? "text-red-600" : "text-emerald-600"}`} style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              {!latestReport ? "—" : latestReport.status === "flagged" ? "Flagged" : "Clean"}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-5">
          <div className="bg-white rounded-2xl border border-stone-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Live CCTV feed</h3>
              {selectedInstitute.rtsp_url ? <span className="flex items-center gap-1.5 text-xs text-red-600 font-medium"><span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" /> LIVE</span> : <span className="text-xs text-slate-400">Not configured</span>}
            </div>
            {selectedInstitute.rtsp_url ? (
              <div className="aspect-video bg-slate-900 rounded-xl flex flex-col items-center justify-center text-slate-500 gap-2"><Video size={26} /><span className="text-xs" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{selectedInstitute.rtsp_url}</span></div>
            ) : <EmptyState icon={Video} title="No CCTV source registered" sub="Ask Admin to add an RTSP URL for this institute." />}
          </div>
          <div className="bg-white rounded-2xl border border-stone-200 p-5">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Direct verification</h3>
            <p className="text-sm text-slate-600 mb-4">Call a randomly selected beneficiary or staff member to confirm the service is real.</p>
            <button onClick={() => setVcOpen(true)} className="flex items-center justify-center gap-2 w-full bg-slate-900 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-slate-800"><PhoneCall size={15} /> Call a random beneficiary</button>
          </div>
        </div>
        {vcOpen && (
          <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm text-center">
              <div className="w-16 h-16 rounded-full bg-stone-100 mx-auto mb-4 flex items-center justify-center"><Users size={26} className="text-slate-500" /></div>
              <p className="text-sm text-slate-400 mb-1">Connecting to a randomly selected contact for</p>
              <p className="text-base font-semibold text-slate-900 mb-4">{selectedInstitute.name}</p>
              <button onClick={() => setVcOpen(false)} className="mt-2 w-full bg-red-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-red-700">End call</button>
            </div>
          </div>
        )}
      </Shell>
    );
  }

  return (
    <Shell title="Department Dashboard" subtitle={`Signed in as ${account.name} ${live ? "· live" : "· reconnecting…"}`} navItems={navItems} activePage={page} setActivePage={setPage} onLogout={onLogout}>
      <ErrorBanner message={error} />
      {page === "overview" && (
        <div>
          <div className="grid grid-cols-4 gap-4 mb-8">
            {[
              { label: "Total reports", value: reports.length, icon: ClipboardList },
              { label: "Institutes registered", value: institutes.length, icon: Building2 },
              { label: "Flagged", value: reports.filter((r) => r.status === "flagged").length, icon: FileWarning },
              { label: "Clean", value: reports.filter((r) => r.status === "verified").length, icon: CheckCircle2 },
            ].map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="bg-white rounded-2xl border border-stone-200 p-4">
                  <Icon size={16} className="text-slate-400 mb-2" />
                  <p className="text-2xl font-semibold text-slate-900" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{s.value}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
                </div>
              );
            })}
          </div>
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Recent reports</h3>
          {reports.length === 0 ? <EmptyState icon={Inbox} title="No reports yet" sub="Once an inspector files a report, it will show up here in real time." /> : (
            <div className="flex flex-col gap-3">
              {reports.map((r) => (
                <div key={r.id} className="bg-white rounded-xl border border-stone-200 p-4 flex items-center justify-between">
                  <div><p className="text-sm font-medium text-slate-900">{r.institute_name}</p><AuditTag>{r.id} · {r.inspector_name} · {new Date(r.submitted_at).toLocaleString("en-IN")}</AuditTag></div>
                  <Stamp status={r.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {page === "institutes" && (
        <div>
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Registered institutes</h3>
          {institutes.length === 0 ? <EmptyState icon={Building2} title="No institutes registered yet" sub="Ask an Admin to register an institute before inspections can be assigned." /> : (
            <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-stone-50 text-slate-400 text-xs uppercase tracking-wider"><tr><th className="text-left px-5 py-3 font-medium">Institute</th><th className="text-left px-5 py-3 font-medium">Location</th><th className="text-left px-5 py-3 font-medium">Beneficiaries</th><th className="px-5 py-3"></th></tr></thead>
                <tbody>
                  {institutes.map((inst) => (
                    <tr key={inst.id} className="border-t border-stone-100 hover:bg-stone-50 cursor-pointer" onClick={() => setSelectedId(inst.id)}>
                      <td className="px-5 py-3.5"><p className="text-slate-900 font-medium">{inst.name}</p><AuditTag>{inst.id}</AuditTag></td>
                      <td className="px-5 py-3.5 text-slate-500">{inst.location}</td>
                      <td className="px-5 py-3.5 text-slate-500">{inst.beneficiaries}</td>
                      <td className="px-5 py-3.5 text-slate-300"><ChevronRight size={16} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      {page === "alerts" && (
        <div>
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Flagged by cross-verification</h3>
          {alerts.length === 0 ? <EmptyState icon={FileWarning} title="No alerts raised" /> : (
            <div className="flex flex-col gap-3">
              {alerts.map((a) => (
                <div key={a.id} className="bg-white rounded-xl border border-stone-200 p-4 flex gap-3">
                  <AlertTriangle size={18} className="text-red-600 shrink-0 mt-0.5" />
                  <div className="flex-1"><div className="flex items-center justify-between"><p className="text-sm font-medium text-slate-900">{a.type} — {a.institute_name}</p><AuditTag>{a.id}</AuditTag></div><p className="text-sm text-slate-500 mt-0.5">{a.detail}</p></div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Shell>
  );
}

/* ---------------------------------------------------------
   ADMIN PANEL — real API calls
--------------------------------------------------------- */
function AdminPanel({ account, token, onLogout }) {
  const [page, setPage] = useState("institutes");
  const [institutes, setInstitutes] = useState([]);
  const [inspectors, setInspectors] = useState([]);
  const [error, setError] = useState("");
  const [instName, setInstName] = useState("");
  const [instLocation, setInstLocation] = useState("");
  const [instBeneficiaries, setInstBeneficiaries] = useState("");
  const [instRtsp, setInstRtsp] = useState("");
  const [instLat, setInstLat] = useState("");
  const [instLng, setInstLng] = useState("");
  const [inspName, setInspName] = useState("");
  const [inspDistrict, setInspDistrict] = useState("");
  const [lastAssignment, setLastAssignment] = useState(null);
  const [drawing, setDrawing] = useState(false);

  const navItems = [
    { id: "institutes", label: "Institutes", icon: Building2 },
    { id: "inspectors", label: "Inspectors", icon: Fingerprint },
    { id: "assignment", label: "Assignment Engine", icon: Shuffle },
  ];

  const loadAll = useCallback(async () => {
    try {
      const [inst, insp] = await Promise.all([apiRequest("/institutes", { token }), apiRequest("/inspectors", { token })]);
      setInstitutes(inst); setInspectors(insp);
    } catch (e) { setError(e.message); }
  }, [token]);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function addInstitute() {
    if (!instName || !instLocation || !instBeneficiaries) return;
    try {
      const inst = await apiRequest("/institutes", { method: "POST", token, body: { name: instName, location: instLocation, beneficiaries: Number(instBeneficiaries), rtsp_url: instRtsp || null, latitude: instLat ? Number(instLat) : null, longitude: instLng ? Number(instLng) : null } });
      setInstitutes((prev) => [...prev, inst]);
      setInstName(""); setInstLocation(""); setInstBeneficiaries(""); setInstRtsp(""); setInstLat(""); setInstLng("");
    } catch (e) { setError(e.message); }
  }

  async function addInspector() {
    if (!inspName || !inspDistrict) return;
    try {
      const insp = await apiRequest("/inspectors", { method: "POST", token, body: { name: inspName, district: inspDistrict } });
      setInspectors((prev) => [...prev, insp]);
      setInspName(""); setInspDistrict("");
    } catch (e) { setError(e.message); }
  }

  async function runDraw() {
    setDrawing(true); setError("");
    try {
      const assignment = await apiRequest("/assignments/draw", { method: "POST", token });
      setLastAssignment(assignment);
    } catch (e) { setError(e.message); } finally { setDrawing(false); }
  }

  return (
    <Shell title="Admin Panel" subtitle={`Signed in as ${account.name}`} navItems={navItems} activePage={page} setActivePage={setPage} onLogout={onLogout}>
      <ErrorBanner message={error} />
      {page === "institutes" && (
        <div className="grid grid-cols-2 gap-6 max-w-4xl">
          <div className="bg-white rounded-2xl border border-stone-200 p-6">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Register new institute</h3>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Institute name</label>
            <input value={instName} onChange={(e) => setInstName(e.target.value)} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-slate-900" placeholder="e.g. Prayas Skill Training Centre" />
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Location</label>
            <input value={instLocation} onChange={(e) => setInstLocation(e.target.value)} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-slate-900" placeholder="District, State" />
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Registered beneficiaries</label>
            <input type="number" value={instBeneficiaries} onChange={(e) => setInstBeneficiaries(e.target.value)} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-slate-900" placeholder="e.g. 50" />
            <label className="block text-sm font-medium text-slate-700 mb-1.5">CCTV source (RTSP URL, optional)</label>
            <input value={instRtsp} onChange={(e) => setInstRtsp(e.target.value)} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-slate-900" placeholder="rtsp://..." />
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Registered GPS coordinates (for geo-tag verification)</label>
            <div className="flex gap-2 mb-1">
              <input value={instLat} onChange={(e) => setInstLat(e.target.value)} className="w-1/2 border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" placeholder="Latitude" />
              <input value={instLng} onChange={(e) => setInstLng(e.target.value)} className="w-1/2 border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" placeholder="Longitude" />
            </div>
            <button type="button" onClick={() => navigator.geolocation?.getCurrentPosition((pos) => { setInstLat(pos.coords.latitude.toFixed(6)); setInstLng(pos.coords.longitude.toFixed(6)); })} className="text-xs text-slate-500 underline mb-5 hover:text-slate-800">
              Use my current location (for testing)
            </button>
            <br />
            <button onClick={addInstitute} className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-800"><PlusCircle size={15} /> Add institute</button>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Registered so far</h3>
            {institutes.length === 0 ? <EmptyState icon={Building2} title="None added yet" /> : (
              <div className="flex flex-col gap-2">{institutes.map((i) => (<div key={i.id} className="bg-white rounded-xl border border-stone-200 p-3"><p className="text-sm font-medium text-slate-900">{i.name}</p><AuditTag>{i.id} · {i.location}</AuditTag></div>))}</div>
            )}
          </div>
        </div>
      )}
      {page === "inspectors" && (
        <div className="grid grid-cols-2 gap-6 max-w-4xl">
          <div className="bg-white rounded-2xl border border-stone-200 p-6">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Register new inspector</h3>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Full name</label>
            <input value={inspName} onChange={(e) => setInspName(e.target.value)} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-slate-900" placeholder="e.g. Sunita Devi" />
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Assigned district</label>
            <input value={inspDistrict} onChange={(e) => setInspDistrict(e.target.value)} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm mb-5 focus:outline-none focus:ring-2 focus:ring-slate-900" placeholder="District" />
            <button onClick={addInspector} className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-800"><PlusCircle size={15} /> Add inspector</button>
            <p className="text-xs text-slate-400 mt-3">This creates a directory entry the assignment engine can draw against. The inspector still separately signs up for their own login through the Inspector Portal.</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Registered so far</h3>
            {inspectors.length === 0 ? <EmptyState icon={Fingerprint} title="None added yet" /> : (
              <div className="flex flex-col gap-2">{inspectors.map((i) => (<div key={i.id} className="bg-white rounded-xl border border-stone-200 p-3"><p className="text-sm font-medium text-slate-900">{i.name}</p><AuditTag>{i.id} · {i.district}</AuditTag></div>))}</div>
            )}
          </div>
        </div>
      )}
      {page === "assignment" && (
        <div className="max-w-lg">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Random assignment engine</h3>
          <div className="bg-white rounded-2xl border border-stone-200 p-6">
            <p className="text-sm text-slate-600 mb-5">Trigger a new draw to randomly pair a registered institute with a registered inspector.</p>
            <button onClick={runDraw} disabled={institutes.length === 0 || inspectors.length === 0 || drawing}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold ${institutes.length && inspectors.length && !drawing ? "bg-amber-500 text-slate-900 hover:bg-amber-400" : "bg-stone-200 text-stone-400 cursor-not-allowed"}`}>
              {drawing ? <Loader2 size={15} className="animate-spin" /> : <Shuffle size={15} />} Run random draw
            </button>
            {(institutes.length === 0 || inspectors.length === 0) && <p className="text-xs text-slate-400 mt-2">Add at least one institute and one inspector first.</p>}
            {lastAssignment && (
              <div className="mt-5 bg-stone-50 rounded-xl p-4 border border-stone-200">
                <AuditTag>{lastAssignment.id}</AuditTag>
                <p className="text-sm text-slate-800 mt-2"><span className="font-medium">{lastAssignment.inspector_name}</span> assigned to <span className="font-medium">{lastAssignment.institute_name}</span></p>
                <p className="text-sm text-slate-500">Window: {lastAssignment.window}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </Shell>
  );
}

/* ---------------------------------------------------------
   ROOT APP
--------------------------------------------------------- */
export default function App() {
  const [view, setView] = useState("landing");
  const [role, setRole] = useState(null);
  const [account, setAccount] = useState(null);
  const [token, setToken] = useState(null);

  function enterPortal(r) { setRole(r); setView("auth"); }
  function handleAuthed(acc, tok) { setAccount(acc); setToken(tok); setView("app"); }
  function handleLogout() { setAccount(null); setToken(null); setRole(null); setView("landing"); }

  return (
    <div>
      <style>{FONT_IMPORT}</style>
      {view === "landing" && <Landing onEnter={enterPortal} />}
      {view === "auth" && <AuthScreen role={role} onBack={() => setView("landing")} onAuthed={handleAuthed} />}
      {view === "app" && role === "inspector" && <InspectorPortal account={account} token={token} onLogout={handleLogout} />}
      {view === "app" && role === "department" && <DepartmentDashboard account={account} token={token} onLogout={handleLogout} />}
      {view === "app" && role === "admin" && <AdminPanel account={account} token={token} onLogout={handleLogout} />}
    </div>
  );
}