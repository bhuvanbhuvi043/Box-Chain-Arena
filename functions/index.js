import {createRequire} from "node:module";
import {initializeApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {getDatabase} from "firebase-admin/database";
import {setGlobalOptions} from "firebase-functions/v2";
import {HttpsError, onCall} from "firebase-functions/v2/https";
import {onSchedule} from "firebase-functions/v2/scheduler";

const require = createRequire(import.meta.url);
const DUEL_STAGES = require("./stages.json");

initializeApp();
setGlobalOptions({
  region: "asia-southeast1",
  maxInstances: 20,
  timeoutSeconds: 30,
  memory: "256MiB"
});

const db = getDatabase();
const auth = getAuth();
const STARTING_CHALLENGE_POINTS = 100;
const MAX_STAGE = DUEL_STAGES.length;
const INVITE_TTL_MS = 5 * 60 * 1000;
const ROOM_ABANDON_MS = 2 * 60 * 60 * 1000;
const NICKNAME_RE = /^[A-Za-z0-9_]{3,15}$/;
const ROOM_CODE_RE = /^[A-Z]{3,8}-[A-Z0-9]{5,8}$/;
const EDGE_RE = /^[hv]:\d{1,2}:\d{1,2}$/;
const PROFANITY = [
  "fuck", "shit", "bitch", "cunt", "nigger", "nigga", "faggot",
  "whore", "slut", "rape", "hitler", "nazi", "terrorist"
];
const ROOM_WORDS = ["BOX", "CHAIN", "ARENA", "DUEL", "GATE", "CROWN", "DOT"];
const ENFORCE_APP_CHECK =
  String(process.env.ENFORCE_APP_CHECK || "").toLowerCase() === "true";

function now() {
  return Date.now();
}

function cleanObject(value) {
  return value && typeof value === "object" ? value : {};
}

function int(value, min, max, fallback = min) {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function nicknameKey(value) {
  return String(value || "").trim().toLowerCase();
}

function hasProfanity(value) {
  const compact = nicknameKey(value).replace(/[^a-z0-9]/g, "");
  return PROFANITY.some((word) => compact.includes(word));
}

function assertAuth(request, {verified = true} = {}) {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Sign in is required.");
  }
  if (request.auth.token.firebase?.sign_in_provider === "anonymous") {
    throw new HttpsError("permission-denied", "Anonymous accounts cannot use online play.");
  }
  if (verified && request.auth.token.email_verified !== true) {
    throw new HttpsError("failed-precondition", "Verify your email before using online play.");
  }
  return request.auth.uid;
}

function callable(handler, options = {}) {
  return onCall(
    {
      enforceAppCheck: ENFORCE_APP_CHECK,
      consumeAppCheckToken:
        ENFORCE_APP_CHECK && options.consumeAppCheckToken === true
    },
    handler
  );
}

async function rateLimit(uid, action, maxCalls, windowMs) {
  const ref = db.ref(`rateLimits/${uid}/${action}`);
  const current = now();
  let allowed = false;
  await ref.transaction((value) => {
    const data = cleanObject(value);
    const windowStart = Number(data.windowStart || 0);
    const count = Number(data.count || 0);
    if (!windowStart || current - windowStart >= windowMs) {
      allowed = true;
      return {windowStart: current, count: 1, updatedAt: current};
    }
    if (count >= maxCalls) return;
    allowed = true;
    return {windowStart, count: count + 1, updatedAt: current};
  }, undefined, false);
  if (!allowed) {
    throw new HttpsError("resource-exhausted", "Too many requests. Please wait and try again.");
  }
}

async function getPublicProfile(uid) {
  const snap = await db.ref(`publicProfiles/${uid}`).get();
  if (!snap.exists()) throw new HttpsError("failed-precondition", "Player profile is missing.");
  return snap.val();
}

async function getPrivateProfile(uid) {
  const snap = await db.ref(`privateProfiles/${uid}`).get();
  if (!snap.exists()) throw new HttpsError("failed-precondition", "Private player profile is missing.");
  return snap.val();
}

function entryLimit(totalMatches) {
  const matches = Number(totalMatches || 0);
  if (matches >= 25) return 1000;
  if (matches >= 10) return 500;
  if (matches >= 3) return 150;
  return 50;
}

function randomToken(length = 6) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let output = "";
  for (let i = 0; i < length; i += 1) {
    output += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return output;
}

function makeRoomCode() {
  const word = ROOM_WORDS[Math.floor(Math.random() * ROOM_WORDS.length)];
  return `${word}-${randomToken(6)}`;
}

async function createUniqueRoom(roomFactory) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const code = makeRoomCode();
    const ref = db.ref(`rooms/${code}`);
    const result = await ref.transaction((existing) => {
      if (existing !== null) return;
      return roomFactory(code);
    }, undefined, false);
    if (result.committed) return {code, room: result.snapshot.val()};
  }
  throw new HttpsError("aborted", "Could not allocate a room code. Please try again.");
}

function cellKey(r, c) {
  return `${r},${c}`;
}

function edgeKey(type, r, c) {
  return `${type}:${r}:${c}`;
}

