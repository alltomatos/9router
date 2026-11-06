import crypto from "crypto";
import { defaultEngine } from "../engine.js";

const sessions = new Map();

export function registerSseSession(sendFn) {
  const sid = crypto.randomUUID();
  sessions.set(sid, {
    send: sendFn,
    createdAt: Date.now(),
  });
  return sid;
}

export function unregisterSseSession(sid) {
  sessions.delete(sid);
}

export async function handleIncomingMessage(sid, message) {
  const session = sessions.get(sid);
  if (!session) {
    throw new Error(`Session ${sid} not found`);
  }

  const response = await defaultEngine.handleMessage(message);
  if (response && session.send) {
    session.send(`event: message\ndata: ${JSON.stringify(response)}\n\n`);
  }
  return response;
}
