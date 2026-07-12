import { describe, expect, it } from "vitest";

import { minAcceptableBid, validateBidAmount } from "@/lib/draft/auction-bidding";

describe("minAcceptableBid", () => {
  it("uses the base price when nobody has bid", () => {
    expect(minAcceptableBid({ currentBid: null, basePrice: 500, minIncrement: 100 })).toBe(500);
  });

  it("requires current bid plus increment once bidding has started", () => {
    expect(minAcceptableBid({ currentBid: 500, basePrice: 500, minIncrement: 100 })).toBe(600);
  });
});

describe("validateBidAmount", () => {
  const ctx = {
    currentBid: 1000,
    basePrice: 500,
    minIncrement: 100,
    purseRemaining: 2000,
  };

  it("accepts a bid at exactly the minimum", () => {
    expect(validateBidAmount(1100, ctx)).toBeNull();
  });

  it("accepts a jump bid within purse", () => {
    expect(validateBidAmount(2000, ctx)).toBeNull();
  });

  it("rejects a bid below the minimum with the floor amount", () => {
    expect(validateBidAmount(1050, ctx)).toEqual({
      reason: "TOO_LOW",
      minAcceptable: 1100,
    });
  });

  it("rejects a bid the team cannot afford", () => {
    expect(validateBidAmount(2100, ctx)).toEqual({
      reason: "INSUFFICIENT_PURSE",
      purseRemaining: 2000,
    });
  });

  it("rejects an opening bid below base price", () => {
    expect(validateBidAmount(400, { ...ctx, currentBid: null })).toEqual({
      reason: "TOO_LOW",
      minAcceptable: 500,
    });
  });

  it("allows an opening bid at base price even when purse equals it exactly", () => {
    expect(
      validateBidAmount(500, {
        currentBid: null,
        basePrice: 500,
        minIncrement: 100,
        purseRemaining: 500,
      }),
    ).toBeNull();
  });

  it("checks purse before increment games: too-low takes precedence", () => {
    expect(validateBidAmount(50, { ...ctx, purseRemaining: 10 })).toEqual({
      reason: "TOO_LOW",
      minAcceptable: 1100,
    });
  });
});