function duelLayoutKeep(stage, r, c) {
  const rows = stage.rows;
  const cols = stage.cols;
  const mr = (rows - 1) / 2;
  const mc = (cols - 1) / 2;
  const dr = Math.abs(r - mr);
  const dc = Math.abs(c - mc);
  if (stage.layout === "twin_gates") return (c <= 1 || c >= cols - 2 || r === 0 || r === rows - 1 || Math.abs(c - mc) <= 1) && !(r === 2 && Math.abs(c - mc) > 2);
  if (stage.layout === "crown") return r >= 1 && (r >= rows - 2 || Math.abs(c - mc) <= 1 || (r <= 2 && dc <= 3) || (r === 3 && dc !== 2));
  if (stage.layout === "bridges") return r % 2 === 0 || c === 1 || c === cols - 2 || (r === 3 && c > 1 && c < cols - 2);
  if (stage.layout === "hourglass") return dc <= Math.max(1, Math.floor(dr) + 1) || r === 0 || r === rows - 1;
  if (stage.layout === "fortress") return r === 0 || c === 0 || r === rows - 1 || c === cols - 1 || ((r > 2 && r < rows - 3) && (c > 2 && c < cols - 3)) || r === Math.floor(mr) || c === Math.floor(mc);
  if (stage.layout === "zigzag") return Math.abs((c - (r % 4)) - mc) <= 2 || r === 0 || r === rows - 1 || (r % 3 === 0 && c > 1 && c < cols - 2);
  if (stage.layout === "lotus") return ((dr + dc < rows * 0.62) && !(dr < 1 && dc < 1)) || (dr < 2 && dc < 3);
  if (stage.layout === "arrow") return (c <= mc + 1 && (Math.abs(r - mr) <= c * 0.45 + 1 || c > cols - 4)) || (c > mc && dr <= cols - c);
  if (stage.layout === "shield") return r > 0 && r < rows - 1 && dc <= Math.max(1, rows - r - 1) && (r < rows - 2 || dc < 2);
  if (stage.layout === "comet") return Math.hypot((r - mr) * 1.05, (c - mc) * 0.85) < rows * 0.42 || (r >= Math.floor(mr) && c < mc && Math.abs(r - c) < 4);
  if (stage.layout === "stairs") return (c <= r + 1 && c >= r - 3) || r === 0 || c === cols - 1 || (r > rows - 3 && c < cols - 2);
  if (stage.layout === "butterfly") return (c < mc && Math.abs(r - mr) <= Math.max(1, mc - c)) || (c > mc && Math.abs(r - mr) <= Math.max(1, c - mc)) || dc < 1;
  if (stage.layout === "arena_cross") return r === 0 || c === 0 || r === rows - 1 || c === cols - 1 || Math.abs(r - mr) <= 1 || Math.abs(c - mc) <= 1;
  if (stage.layout === "jagged") return Math.hypot((r - mr) * 0.9, (c - mc) * 1.05) < rows * 0.45 && !((r + c + stage.id) % 7 === 0 && dr > 1 && dc > 1);
  if (stage.layout === "vortex") return (r < 2 || c > cols - 3 || r > rows - 3 || c < 2) || (r >= 2 && r <= rows - 3 && c >= 2 && c <= cols - 3 && ((r + c) % 2 === 0 || dr < 1 || dc < 1));
  if (stage.layout === "final_gate") return r === 0 || r === rows - 1 || c === 0 || c === cols - 1 || c === Math.floor(mc) || c === Math.ceil(mc) || ((r === 2 || r === rows - 3) && c > 1 && c < cols - 2);
  if (stage.layout === "double_crown") return r > 0 && (r > rows - 3 || dc <= 2 || (r < 3 && Math.abs(dc - 3) < 1.5) || (r === 4 && dc < 4));
  if (stage.layout === "side_chambers") return c < 2 || c > cols - 3 || r < 2 || r > rows - 3 || ((r > 3 && r < rows - 4) && (c > 3 && c < cols - 4));
  if (stage.layout === "river") return Math.hypot(r - mr, c - mc) < rows * 0.52 && Math.abs(c - mc - Math.sin(r * 0.9) * 1.8) > 1;
  if (stage.layout === "labyrinth") return r === 0 || c === cols - 1 || r === rows - 1 || c === 0 || (Math.min(r, c, rows - 1 - r, cols - 1 - c) % 2 === 0) || dr < 1 || dc < 1;
  return false;
}

const stageCache = new Map();

function buildArena(stageId) {
  if (stageCache.has(stageId)) return stageCache.get(stageId);
  const source = DUEL_STAGES[stageId - 1];
  if (!source) throw new HttpsError("invalid-argument", "Unknown arena.");
  const stage = {...source, id: stageId};
  const cells = new Set();
  const edges = new Set();
  for (let r = 0; r < stage.rows; r += 1) {
    for (let c = 0; c < stage.cols; c += 1) {
      if (!duelLayoutKeep(stage, r, c)) continue;
      cells.add(cellKey(r, c));
      edges.add(edgeKey("h", r, c));
      edges.add(edgeKey("h", r + 1, c));
      edges.add(edgeKey("v", r, c));
      edges.add(edgeKey("v", r, c + 1));
    }
  }
  const arena = {cells, edges, cellCount: cells.size};
  stageCache.set(stageId, arena);
  return arena;
}

function adjacentCells(edge, arena) {
  const [type, rawR, rawC] = edge.split(":");
  const r = Number(rawR);
  const c = Number(rawC);
  const candidates = type === "h"
    ? [cellKey(r - 1, c), cellKey(r, c)]
    : [cellKey(r, c - 1), cellKey(r, c)];
  return candidates.filter((key) => arena.cells.has(key));
}

