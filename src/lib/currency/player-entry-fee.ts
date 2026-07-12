/** Player entry fees use ISO 4217 minor units today (default INR × paise); UI works in rupees-as-integer until multi-currency forms land. */

const INR_SUBUNIT_RATIO = 100;

export function wholeRupeesToInrMinorUnits(rupees: number): number {
  return Math.round(rupees * INR_SUBUNIT_RATIO);
}

export function inrMinorUnitsToWholeRupeeLabel(minorUnits: number | null | undefined): string {
  if (minorUnits === null || minorUnits === undefined) return "";
  return (minorUnits / INR_SUBUNIT_RATIO).toLocaleString("en-IN", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  });
}

export function formatMinorUnitsForDisplay(
  minorUnits: number | null,
  currencyCode: string,
): string {
  if (minorUnits === null) return "";
  if (currencyCode === "INR") {
    return `₹${inrMinorUnitsToWholeRupeeLabel(minorUnits)}`;
  }
  return `${currencyCode} ${minorUnits}`;
}
