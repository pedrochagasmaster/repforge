import { describe, expect, it } from "vitest";
import {
  LIVE_WINDOW_MS,
  TOMBSTONE_MARGIN_MS,
  TRANSFER_STATES,
  canClaim,
  canCommit,
  expiryForCreate,
  nextAlarmAt,
  tombstoneUntil,
  transitionForTime,
} from "../src/lifetime.js";

const now = 1_800_000_000_000;

describe("transfer lifetime boundaries", () => {
  it("caps live records at one hour and leaves a fifteen-minute tombstone margin", () => {
    // ADR 0013's public limits must not move with the implementation constants.
    expect(LIVE_WINDOW_MS).toBe(3_600_000);
    expect(TOMBSTONE_MARGIN_MS).toBe(900_000);
    const expiresAt = expiryForCreate(now, now + 86_400_000);
    expect(expiresAt).toBe(now + 3_600_000);
    expect(expiryForCreate(now)).toBe(now + 3_600_000);
    expect(expiryForCreate(now, now + 12_345)).toBe(now + 12_345);
    expect(tombstoneUntil(expiresAt)).toBe(now + 4_500_000);
  });

  it("separates unclaimed expiry from an uncommitted claim", () => {
    const available = { state: TRANSFER_STATES.AVAILABLE, expiresAt: now + 10, tombstoneUntil: now + 20 };
    const claiming = { state: TRANSFER_STATES.CLAIMING, expiresAt: now + 10, tombstoneUntil: now + 20 };
    expect(transitionForTime(available, now + 10)).toBe(TRANSFER_STATES.EXPIRED);
    expect(transitionForTime(claiming, now + 10)).toBe(TRANSFER_STATES.CLAIMED_EXPIRED);
    expect(canClaim(available, now)).toBe(true);
    expect(canClaim(available, now + 10)).toBe(false);
    expect(canCommit({ ...claiming }, now)).toBe(true);
    expect(canCommit({ ...claiming }, now + 10)).toBe(false);
  });

  it("schedules the live expiry first and purges a terminal tombstone at its margin", () => {
    const live = { state: TRANSFER_STATES.AVAILABLE, expiresAt: now + 10, tombstoneUntil: now + 20 };
    expect(nextAlarmAt(live, now)).toBe(now + 10);
    const deleted = { state: TRANSFER_STATES.DELETED, expiresAt: now + 10, tombstoneUntil: now + 20 };
    expect(nextAlarmAt(deleted, now)).toBe(now + 20);
    expect(nextAlarmAt(deleted, now + 21)).toBe(now + 21);
  });
});
