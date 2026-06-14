import fs from "node:fs";
import path from "node:path";
import test, {after, before, beforeEach} from "node:test";
import assert from "node:assert/strict";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from "@firebase/rules-unit-testing";

const projectId = "box-chain-arena-rules-test";
const rules = fs.readFileSync(path.resolve("../database.rules.json"), "utf8");
let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId,
    database: {rules}
  });
});

beforeEach(async () => {
  await env.clearDatabase();
  await env.withSecurityRulesDisabled(async (context) => {
    await context.database().ref().set({
      publicProfiles: {
        alice: {
          uid: "alice",
          nickname: "Alice",
          nicknameLower: "alice",
          status: "offline",
          lastSeen: 1,
          wins: 2,
          losses: 1,
          totalMatches: 3
        },
        bob: {
          uid: "bob",
          nickname: "Bob",
          nicknameLower: "bob",
          status: "online",
          lastSeen: 1,
          wins: 1,
          losses: 2,
          totalMatches: 3
        }
      },
      privateProfiles: {
        alice: {
          uid: "alice",
          email: "alice@example.com",
          challengePoints: 100
        }
      },
      rooms: {
        "BOX-ABCDEF": {
          code: "BOX-ABCDEF",
          status: "joined",
          players: {p1: "alice", p2: "bob"},
          playerNames: {p1: "Alice", p2: "Bob"},
          current: 1,
          scores: {p1: 0, p2: 0}
        }
      }
    });
  });
});

after(async () => {
  await env.cleanup();
});

function verified(uid) {
  return env.authenticatedContext(uid, {email_verified: true}).database();
}

test("public profile collection requires a verified account", async () => {
  await assertFails(env.unauthenticatedContext().database().ref("publicProfiles").get());
  await assertFails(env.authenticatedContext("alice", {email_verified: false}).database().ref("publicProfiles").get());
  await assertSucceeds(verified("alice").ref("publicProfiles").get());
});

test("a player can read private data but cannot change challenge points", async () => {
  const alice = verified("alice");
  const bob = verified("bob");
  await assertSucceeds(alice.ref("privateProfiles/alice").get());
  await assertFails(bob.ref("privateProfiles/alice").get());
  await assertFails(alice.ref("privateProfiles/alice/challengePoints").set(999999));
});

test("limited private progress totals can be saved by the owner", async () => {
  const alice = verified("alice");
  await assertSucceeds(alice.ref("privateProfiles/alice/progress").set({
    stars: 12,
    cleared: 5,
    guideSeen: true,
    onlineGuideSeen: false,
    tutorialDone: true,
    updatedAt: Date.now()
  }));
  await assertFails(alice.ref("privateProfiles/alice/progress").set({
    stars: 9999,
    cleared: 5,
    guideSeen: true,
    onlineGuideSeen: false,
    tutorialDone: true,
    updatedAt: Date.now()
  }));
});

test("clients cannot alter match state or submit moves directly", async () => {
  const alice = verified("alice");
  await assertFails(alice.ref("rooms/BOX-ABCDEF/status").set("finished"));
  await assertFails(alice.ref("rooms/BOX-ABCDEF/moves/fake").set({
    uid: "alice",
    player: 1,
    edgeKey: "h:0:0"
  }));
});

test("a participant can update only their own connection heartbeat", async () => {
  const alice = verified("alice");
  const heartbeat = {
    online: true,
    uid: "alice",
    nickname: "Alice",
    lastSeen: Date.now()
  };
  await assertSucceeds(alice.ref("rooms/BOX-ABCDEF/connections/p1").set(heartbeat));
  await assertFails(alice.ref("rooms/BOX-ABCDEF/connections/p2").set({...heartbeat, uid: "bob"}));
});

test("public stats and nickname are immutable from the client", async () => {
  const alice = verified("alice");
  const profileRef = alice.ref("publicProfiles/alice");
  const snapshot = await profileRef.get();
  await assertFails(profileRef.set({...snapshot.val(), wins: 999}));
  await assertFails(profileRef.set({...snapshot.val(), nickname: "Impersonated"}));
  await assertSucceeds(profileRef.set({...snapshot.val(), status: "online", lastSeen: Date.now()}));
  assert.equal((await profileRef.get()).val().wins, 2);
});
