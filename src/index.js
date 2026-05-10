import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { loginCredentials, loginToken, createSessionHandle, AccountKind } from "pawnote";
import { v4 as uuidv4 } from "uuid";
import { fetchGrades, fetchPeriods } from "./grades.js";
import { fetchTimetable } from "./timetable.js";
import { fetchHomework } from "./homework.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json());

// Sert le frontend (index.html)
app.get("/", (_req, res) => res.sendFile(path.join(__dirname, "index.html")));

// Stockage en mémoire des sessions actives (clé = token de session)
const sessions = new Map();

// ─── AUTH : connexion par identifiants ────────────────────────────────────────
app.post("/api/login", async (req, res) => {
  const { url, username, password } = req.body;

  if (!url || !username || !password) {
    return res.status(400).json({ error: "url, username et password requis" });
  }

  try {
    const deviceUUID = uuidv4();
    const handle = createSessionHandle();

    const session = await loginCredentials(handle, {
      url,
      kind: AccountKind.STUDENT,
      username,
      password,
      deviceUUID,
    });

    const sessionId = uuidv4();
    sessions.set(sessionId, {
      handle,
      token: session.token,
      url,
      username,
      deviceUUID,
      createdAt: Date.now(),
    });

    // Nettoyage auto après 30 min
    setTimeout(() => sessions.delete(sessionId), 30 * 60 * 1000);

    const user = handle.user.resources[0];
    res.json({
      sessionId,
      token: session.token,
      name: user?.name ?? username,
      className: user?.className ?? "",
      schoolName: handle.instance?.name ?? "",
    });
  } catch (err) {
    console.error("[login]", err.message);
    res.status(401).json({ error: "Identifiants invalides ou URL incorrecte. Vérifiez vos infos." });
  }
});

// ─── AUTH : reconnexion par token ─────────────────────────────────────────────
app.post("/api/token", async (req, res) => {
  const { url, username, token, deviceUUID } = req.body;

  if (!url || !username || !token || !deviceUUID) {
    return res.status(400).json({ error: "url, username, token et deviceUUID requis" });
  }

  try {
    const handle = createSessionHandle();
    const session = await loginToken(handle, {
      url,
      kind: AccountKind.STUDENT,
      username,
      token,
      deviceUUID,
    });

    const sessionId = uuidv4();
    sessions.set(sessionId, {
      handle,
      token: session.token,
      url,
      username,
      deviceUUID,
      createdAt: Date.now(),
    });

    setTimeout(() => sessions.delete(sessionId), 30 * 60 * 1000);

    const user = handle.user.resources[0];
    res.json({
      sessionId,
      token: session.token,
      name: user?.name ?? username,
      className: user?.className ?? "",
      schoolName: handle.instance?.name ?? "",
    });
  } catch (err) {
    console.error("[token]", err.message);
    res.status(401).json({ error: "Token invalide ou expiré." });
  }
});

// ─── Middleware : vérification session ────────────────────────────────────────
function getSession(req, res) {
  const sessionId = req.headers["x-session-id"];
  if (!sessionId || !sessions.has(sessionId)) {
    res.status(401).json({ error: "Session invalide ou expirée. Reconnectez-vous." });
    return null;
  }
  return sessions.get(sessionId);
}

// ─── NOTES ────────────────────────────────────────────────────────────────────
app.get("/api/grades", async (req, res) => {
  const sess = getSession(req, res);
  if (!sess) return;
  try {
    const periods = await fetchPeriods(sess.handle);
    const periodName = req.query.period ?? periods[0]?.name;
    const period = periods.find((p) => p.name === periodName) ?? periods[0];
    const grades = await fetchGrades(sess.handle, period);
    res.json({ period, periods, grades });
  } catch (err) {
    console.error("[grades]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── EMPLOI DU TEMPS ──────────────────────────────────────────────────────────
app.get("/api/timetable", async (req, res) => {
  const sess = getSession(req, res);
  if (!sess) return;
  try {
    const date = req.query.date ? new Date(req.query.date) : new Date();
    const timetable = await fetchTimetable(sess.handle, date);
    res.json({ timetable });
  } catch (err) {
    console.error("[timetable]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── DEVOIRS ──────────────────────────────────────────────────────────────────
app.get("/api/homework", async (req, res) => {
  const sess = getSession(req, res);
  if (!sess) return;
  try {
    const date = req.query.date ? new Date(req.query.date) : new Date();
    const homework = await fetchHomework(sess.handle, date);
    res.json({ homework });
  } catch (err) {
    console.error("[homework]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── HEALTH ───────────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => res.json({ status: "ok", sessions: sessions.size }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`✅  Backend Pronote démarré sur le port ${PORT}`));
