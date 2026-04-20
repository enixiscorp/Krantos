// ============================================================
// Krantos Platform — PowerCalculator
// Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
// ============================================================

import type { ApplianceInput, ApplianceBreakdown } from '../lib/supabase';

/**
 * The result returned by `calculateTotalPower`.
 *
 * - `totalWatts`  — sum of all per-appliance totals, multiplied by the 1.3 safety margin
 * - `totalKVA`    — `totalWatts / 1000`
 * - `breakdown`   — per-appliance detail (before the safety margin)
 */
export interface PowerCalculationResult {
  totalWatts: number;
  totalKVA: number;
  breakdown: ApplianceBreakdown[];
}

/** Safety margin factor applied to the raw sum (Requirement 3.3). */
const SAFETY_MARGIN = 1.3;

/** Voltage assumed for Ampere-to-Watt conversion (Requirement 3.1). */
const ASSUMED_VOLTAGE = 220;

/**
 * Normalises a single appliance's power value to Watts.
 *
 * - `W` → direct value (Requirement 3.1)
 * - `A` → Ampères × 220 V (Requirement 3.1)
 * - `V` → direct value in Watts (Requirement 3.1)
 *
 * @param power - The raw power value entered by the user.
 * @param unit  - The unit of the power value ('W', 'A', or 'V').
 * @returns The equivalent power in Watts.
 */
function normaliseToPowerInWatts(power: number, unit: ApplianceInput['unit']): number {
  switch (unit) {
    case 'W':
      return power;
    case 'A':
      return power * ASSUMED_VOLTAGE;
    case 'V':
      return power;
  }
}

/**
 * Calculates the total electrical power requirement for a list of appliances.
 *
 * Steps:
 * 1. Normalise each appliance's power to Watts (Requirement 3.1).
 * 2. Compute per-appliance total: `powerInWatts × quantity` (Requirement 3.2).
 * 3. Sum all per-appliance totals and apply the 1.3 safety margin (Requirement 3.3).
 * 4. Convert the result to kVA by dividing by 1000 (Requirement 3.4).
 * 5. Return `{ totalWatts, totalKVA, breakdown }` (Requirement 3.5).
 *
 * Note: the `totalWatts` field in each `ApplianceBreakdown` entry reflects the
 * per-appliance total **before** the safety margin (`powerInWatts × quantity`).
 *
 * @param appliances - Array of appliances entered by the user.
 * @returns A `PowerCalculationResult` with the total power and per-appliance breakdown.
 */
export function calculateTotalPower(appliances: ApplianceInput[]): PowerCalculationResult {
  // Step 1 & 2 — build the breakdown (pre-margin per-appliance totals)
  const breakdown: ApplianceBreakdown[] = appliances.map((appliance) => {
    const powerInWatts = normaliseToPowerInWatts(appliance.power, appliance.unit);
    const totalWatts = powerInWatts * appliance.quantity;
    return { name: appliance.name, powerInWatts, totalWatts };
  });

  // Step 3 — sum all per-appliance totals and apply the safety margin
  const rawSum = breakdown.reduce((acc, item) => acc + item.totalWatts, 0);
  const totalWatts = rawSum * SAFETY_MARGIN;

  // Step 4 — convert to kVA
  const totalKVA = totalWatts / 1000;

  // Step 5 — return the result
  return { totalWatts, totalKVA, breakdown };
}

/**
 * Namespace export for ergonomic usage:
 * ```ts
 * import { PowerCalculator } from './utils/powerCalculator';
 * const result = PowerCalculator.calculateTotalPower(appliances);
 * ```
 */
export const PowerCalculator = { calculateTotalPower };