function cellEdges(key) {
  const [r, c] = key.split(",").map(Number);
  return [
    edgeKey("h", r, c),
    edgeKey("h", r + 1, c),
    edgeKey("v", r, c),
    edgeKey("v", r, c + 1)
  ];
}

async function reservePoints(uid, code, amount) {
  const ref = db.ref(`privateProfiles/${uid}`);
  let reason = "insufficient";
  const result = await ref.transaction((profile) => {
    if (!profile) {
      reason = "profile";
      return;
    }
    profile.reservations = cleanObject(profile.reservations);
    const existing = profile.reservations[code];
    if (existing) {
      if (Number(existing.amount) === amount) return profile;
      reason = "already-reserved";
      return;
    }
    const balance = Number(profile.challengePoints || 0);
    if (amount > balance || amount > entryLimit(profile.totalMatches)) {
      reason = "insufficient";
      return;
    }
    profile.challengePoints = balance - amount;
    profile.reservations[code] = {amount, createdAt: now()};
    profile.updatedAt = now();
    return profile;
  }, undefined, false);
  if (!result.committed) {
    if (reason === "already-reserved") {
      throw new HttpsError("already-exists", "Challenge Points are already reserved for this room.");
    }
    if (reason === "profile") {
      throw new HttpsError("failed-precondition", "Player profile is missing.");
    }
    throw new HttpsError("failed-precondition", "Not enough Challenge Points for this duel.");
  }
  return result.snapshot.val();
}

async function releaseReservation(uid, code) {
  if (!uid || !code) return;
  await db.ref(`privateProfiles/${uid}`).transaction((profile) => {
    if (!profile?.reservations?.[code]) return profile;
    const amount = Number(profile.reservations[code].amount || 0);
    profile.challengePoints = Number(profile.challengePoints || 0) + amount;
    delete profile.reservations[code];
    profile.updatedAt = now();
    return profile;
  }, undefined, false);
}

async function settlePlayer(uid, code, result, bonus) {
  const ref = db.ref(`privateProfiles/${uid}`);
  let output = null;
  await ref.transaction((profile) => {
    if (!profile) return;
    profile.ledger = cleanObject(profile.ledger);
    if (profile.ledger[code]) {
      output = profile;
      return profile;
    }
    const reservation = Number(profile.reservations?.[code]?.amount || 0);
    profile.challengePoints = Number(profile.challengePoints || 0) + Number(bonus || 0);
    profile.wins = Number(profile.wins || 0) + (result === "win" ? 1 : 0);
    profile.losses = Number(profile.losses || 0) + (result === "loss" ? 1 : 0);
    profile.totalMatches = Number(profile.totalMatches || 0) + (result === "draw" ? 1 : 1);
    profile.ledger[code] = {
      result,
      reserved: reservation,
      bonus: Number(bonus || 0),
      settledAt: now()
    };
    if (profile.reservations) delete profile.reservations[code];
    profile.updatedAt = now();
    output = profile;
    return profile;
  }, undefined, false);
  if (!output) throw new Error(`Missing profile while settling ${uid}`);
  return output;
}

async function syncPublicStats(uid, profile) {
  await db.ref(`publicProfiles/${uid}`).update({
    wins: Number(profile.wins || 0),
    losses: Number(profile.losses || 0),
    totalMatches: Number(profile.totalMatches || 0)
  });
}

async function settleRoom(code, room) {
  if (!room || room.status !== "finished") return;
  const p1Uid = room.players?.p1;
  const p2Uid = room.players?.p2;
  if (!p1Uid || !p2Uid) return;
  const claimRef = db.ref(`rooms/${code}/settlement`);
  const token = randomToken(12);
  const claim = await claimRef.transaction((value) => {
    if (value?.status === "complete") return;
    if (value?.status === "processing" && now() - Number(value.updatedAt || 0) < 120000) return;
    return {status: "processing", token, updatedAt: now()};
  }, undefined, false);
  if (!claim.committed) return;
  try {
    const p1Stake = Number(room.stakes?.p1 || 0);
    const p2Stake = Number(room.stakes?.p2 || 0);
    const draw = room.outcome === "draw";
    const winnerUid = draw ? "" : room.winnerUid;
    const p1Result = draw ? "draw" : (winnerUid === p1Uid ? "win" : "loss");
    const p2Result = draw ? "draw" : (winnerUid === p2Uid ? "win" : "loss");
    const p1Bonus = draw ? p1Stake : (winnerUid === p1Uid ? p1Stake + p2Stake : 0);
    const p2Bonus = draw ? p2Stake : (winnerUid === p2Uid ? p1Stake + p2Stake : 0);
    const [p1Profile, p2Profile] = await Promise.all([
      settlePlayer(p1Uid, code, p1Result, p1Bonus),
      settlePlayer(p2Uid, code, p2Result, p2Bonus)
    ]);
    await Promise.all([
      syncPublicStats(p1Uid, p1Profile),
      syncPublicStats(p2Uid, p2Profile)
    ]);
    const finishedAt = Number(room.finishedAt || now());
    const updates = {};
    updates[`matches/${code}`] = {
      roomCode: code,
      p1Uid,
      p2Uid,
      p1Score: Number(room.scores?.p1 || 0),
      p2Score: Number(room.scores?.p2 || 0),
      winnerUid: winnerUid || null,
      outcome: draw ? "draw" : "win",
      challengePoints: {p1: p1Stake, p2: p2Stake},
      victoryBonus: p1Stake + p2Stake,
      stageId: Number(room.stageId || 1),
      createdAt: Number(room.createdAt || finishedAt),
      finishedAt
    };
    updates[`userMatches/${p1Uid}/${code}`] = true;
    updates[`userMatches/${p2Uid}/${code}`] = true;
    updates[`rooms/${code}/settlement`] = {status: "complete", token, updatedAt: now()};
    await db.ref().update(updates);
  } catch (error) {
    await claimRef.set({status: "pending", error: String(error?.message || error), updatedAt: now()});
    throw error;
  }
}

