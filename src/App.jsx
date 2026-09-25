import { useState, useEffect, useRef, useCallback } from "react";
import {
  ShieldCheck, LayoutDashboard, ClipboardList, History, Camera, MapPin,
  Building2, Video, PhoneCall, AlertTriangle, LogOut, ChevronRight,
  CheckCircle2, Clock, Users, FileWarning, PlusCircle, Shuffle,
  Fingerprint, ArrowLeft, ArrowRight, Inbox, Settings as Settings2, Loader2,
  Menu, X
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

      // The backend's /auth/login only checks the ID + password — it has
      // no idea which of the three portal screens the person typed them
      // into. Without this check, an Admin's correct credentials entered
      // on the Inspector login screen would be accepted and silently open
      // the Inspector Portal using the Admin's account. We only ever let
      // someone in if the account's real role matches the portal they're
      // signing into.
      if (data.user.role !== role) {
        const roleLabel = { inspector: "an Inspector", department: "a Department Official", admin: "an Admin" }[data.user.role] || data.user.role;
        setError(`This ID belongs to ${roleLabel} account. Please use the ${roleMeta.title} portal's own login, or the correct portal for this ID.`);
        return;
      }

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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const sidebarContent = (
    <>
      <div className="flex items-center justify-between px-5 py-5 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <ShieldCheck size={20} color="#E8A33D" />
          <span className="text-white font-semibold text-sm tracking-wide" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Nigrani Setu</span>
        </div>
        <button onClick={() => setMobileNavOpen(false)} className="md:hidden text-slate-400"><X size={20} /></button>
      </div>
      <nav className="flex-1 py-4 px-3 flex flex-col gap-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activePage === item.id;
          return (
            <button key={item.id} onClick={() => { setActivePage(item.id); setMobileNavOpen(false); }} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-left ${active ? "bg-slate-800 text-white" : "hover:bg-slate-800/60 text-slate-400"}`}>
              <Icon size={16} color={active ? "#E8A33D" : "#94a3b8"} />{item.label}
            </button>
          );
        })}
      </nav>
      <div className="px-3 pb-4">
        <button onClick={onLogout} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:bg-slate-800/60 w-full"><LogOut size={16} /> Log out</button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-stone-100 flex" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Desktop sidebar — always visible from md breakpoint up */}
      <aside className="hidden md:flex w-60 bg-slate-900 text-slate-300 flex-col shrink-0">
        {sidebarContent}
      </aside>

      {/* Mobile sidebar — slides in as an overlay, only rendered when open */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setMobileNavOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-slate-900 text-slate-300 flex flex-col">
            {sidebarContent}
          </aside>
        </div>
      )}

      <main className="flex-1 min-w-0">
        <header className="h-16 bg-white border-b border-stone-200 flex items-center justify-between px-4 md:px-8 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setMobileNavOpen(true)} className="md:hidden text-slate-500 shrink-0"><Menu size={22} /></button>
            <div className="min-w-0">
              <h2 className="text-base md:text-lg font-semibold text-slate-900 truncate" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{title}</h2>
              {subtitle && <p className="text-xs text-slate-400 truncate">{subtitle}</p>}
            </div>
          </div>
          <div className="hidden sm:block shrink-0"><TopClock /></div>
        </header>
        <div className="p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
}

/* ---------------------------------------------------------
   GEOTAG HELPERS
   Burns location + date/time onto a captured photo using canvas.
   Video cannot be burned client-side without ffmpeg, so video gets
   a CSS overlay in preview and the raw coords sent to the backend
   for it to stamp/verify server-side if needed.
--------------------------------------------------------- */
function formatCoords(coords) {
  if (!coords) return "Location unavailable";
  return `Lat ${coords.lat.toFixed(5)}, Lng ${coords.lng.toFixed(5)}`;
}

function stampPhoto(file, coords) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);

      const stripHeight = Math.round(img.height * 0.14);
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(0, img.height - stripHeight, img.width, stripHeight);

      const now = new Date();
      const dateStr = now.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
      const timeStr = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

      const fontSize = Math.max(14, Math.round(img.width * 0.022));
      ctx.fillStyle = "#ffffff";
      ctx.font = `600 ${fontSize}px sans-serif`;
      ctx.fillText(`📍 ${formatCoords(coords)}`, img.width * 0.03, img.height - stripHeight * 0.55);
      ctx.font = `400 ${Math.round(fontSize * 0.85)}px sans-serif`;
      ctx.fillText(`${dateStr}  •  ${timeStr}  •  Nigrani Setu Verified`, img.width * 0.03, img.height - stripHeight * 0.2);

      canvas.toBlob((blob) => {
        if (!blob) { reject(new Error("Could not process photo")); return; }
        resolve(new File([blob], file.name.replace(/\.[^.]+$/, "") + "_geotagged.jpg", { type: "image/jpeg" }));
      }, "image/jpeg", 0.92);
    };
    img.onerror = () => reject(new Error("Could not load captured photo"));
    img.src = URL.createObjectURL(file);
  });
}

function getCurrentPosition() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null)
    );
  });
}

/* ---------------------------------------------------------
   LIVE CAMERA CAPTURE
   Opens the device camera as a live stream (getUserMedia) — NOT a
   file picker — so the user can only capture what the camera sees
   right now. No gallery upload is possible. The geotag is burned
   onto the frame at the exact instant the shutter is pressed.
--------------------------------------------------------- */
function LiveCameraCapture({ mode, coords, onCapture, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const [ready, setReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: mode === "video",
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setReady(true);
      } catch (e) {
        setErr("Camera permission denied or no camera available. Please allow camera access in your browser settings.");
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [mode]);

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }

  function capturePhoto() {
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0);

    const stripHeight = Math.round(canvas.height * 0.14);
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, canvas.height - stripHeight, canvas.width, stripHeight);

    const now = new Date();
    const dateStr = now.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    const timeStr = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
    const fontSize = Math.max(14, Math.round(canvas.width * 0.022));
    ctx.fillStyle = "#ffffff";
    ctx.font = `600 ${fontSize}px sans-serif`;
    ctx.fillText(`📍 ${formatCoords(coords)}`, canvas.width * 0.03, canvas.height - stripHeight * 0.55);
    ctx.font = `400 ${Math.round(fontSize * 0.85)}px sans-serif`;
    ctx.fillText(`${dateStr}  •  ${timeStr}  •  Nigrani Setu Live Capture`, canvas.width * 0.03, canvas.height - stripHeight * 0.2);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `capture_${Date.now()}.jpg`, { type: "image/jpeg" });
      stopStream();
      onCapture(file, "image");
    }, "image/jpeg", 0.92);
  }

  function startRecording() {
    chunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm";
    const rec = new MediaRecorder(streamRef.current, { mimeType });
    rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const file = new File([blob], `capture_${Date.now()}.webm`, { type: mimeType });
      stopStream();
      onCapture(file, "video");
    };
    recorderRef.current = rec;
    rec.start();
    setRecording(true);
  }

  function stopRecording() {
    recorderRef.current?.stop();
    setRecording(false);
  }

  function handleClose() {
    if (recording) stopRecording();
    stopStream();
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <div className="flex-1 relative overflow-hidden">
        <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
        {!ready && !err && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-white text-sm">
            <Loader2 size={18} className="animate-spin" /> Opening live camera…
          </div>
        )}
        {err && (
          <div className="absolute inset-0 flex items-center justify-center text-red-400 text-sm px-8 text-center">{err}</div>
        )}
        {ready && (
          <div className="absolute bottom-4 left-0 right-0 text-center text-white text-[11px] px-4" style={{ fontFamily: "'JetBrains Mono', monospace", textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}>
            📍 {formatCoords(coords)}
            {recording && <span className="ml-2 text-red-400">● REC</span>}
          </div>
        )}
      </div>
      <div className="bg-black py-6 flex items-center justify-center gap-10">
        <button onClick={handleClose} className="text-white text-sm w-14">Cancel</button>
        {mode === "photo" ? (
          <button onClick={capturePhoto} disabled={!ready} className="w-16 h-16 rounded-full bg-white border-4 border-slate-400 disabled:opacity-30" aria-label="Capture photo" />
        ) : recording ? (
          <button onClick={stopRecording} className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center" aria-label="Stop recording"><div className="w-6 h-6 bg-white rounded-sm" /></button>
        ) : (
          <button onClick={startRecording} disabled={!ready} className="w-16 h-16 rounded-full bg-red-600 border-4 border-red-400 disabled:opacity-30" aria-label="Start recording" />
        )}
        <div className="w-14" />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   INSPECTOR PORTAL — real API calls
   Uses LiveCameraCapture for true live photo/video capture (no
   file upload / gallery picker possible). Geotag is burned onto
   the photo at the instant of capture; video carries the same
   coordinates recorded live alongside it.
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

  // Media state — generalized to handle both photo and video
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [mediaType, setMediaType] = useState(null); // "image" | "video"
  const [coords, setCoords] = useState(null);
  const [capturing, setCapturing] = useState(false);
  const [cameraMode, setCameraMode] = useState(null); // null | "photo" | "video" — controls the live camera modal

  const [submitting, setSubmitting] = useState(false);

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

  // Opens the live camera modal. GPS is fetched first so the modal can
  // show/burn the correct coordinates the moment the shutter is pressed.
  async function openCamera(mode) {
    setError("");
    setCapturing(true);
    const pos = await getCurrentPosition();
    setCoords(pos);
    setCapturing(false);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Live camera is not supported in this browser. Please use a modern mobile browser (Chrome/Safari) over HTTPS.");
      return;
    }
    setCameraMode(mode);
  }

  // Called by LiveCameraCapture once the user actually presses capture —
  // this is real live camera output, never a gallery file.
  function handleCameraCapture(file, type) {
    setMediaFile(file);
    setMediaPreview(URL.createObjectURL(file));
    setMediaType(type);
    setCameraMode(null);
  }

  function clearMedia() {
    setMediaFile(null); setMediaPreview(null); setMediaType(null); setCoords(null);
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
      form.append("media_type", mediaType || "image");
      // Field name kept as "photo" for backend compatibility — update
      // your FastAPI endpoint to also accept video/* content types here.
      form.append("photo", mediaFile);

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
    setPage("home"); setSubmitted(null); clearMedia();
    setBeneficiariesPresent(""); setAttendance(null); setNotes("");
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
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Evidence capture (live camera, geo-tagged)</label>

              {!mediaFile && (
                <div className="flex gap-3">
                  <button type="button" onClick={() => openCamera("photo")} disabled={capturing}
                    className="flex-1 border-2 border-dashed border-stone-300 hover:border-slate-500 rounded-xl py-7 flex flex-col items-center gap-2 transition-colors disabled:opacity-50">
                    <Camera size={22} className="text-slate-400" />
                    <span className="text-sm text-slate-500">Open Camera — Photo</span>
                  </button>
                  <button type="button" onClick={() => openCamera("video")} disabled={capturing}
                    className="flex-1 border-2 border-dashed border-stone-300 hover:border-slate-500 rounded-xl py-7 flex flex-col items-center gap-2 transition-colors disabled:opacity-50">
                    <Video size={22} className="text-slate-400" />
                    <span className="text-sm text-slate-500">Open Camera — Video</span>
                  </button>
                </div>
              )}

              {capturing && (
                <div className="flex items-center gap-2 mt-3 text-slate-400 text-sm">
                  <Loader2 size={15} className="animate-spin" /> Getting your location…
                </div>
              )}

              {mediaFile && !capturing && (
                <div className="border-2 border-emerald-400 bg-emerald-50 rounded-xl p-3">
                  <div className="relative rounded-lg overflow-hidden">
                    {mediaType === "video" ? (
                      <>
                        <video src={mediaPreview} controls className="w-full rounded-lg max-h-64 bg-black" />
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[11px] px-3 py-2" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                          📍 {formatCoords(coords)}
                          <br />
                          {new Date().toLocaleString("en-IN")} · Nigrani Setu Verified
                        </div>
                      </>
                    ) : (
                      <img src={mediaPreview} alt="Geotagged evidence" className="w-full rounded-lg max-h-64 object-cover" />
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-sm text-emerald-700 font-medium flex items-center gap-1">
                      <CheckCircle2 size={15} /> {mediaType === "video" ? "Video captured" : "Photo captured & geotagged"}
                    </span>
                    <button type="button" onClick={clearMedia} className="text-xs text-slate-500 underline hover:text-slate-800">Retake</button>
                  </div>
                </div>
              )}

              <p className="text-xs text-slate-400 mt-2">This opens a live camera stream in the browser — there is no gallery or file picker, so an old or borrowed photo can never be submitted. The geotag is burned onto the photo at the exact moment of capture; video carries the same coordinates recorded live.</p>
            </div>

            <button onClick={handleSubmit} disabled={!mediaFile || !beneficiariesPresent || !attendance || submitting}
              className={`w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium ${mediaFile && beneficiariesPresent && attendance && !submitting ? "bg-slate-900 text-white hover:bg-slate-800" : "bg-stone-200 text-stone-400 cursor-not-allowed"}`}>
              {submitting && <Loader2 size={15} className="animate-spin" />} Submit report
            </button>
          </div>
        </div>
      )}

      {cameraMode && (
        <LiveCameraCapture mode={cameraMode} coords={coords} onCapture={handleCameraCapture} onClose={() => setCameraMode(null)} />
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
          <div className="col-span-2 bg-white rounded-2xl border border-stone-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Latest inspection report</h3>
              {latestReport && <Stamp status={latestReport.status} />}
            </div>
            {latestReport ? (
              <>
                <AuditTag>{latestReport.id} · {latestReport.inspector_name} · {new Date(latestReport.submitted_at).toLocaleString("en-IN")}</AuditTag>
                <div className="grid grid-cols-2 gap-3 mt-4">
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
                  latestReport.media_type === "video" ? (
                    <video
                      src={latestReport.photo_url.startsWith("data:") ? latestReport.photo_url : `${API_BASE}${latestReport.photo_url}`}
                      controls
                      className="mt-4 rounded-xl w-full max-h-56 border border-stone-200 bg-black"
                    />
                  ) : (
                    <img
                      src={latestReport.photo_url.startsWith("data:") ? latestReport.photo_url : `${API_BASE}${latestReport.photo_url}`}
                      alt="Field evidence"
                      className="mt-4 rounded-xl w-full max-h-56 object-cover border border-stone-200"
                    />
                  )
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

        <div className="bg-white rounded-2xl border border-stone-200 p-5 max-w-lg">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Direct verification</h3>
          <p className="text-sm text-slate-600 mb-4">Call a randomly selected beneficiary or staff member to confirm the service is real.</p>
          <button onClick={() => setVcOpen(true)} className="flex items-center justify-center gap-2 w-full bg-slate-900 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-slate-800"><PhoneCall size={15} /> Call a random beneficiary</button>
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
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
            <div className="bg-white rounded-2xl border border-stone-200 overflow-x-auto">
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
      const inst = await apiRequest("/institutes", { method: "POST", token, body: { name: instName, location: instLocation, beneficiaries: Number(instBeneficiaries), latitude: instLat ? Number(instLat) : null, longitude: instLng ? Number(instLng) : null } });
      setInstitutes((prev) => [...prev, inst]);
      setInstName(""); setInstLocation(""); setInstBeneficiaries(""); setInstLat(""); setInstLng("");
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
          <div className="bg-white rounded-2xl border border-stone-200 p-6">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Register new institute</h3>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Institute name</label>
            <input value={instName} onChange={(e) => setInstName(e.target.value)} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-slate-900" placeholder="e.g. Prayas Skill Training Centre" />
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Location</label>
            <input value={instLocation} onChange={(e) => setInstLocation(e.target.value)} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-slate-900" placeholder="District, State" />
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Registered beneficiaries</label>
            <input type="number" value={instBeneficiaries} onChange={(e) => setInstBeneficiaries(e.target.value)} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-slate-900" placeholder="e.g. 50" />
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
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
  const [checkedStorage, setCheckedStorage] = useState(false);

  // On first load, restore a saved session so refreshing the page doesn't
  // force a fresh login every time. sessionStorage (NOT localStorage) is
  // used deliberately — it is isolated per browser TAB. With localStorage,
  // opening Admin / Inspector / Department in three tabs of the same
  // browser (exactly what the demo does) would make every tab share one
  // session, so logging into a second tab would silently overwrite and
  // "mix up" the session in the first tab on its next refresh.
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("nigrani_session");
      if (saved) {
        const { role: savedRole, account: savedAccount, token: savedToken } = JSON.parse(saved);
        if (savedRole && savedAccount && savedToken) {
          setRole(savedRole); setAccount(savedAccount); setToken(savedToken); setView("app");
        }
      }
    } catch (_) { /* ignore corrupted storage */ }
    setCheckedStorage(true);
  }, []);

  function enterPortal(r) { setRole(r); setView("auth"); }
  function handleAuthed(acc, tok) {
    setAccount(acc); setToken(tok); setView("app");
    sessionStorage.setItem("nigrani_session", JSON.stringify({ role, account: acc, token: tok }));
  }
  function handleLogout() {
    setAccount(null); setToken(null); setRole(null); setView("landing");
    sessionStorage.removeItem("nigrani_session");
  }

  // Wait one tick for the storage check so a logged-in user doesn't flash
  // the landing page for a split second on every refresh.
  if (!checkedStorage) return null;

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
