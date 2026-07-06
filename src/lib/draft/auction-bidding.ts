/** Pure bid-validation math for the live auction, kept out of the service so
 * the purse rules are unit-testable without a database. */

export interface BidContext {
  /** Current highest bid on the lot; null when nobody has bid. */
  currentBid: number | null;
  basePrice: number;
  minIncrement: number;
  /** Bidding team's purse minus what it has already spent on sold lots. */
  purseRemaining: number;
}

export function minAcceptableBid(ctx: Pick<BidContext, "currentBid" | "basePrice" | "minIncrement">): number {
  return ctx.currentBid !== null ? ctx.currentBid + ctx.minIncrement : ctx.basePrice;
}

export type BidRejection =
  | { reason: "TOO_LOW"; minAcceptable: number }
  | { reason: "INSUFFICIENT_PURSE"; purseRemaining: number };

export function validateBidAmount(
  amount: number,
  ctx: BidContext,
): BidRejection | null {
  const floor = minAcceptableBid(ctx);
  if (amount < floor) {
    return { reason: "TOO_LOW", minAcceptable: floor };
  }
  if (amount > ctx.purseRemaining) {
    return { reason: "INSUFFICIENT_PURSE", purseRemaining: ctx.purseRemaining };
  }
  return null;
}