async function abandonRoom(code, room, reason = "expired") {
  if (!room || room.status === "finished" || room.status === "abandoned") return;
  const p1Uid = room.players?.p1;
  const p2Uid = room.players?.p2;
  await Promise.all([
    releaseReservation(p1Uid, code),
    releaseReservation(p2Uid, code)
  ]);
  await db.ref(`rooms/${code}`).update({
    status: "abandoned",
    abandonReason: reason,
    abandonedAt: now(),
    updatedAt: now()
  });
}

export const registerProfile = callable(async (request) => {
  const uid = assertAuth(request, {verified: false});
  await rateLimit(uid, "registerProfile", 5, 60 * 60 * 1000);
  const nickname = String(request.data?.nickname || "").trim();
  const lower = nicknameKey(nickname);
  if (!NICKNAME_RE.test(nickname) || hasProfanity(nickname)) {
    throw new HttpsError("invalid-argument", "Choose a clean nickname using 3-15 letters, numbers, or underscores.");
  }
  const email = String(request.auth.token.email || "").trim().toLowerCase();
  if (!email) throw new HttpsError("failed-precondition", "A verified email account is required.");
  let conflict = false;
  const result = await db.ref().transaction((root) => {
    root = cleanObject(root);
    root.nicknames = cleanObject(root.nicknames);
    root.profileClaims = cleanObject(root.profileClaims);
    root.privateProfiles = cleanObject(root.privateProfiles);
    root.publicProfiles = cleanObject(root.publicProfiles);
    const claimedBy = root.nicknames[lower];
    if (claimedBy && claimedBy !== uid) {
      conflict = true;
      return;
    }
    const existing = root.privateProfiles[uid];
    if (existing && existing.nicknameLower !== lower) {
      conflict = true;
      return;
    }
    const timestamp = now();
    root.nicknames[lower] = uid;
    root.profileClaims[uid] = lower;
    root.privateProfiles[uid] = existing || {
      uid,
      email,
      nickname,
      nicknameLower: lower,
      challengePoints: STARTING_CHALLENGE_POINTS,
      wins: 0,
      losses: 0,
      totalMatches: 0,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    root.publicProfiles[uid] = root.publicProfiles[uid] || {
      uid,
      nickname,
      nicknameLower: lower,
      status: "offline",
      lastSeen: timestamp,
      wins: 0,
      losses: 0,
      totalMatches: 0
    };
    return root;
  }, undefined, false);
  if (!result.committed || conflict) {
    throw new HttpsError("already-exists", "Nickname is already taken.");
  }
  return {ok: true, challengePoints: STARTING_CHALLENGE_POINTS};
});

export const migrateLegacyProfile = callable(async (request) => {
  const uid = assertAuth(request);
  await rateLimit(uid, "migrateLegacyProfile", 3, 60 * 60 * 1000);
  const legacySnap = await db.ref(`players/${uid}`).get();
  const legacy = legacySnap.val();
  if (!legacy) throw new HttpsError("not-found", "No legacy player profile was found.");
  const nickname = String(legacy.nickname || "").trim();
  const lower = nicknameKey(nickname);
  if (!NICKNAME_RE.test(nickname) || hasProfanity(nickname)) {
    throw new HttpsError("failed-precondition", "Choose a new clean nickname through support before migration.");
  }
  let conflict = false;
  const email = String(request.auth.token.email || "").trim().toLowerCase();
  const result = await db.ref().transaction((root) => {
    root = cleanObject(root);
    root.nicknames = cleanObject(root.nicknames);
    root.profileClaims = cleanObject(root.profileClaims);
    root.privateProfiles = cleanObject(root.privateProfiles);
    root.publicProfiles = cleanObject(root.publicProfiles);
    if (root.nicknames[lower] && root.nicknames[lower] !== uid) {
      conflict = true;
      return;
    }
    const timestamp = now();
    root.nicknames[lower] = uid;
    root.profileClaims[uid] = lower;
    root.privateProfiles[uid] = root.privateProfiles[uid] || {
      uid,
      email,
      nickname,
      nicknameLower: lower,
      challengePoints: STARTING_CHALLENGE_POINTS,
      wins: 0,
      losses: 0,
      totalMatches: 0,
      migratedAt: timestamp,
      createdAt: Number(legacy.createdAt || timestamp),
      updatedAt: timestamp
    };
    root.publicProfiles[uid] = root.publicProfiles[uid] || {
      uid,
      nickname,
      nicknameLower: lower,
      status: "offline",
      lastSeen: timestamp,
      wins: 0,
      losses: 0,
      totalMatches: 0
    };
    if (root.players) delete root.players[uid];
    return root;
  }, undefined, false);
  if (!result.committed || conflict) {
    throw new HttpsError("already-exists", "The legacy nickname is no longer available.");
  }
  return {migrated: true};
});

export const createRoom = callable(async (request) => {
  const uid = assertAuth(request);
  await rateLimit(uid, "createRoom", 12, 5 * 60 * 1000);
  const stageId = int(request.data?.stageId, 1, MAX_STAGE, 1);
  const profile = await getPublicProfile(uid);
  const timestamp = now();
  const created = await createUniqueRoom((code) => ({
    code,
    status: "waiting",
    stageId,
    boardSeed: stageId,
    current: 1,
    hostUid: uid,
    guestUid: "",
    players: {p1: uid},
    playerNames: {p1: profile.nickname},
    stakes: {p1: 0, p2: 0},
    stakeConfirmed: {p1: false, p2: false},
    scores: {p1: 0, p2: 0},
    moveCount: 0,
    resetVersion: 0,
    edgeOwners: {},
    boxOwners: {},
    createdAt: timestamp,
    updatedAt: timestamp
  }));
  await db.ref(`userRooms/${uid}/${created.code}`).set(true);
  return {code: created.code};
});

export const joinRoom = callable(async (request) => {
  const uid = assertAuth(request);
  await rateLimit(uid, "joinRoom", 20, 5 * 60 * 1000);
  const code = String(request.data?.code || "").trim().toUpperCase();
  if (!ROOM_CODE_RE.test(code)) throw new HttpsError("invalid-argument", "Enter a valid room code.");
  const profile = await getPublicProfile(uid);
  let reason = "not-found";
  const result = await db.ref(`rooms/${code}`).transaction((room) => {
    if (!room) {
      reason = "not-found";
      return;
    }
    if (room.players?.p1 === uid) {
      reason = "host";
      return room;
    }
    if (room.players?.p2 && room.players.p2 !== uid) {
      reason = "full";
      return;
    }
    if (!["waiting", "stakeReview"].includes(room.status)) {
      reason = "closed";
      return;
    }
    room.players = cleanObject(room.players);
    room.playerNames = cleanObject(room.playerNames);
    room.stakes = cleanObject(room.stakes);
    room.stakeConfirmed = cleanObject(room.stakeConfirmed);
    room.players.p2 = uid;
    room.playerNames.p2 = profile.nickname;
    room.guestUid = uid;
    room.stakes.p2 = 0;
    room.stakeConfirmed.p2 = false;
    room.status = "stakeReview";
    room.joinedAt = now();
    room.updatedAt = now();
    reason = "ok";
    return room;
  }, undefined, false);
  if (!result.committed || reason === "not-found") throw new HttpsError("not-found", "Room was not found.");
  if (reason === "full") throw new HttpsError("already-exists", "Room already has two players.");
  if (reason === "closed") throw new HttpsError("failed-precondition", "Room is no longer joinable.");
  await db.ref(`userRooms/${uid}/${code}`).set(true);
  return {code, localPlayer: 2};
});

export const confirmChallengePoints = callable(async (request) => {
  const uid = assertAuth(request);
  await rateLimit(uid, "confirmChallengePoints", 20, 5 * 60 * 1000);
  const code = String(request.data?.code || "").trim().toUpperCase();
  const amount = int(request.data?.amount, 0, 1000, 0);
  const stageId = int(request.data?.stageId, 1, MAX_STAGE, 1);
  if (!ROOM_CODE_RE.test(code)) throw new HttpsError("invalid-argument", "Invalid room code.");
  const roomSnap = await db.ref(`rooms/${code}`).get();
  const room = roomSnap.val();
  if (!room) throw new HttpsError("not-found", "Room was not found.");
  const role = room.players?.p1 === uid ? "p1" : (room.players?.p2 === uid ? "p2" : "");
  if (!role) throw new HttpsError("permission-denied", "You are not a participant in this room.");
  await reservePoints(uid, code, amount);
  let accepted = false;
  try {
    const result = await db.ref(`rooms/${code}`).transaction((current) => {
      if (!current || current.status === "finished" || current.status === "abandoned") return;
      const currentRole = current.players?.p1 === uid ? "p1" : (current.players?.p2 === uid ? "p2" : "");
      if (!currentRole || currentRole !== role) return;
      current.stakes = cleanObject(current.stakes);
      current.stakeConfirmed = cleanObject(current.stakeConfirmed);
      current.stakes[role] = amount;
      current.stakeConfirmed[role] = true;
      if (role === "p1") {
        current.stageId = stageId;
        current.boardSeed = stageId;
      }
      const bothPlayers = Boolean(current.players?.p1 && current.players?.p2);
      const bothConfirmed = Boolean(current.stakeConfirmed.p1 && current.stakeConfirmed.p2);
      current.status = bothPlayers && bothConfirmed ? "joined" : "stakeReview";
      current.updatedAt = now();
      if (current.status === "joined") current.startedAt = current.startedAt || now();
      accepted = true;
      return current;
    }, undefined, false);
    if (!result.committed || !accepted) throw new Error("Room confirmation failed.");
    return {status: result.snapshot.val().status, amount};
  } catch (error) {
    await releaseReservation(uid, code);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("aborted", "Could not confirm Challenge Points.");
  }
});

export const sendChallenge = callable(async (request) => {
  const uid = assertAuth(request);
  await rateLimit(uid, "sendChallenge", 10, 5 * 60 * 1000);
  const receiverUid = String(request.data?.receiverUid || "");
  const amount = int(request.data?.amount, 0, 1000, 0);
  const stageId = int(request.data?.stageId, 1, MAX_STAGE, 1);
  if (!receiverUid || receiverUid === uid) throw new HttpsError("invalid-argument", "Choose another player.");
  const [senderPublic, senderPrivate, receiverPublic, blockedByReceiver, blockedBySender] = await Promise.all([
    getPublicProfile(uid),
    getPrivateProfile(uid),
    getPublicProfile(receiverUid),
    db.ref(`blocks/${receiverUid}/${uid}`).get(),
    db.ref(`blocks/${uid}/${receiverUid}`).get()
  ]);
  if (blockedByReceiver.exists() || blockedBySender.exists()) {
    throw new HttpsError("permission-denied", "This challenge cannot be sent.");
  }
  if (amount > Number(senderPrivate.challengePoints || 0) || amount > entryLimit(senderPrivate.totalMatches)) {
    throw new HttpsError("failed-precondition", "Not enough Challenge Points.");
  }
  const inviteRef = db.ref(`invites/${receiverUid}`).push();
  const timestamp = now();
  await db.ref().update({
    [`invites/${receiverUid}/${inviteRef.key}`]: {
      fromUid: uid,
      fromNickname: senderPublic.nickname,
      receiverNickname: receiverPublic.nickname,
      fromStake: amount,
      stageId,
      status: "pending",
      roomCode: "",
      createdAt: timestamp,
      expiresAt: timestamp + INVITE_TTL_MS
    },
    [`userSentInvites/${uid}/${receiverUid}/${inviteRef.key}`]: true
  });
  return {inviteId: inviteRef.key};
});

export const acceptChallenge = callable(async (request) => {
  const uid = assertAuth(request);
  await rateLimit(uid, "acceptChallenge", 12, 5 * 60 * 1000);
  const inviteId = String(request.data?.inviteId || "");
  const receiverAmount = int(request.data?.amount, 0, 1000, 0);
  if (!inviteId) throw new HttpsError("invalid-argument", "Challenge is missing.");
  const inviteRef = db.ref(`invites/${uid}/${inviteId}`);
  const token = randomToken(12);
  let invite = null;
  const claim = await inviteRef.transaction((value) => {
    if (!value || value.status !== "pending" || Number(value.expiresAt || 0) < now()) return;
    invite = value;
    return {...value, status: "accepting", acceptToken: token, acceptingAt: now()};
  }, undefined, false);
  if (!claim.committed || !invite) throw new HttpsError("failed-precondition", "Challenge is no longer available.");
  const senderUid = invite.fromUid;
  const senderAmount = int(invite.fromStake, 0, 1000, 0);
  let code = "";
  try {
    const [senderPublic, receiverPublic, blocked] = await Promise.all([
      getPublicProfile(senderUid),
      getPublicProfile(uid),
      db.ref(`blocks/${uid}/${senderUid}`).get()
    ]);
    if (blocked.exists()) throw new HttpsError("permission-denied", "This player is blocked.");
    const provisionalCode = makeRoomCode();
    await reservePoints(senderUid, provisionalCode, senderAmount);
    try {
      await reservePoints(uid, provisionalCode, receiverAmount);
    } catch (error) {
      await releaseReservation(senderUid, provisionalCode);
      throw error;
    }
    const timestamp = now();
    try {
      const created = await createUniqueRoom((roomCode) => {
        code = roomCode;
        return {
          code: roomCode,
          status: "joined",
          stageId: int(invite.stageId, 1, MAX_STAGE, 1),
          boardSeed: int(invite.stageId, 1, MAX_STAGE, 1),
          current: 1,
          hostUid: senderUid,
          guestUid: uid,
          players: {p1: senderUid, p2: uid},
          playerNames: {p1: senderPublic.nickname, p2: receiverPublic.nickname},
          stakes: {p1: senderAmount, p2: receiverAmount},
          stakeConfirmed: {p1: true, p2: true},
          scores: {p1: 0, p2: 0},
          moveCount: 0,
          resetVersion: 0,
          edgeOwners: {},
          boxOwners: {},
          createdAt: timestamp,
          joinedAt: timestamp,
          startedAt: timestamp,
          updatedAt: timestamp
        };
      });
      code = created.code;
      if (code !== provisionalCode) {
        const [senderReservation, receiverReservation] = await Promise.all([
          db.ref(`privateProfiles/${senderUid}/reservations/${provisionalCode}`).get(),
          db.ref(`privateProfiles/${uid}/reservations/${provisionalCode}`).get()
        ]);
        await Promise.all([
          db.ref(`privateProfiles/${senderUid}/reservations/${code}`).set(senderReservation.val()),
          db.ref(`privateProfiles/${uid}/reservations/${code}`).set(receiverReservation.val())
        ]);
        await Promise.all([
          db.ref(`privateProfiles/${senderUid}/reservations/${provisionalCode}`).remove(),
          db.ref(`privateProfiles/${uid}/reservations/${provisionalCode}`).remove()
        ]);
      }
    } catch (error) {
      await Promise.all([
        releaseReservation(senderUid, provisionalCode),
        releaseReservation(uid, provisionalCode)
      ]);
      throw error;
    }
    await inviteRef.update({status: "accepted", roomCode: code, acceptedAt: now(), acceptToken: null});
    await db.ref().update({
      [`userRooms/${senderUid}/${code}`]: true,
      [`userRooms/${uid}/${code}`]: true,
      [`userSentInvites/${senderUid}/${uid}/${inviteId}`]: null
    });
    return {code, localPlayer: 2};
  } catch (error) {
    await inviteRef.transaction((value) => {
      if (value?.acceptToken !== token) return value;
      return {...value, status: "pending", acceptToken: null, acceptingAt: null};
    }, undefined, false);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("aborted", "Could not accept this challenge.");
  }
});

export const rejectChallenge = callable(async (request) => {
  const uid = assertAuth(request);
  const inviteId = String(request.data?.inviteId || "");
  if (!inviteId) throw new HttpsError("invalid-argument", "Challenge is missing.");
  let rejected = false;
  let senderUid = "";
  await db.ref(`invites/${uid}/${inviteId}`).transaction((invite) => {
    if (!invite || invite.status !== "pending") return;
    senderUid = invite.fromUid || "";
    rejected = true;
    return {...invite, status: "rejected", rejectedAt: now()};
  }, undefined, false);
  if (senderUid) await db.ref(`userSentInvites/${senderUid}/${uid}/${inviteId}`).remove();
  return {rejected};
});

export const submitMove = callable(async (request) => {
  const uid = assertAuth(request);
  await rateLimit(uid, "submitMove", 240, 5 * 60 * 1000);
  const code = String(request.data?.code || "").trim().toUpperCase();
  const edge = String(request.data?.edgeKey || "");
  if (!ROOM_CODE_RE.test(code) || !EDGE_RE.test(edge)) {
    throw new HttpsError("invalid-argument", "Invalid move.");
  }
  let rejection = "invalid";
  let finalRoom = null;
  const moveKey = db.ref(`rooms/${code}/moves`).push().key;
  const result = await db.ref(`rooms/${code}`).transaction((room) => {
    if (!room) {
      rejection = "missing";
      return;
    }
    if (room.status !== "joined") {
      rejection = "closed";
      return;
    }
    const player = room.players?.p1 === uid ? 1 : (room.players?.p2 === uid ? 2 : 0);
    if (!player) {
      rejection = "participant";
      return;
    }
    if (Number(room.current || 1) !== player) {
      rejection = "turn";
      return;
    }
    const stageId = int(room.stageId, 1, MAX_STAGE, 1);
    const arena = buildArena(stageId);
    if (!arena.edges.has(edge)) {
      rejection = "edge";
      return;
    }
    room.edgeOwners = cleanObject(room.edgeOwners);
    room.boxOwners = cleanObject(room.boxOwners);
    room.scores = cleanObject(room.scores);
    room.moves = cleanObject(room.moves);
    if (room.edgeOwners[edge]) {
      rejection = "owned";
      return;
    }
    room.edgeOwners[edge] = player;
    let gained = 0;
    for (const key of adjacentCells(edge, arena)) {
      if (room.boxOwners[key]) continue;
      const closed = cellEdges(key).every((candidate) => Number(room.edgeOwners[candidate] || 0) > 0);
      if (closed) {
        room.boxOwners[key] = player;
        gained += 1;
      }
    }
    const scoreKey = player === 1 ? "p1" : "p2";
    room.scores[scoreKey] = Number(room.scores[scoreKey] || 0) + gained;
    if (!gained) room.current = player === 1 ? 2 : 1;
    room.moveCount = Number(room.moveCount || 0) + 1;
    room.moves[moveKey] = {
      edgeKey: edge,
      player,
      uid,
      moveNumber: room.moveCount,
      createdAt: now()
    };
    room.updatedAt = now();
    rejection = "ok";
    const completed = Object.keys(room.boxOwners).length;
    if (completed >= arena.cellCount) {
      const p1Score = Number(room.scores.p1 || 0);
      const p2Score = Number(room.scores.p2 || 0);
      room.status = "finished";
      room.finishedAt = now();
      room.outcome = p1Score === p2Score ? "draw" : "win";
      room.winnerUid = p1Score === p2Score ? "" : (p1Score > p2Score ? room.players.p1 : room.players.p2);
      room.settlement = {status: "pending", updatedAt: now()};
    }
    return room;
  }, undefined, false);
  if (!result.committed) {
    const messages = {
      missing: ["not-found", "Room was not found."],
      closed: ["failed-precondition", "This room is not accepting moves."],
      participant: ["permission-denied", "You are not a participant in this room."],
      turn: ["failed-precondition", "Wait for your turn."],
      edge: ["invalid-argument", "That line is not part of this arena."],
      owned: ["already-exists", "That line was already drawn."]
    };
    const [codeName, message] = messages[rejection] || ["aborted", "Move was rejected."];
    throw new HttpsError(codeName, message);
  }
  finalRoom = result.snapshot.val();
  if (finalRoom.status === "finished") await settleRoom(code, finalRoom);
  return {
    accepted: true,
    player: finalRoom.moves?.[moveKey]?.player || 0,
    current: Number(finalRoom.current || 1),
    scores: finalRoom.scores || {p1: 0, p2: 0},
    status: finalRoom.status
  };
});

export const reportPlayer = callable(async (request) => {
  const uid = assertAuth(request);
  await rateLimit(uid, "reportPlayer", 5, 24 * 60 * 60 * 1000);
  const targetUid = String(request.data?.targetUid || "");
  const reason = String(request.data?.reason || "inappropriate-behavior").slice(0, 80);
  if (!targetUid || targetUid === uid) throw new HttpsError("invalid-argument", "Choose another player.");
  await getPublicProfile(targetUid);
  const reportRef = db.ref("reports").push();
  await db.ref().update({
    [`reports/${reportRef.key}`]: {
      reporterUid: uid,
      targetUid,
      reason,
      status: "open",
      createdAt: now()
    },
    [`userReports/${uid}/${reportRef.key}`]: true,
    [`userReports/${targetUid}/${reportRef.key}`]: true
  });
  return {reported: true};
});

export const blockPlayer = callable(async (request) => {
  const uid = assertAuth(request);
  await rateLimit(uid, "blockPlayer", 30, 24 * 60 * 60 * 1000);
  const targetUid = String(request.data?.targetUid || "");
  if (!targetUid || targetUid === uid) throw new HttpsError("invalid-argument", "Choose another player.");
  const profile = await getPublicProfile(targetUid);
  await db.ref(`blocks/${uid}/${targetUid}`).set({
    nickname: profile.nickname,
    createdAt: now()
  });
  return {blocked: true};
});

export const deleteAccount = callable(async (request) => {
  const uid = assertAuth(request, {verified: false});
  if (request.app?.alreadyConsumed) {
    throw new HttpsError("failed-precondition", "A fresh App Check token is required.");
  }
  const authTime = Number(request.auth.token.auth_time || 0) * 1000;
  if (!authTime || now() - authTime > 60 * 60 * 1000) {
    throw new HttpsError("failed-precondition", "recent-login-required");
  }
  const privateSnap = await db.ref(`privateProfiles/${uid}`).get();
  const privateProfile = privateSnap.val() || {};
  const nicknameLower = privateProfile.nicknameLower || "";
  const [roomIndexSnap, matchIndexSnap, sentInvitesSnap, incomingInvitesSnap, reportIndexSnap] = await Promise.all([
    db.ref(`userRooms/${uid}`).get(),
    db.ref(`userMatches/${uid}`).get(),
    db.ref(`userSentInvites/${uid}`).get(),
    db.ref(`invites/${uid}`).get(),
    db.ref(`userReports/${uid}`).get()
  ]);
  const updates = {};
  const roomCodes = [];
  roomIndexSnap.forEach((child) => roomCodes.push(child.key));
  const roomSnaps = await Promise.all(roomCodes.map((code) => db.ref(`rooms/${code}`).get()));
  const roomJobs = roomSnaps.map((snap, index) => {
    const room = snap.val() || {};
    if (!room || ["finished", "abandoned"].includes(room.status)) return Promise.resolve();
    return abandonRoom(roomCodes[index], room, "account-deleted");
  });
  await Promise.all(roomJobs);
  roomSnaps.forEach((snap, index) => {
    const room = snap.val() || {};
    const otherUid = room.players?.p1 === uid ? room.players?.p2 : room.players?.p1;
    if (otherUid) updates[`userRooms/${otherUid}/${roomCodes[index]}`] = null;
    updates[`rooms/${roomCodes[index]}`] = null;
  });
  const matchIds = [];
  matchIndexSnap.forEach((child) => matchIds.push(child.key));
  const matchSnaps = await Promise.all(matchIds.map((id) => db.ref(`matches/${id}`).get()));
  matchSnaps.forEach((snap, index) => {
    const match = snap.val() || {};
    const otherUid = match.p1Uid === uid ? match.p2Uid : match.p1Uid;
    if (otherUid) updates[`userMatches/${otherUid}/${matchIds[index]}`] = null;
    updates[`matches/${matchIds[index]}`] = null;
  });
  sentInvitesSnap.forEach((receiver) => {
    receiver.forEach((invite) => {
      updates[`invites/${receiver.key}/${invite.key}`] = null;
    });
  });
  incomingInvitesSnap.forEach((invite) => {
    const senderUid = invite.val()?.fromUid;
    if (senderUid) updates[`userSentInvites/${senderUid}/${uid}/${invite.key}`] = null;
  });
  updates[`invites/${uid}`] = null;
  const reportIds = [];
  reportIndexSnap.forEach((child) => reportIds.push(child.key));
  const reportSnaps = await Promise.all(reportIds.map((id) => db.ref(`reports/${id}`).get()));
  reportSnaps.forEach((snap, index) => {
    const report = snap.val() || {};
    if (report.reporterUid === uid) updates[`reports/${reportIds[index]}/reporterUid`] = "deleted-account";
    if (report.targetUid === uid) updates[`reports/${reportIds[index]}/targetUid`] = "deleted-account";
  });
  updates[`privateProfiles/${uid}`] = null;
  updates[`publicProfiles/${uid}`] = null;
  updates[`online/${uid}`] = null;
  updates[`blocks/${uid}`] = null;
  updates[`userRooms/${uid}`] = null;
  updates[`userMatches/${uid}`] = null;
  updates[`userSentInvites/${uid}`] = null;
  updates[`userReports/${uid}`] = null;
  updates[`rateLimits/${uid}`] = null;
  updates[`profileClaims/${uid}`] = null;
  if (nicknameLower) updates[`nicknames/${nicknameLower}`] = null;
  await db.ref().update(updates);
  await auth.deleteUser(uid);
  return {deleted: true};
}, {consumeAppCheckToken: true});

export const reconcileRooms = onSchedule(
  {
    schedule: "every 10 minutes",
    region: "asia-southeast1",
    timeoutSeconds: 120,
    memory: "256MiB"
  },
  async () => {
    const snap = await db.ref("rooms").get();
    const jobs = [];
    snap.forEach((child) => {
      const room = child.val() || {};
      if (room.status === "finished" && room.settlement?.status !== "complete") {
        jobs.push(settleRoom(child.key, room));
      } else if (!["finished", "abandoned"].includes(room.status) && now() - Number(room.updatedAt || room.createdAt || 0) > ROOM_ABANDON_MS) {
        jobs.push(abandonRoom(child.key, room, "timeout"));
      }
    });
    await Promise.allSettled(jobs);
  }
);
