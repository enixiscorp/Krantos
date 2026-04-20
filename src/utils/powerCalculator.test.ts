// ============================================================
// Krantos Platform — PowerCalculator Property-Based Tests
// **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
// ============================================================

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { calculateTotalPower } from './powerCalculator';
import type { ApplianceInput } from '../lib/supabase';

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Generates a strictly positive finite number suitable as a power value. */
const positiveFiniteFloat = fc.double({ min: 0.01, max: 100_000, noNaN: true, noDefaultInfinity: true }).filter((v) => v > 0);

/** Generates a valid integer quantity (>= 1). */
const positiveQuantity = fc.integer({ min: 1, max: 100 });

/** Generates a valid appliance name. */
const applianceName = fc.string({ minLength: 1, maxLength: 50 });

/** Generates a valid ApplianceInput with unit 'W'. */
const applianceW: fc.Arbitrary<ApplianceInput> = fc.record({
  name: applianceName,
  quantity: positiveQuantity,
  power: positiveFiniteFloat,
  unit: fc.constant('W' as const),
});

/** Generates a valid ApplianceInput with unit 'A'. */
const applianceA: fc.Arbitrary<ApplianceInput> = fc.record({
  name: applianceName,
  quantity: positiveQuantity,
  power: positiveFiniteFloat,
  unit: fc.constant('A' as const),
});

/** Generates a valid ApplianceInput with unit 'V'. */
const applianceV: fc.Arbitrary<ApplianceInput> = fc.record({
  name: applianceName,
  quantity: positiveQuantity,
  power: positiveFiniteFloat,
  unit: fc.constant('V' as const),
});

/** Generates a valid ApplianceInput with any valid unit. */
const anyAppliance: fc.Arbitrary<ApplianceInput> = fc.oneof(applianceW, applianceA, applianceV);

// ---------------------------------------------------------------------------
// Property 1 — Unit Normalisation (Requirements 3.1, 3.2)
// ---------------------------------------------------------------------------

describe('PowerCalculator — Property 1: Unit Normalisation', () => {
  /**
   * Property 1a: For unit 'W', power_in_watts equals the raw power value directly.
   * Validates: Requirements 3.1
   */
  it('Property 1a — W unit: power_in_watts === power (direct value)', () => {
    fc.assert(
      fc.property(applianceW, (appliance) => {
        const result = calculateTotalPower([appliance]);
        const breakdown = result.breakdown[0];

        // power_in_watts must equal the raw power value for unit 'W'
        expect(breakdown.powerInWatts).toBeCloseTo(appliance.power, 5);

        // power_in_watts must be strictly positive
        expect(breakdown.powerInWatts).toBeGreaterThan(0);
      }),
      { numRuns: 200 }
    );
  });

  /**
   * Property 1b: For unit 'A', power_in_watts equals power × 220.
   * Validates: Requirements 3.1
   */
  it('Property 1b — A unit: power_in_watts === power × 220', () => {
    fc.assert(
      fc.property(applianceA, (appliance) => {
        const result = calculateTotalPower([appliance]);
        const breakdown = result.breakdown[0];

        // power_in_watts must equal power × 220 for unit 'A'
        expect(breakdown.powerInWatts).toBeCloseTo(appliance.power * 220, 5);

        // power_in_watts must be strictly positive
        expect(breakdown.powerInWatts).toBeGreaterThan(0);
      }),
      { numRuns: 200 }
    );
  });

  /**
   * Property 1c: For unit 'V', power_in_watts equals the raw power value directly.
   * Validates: Requirements 3.1
   */
  it('Property 1c — V unit: power_in_watts === power (direct value)', () => {
    fc.assert(
      fc.property(applianceV, (appliance) => {
        const result = calculateTotalPower([appliance]);
        const breakdown = result.breakdown[0];

        // power_in_watts must equal the raw power value for unit 'V'
        expect(breakdown.powerInWatts).toBeCloseTo(appliance.power, 5);

        // power_in_watts must be strictly positive
        expect(breakdown.powerInWatts).toBeGreaterThan(0);
      }),
      { numRuns: 200 }
    );
  });

  /**
   * Property 1d: For any valid appliance (W, A, V), power_in_watts is strictly positive.
   * Validates: Requirements 3.1
   */
  it('Property 1d — Any valid unit: power_in_watts is strictly positive', () => {
    fc.assert(
      fc.property(anyAppliance, (appliance) => {
        const result = calculateTotalPower([appliance]);
        const breakdown = result.breakdown[0];

        expect(breakdown.powerInWatts).toBeGreaterThan(0);
      }),
      { numRuns: 300 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 2 — Safety Margin Invariant and kVA Conversion (Requirements 3.3, 3.4, 3.5)
// ---------------------------------------------------------------------------

describe('PowerCalculator — Property 2: Safety Margin Invariant and kVA Conversion', () => {
  /**
   * Property 2: For any non-empty array of valid appliances, totalWatts equals
   * Σ(normalised_power × quantity) × 1.3, and totalKVA equals totalWatts / 1000.
   *
   * **Validates: Requirements 3.3, 3.4, 3.5**
   */
  it('Property 2 — totalWatts = Σ(powerInWatts × quantity) × 1.3 and totalKVA = totalWatts / 1000', () => {
    const applianceArbitrary: fc.Arbitrary<ApplianceInput> = fc.record({
      name: fc.string({ minLength: 1, maxLength: 50 }),
      quantity: fc.integer({ min: 1, max: 100 }),
      power: fc.double({ min: 0.1, max: 10000, noNaN: true, noDefaultInfinity: true }),
      unit: fc.constantFrom('W' as const, 'A' as const, 'V' as const),
    });

    fc.assert(
      fc.property(fc.array(applianceArbitrary, { minLength: 1 }), (appliances) => {
        const result = calculateTotalPower(appliances);

        // Manually compute the expected totalWatts:
        // 1. Normalise each appliance's power to Watts
        // 2. Multiply by quantity to get per-appliance watts
        // 3. Sum all per-appliance watts
        // 4. Apply the 1.3 safety margin
        const rawSum = appliances.reduce((acc, appliance) => {
          const powerInWatts =
            appliance.unit === 'A' ? appliance.power * 220 : appliance.power;
          return acc + powerInWatts * appliance.quantity;
        }, 0);
        const expectedTotalWatts = rawSum * 1.3;
        const expectedTotalKVA = expectedTotalWatts / 1000;

        // Assert totalWatts matches within floating-point tolerance
        expect(Math.abs(result.totalWatts - expectedTotalWatts)).toBeLessThan(0.001);

        // Assert totalKVA === totalWatts / 1000 within floating-point tolerance
        expect(Math.abs(result.totalKVA - expectedTotalKVA)).toBeLessThan(0.001);
      }),
      { numRuns: 300 }
    );
  });
});

// ---------------------------------------------------------------------------
// PowerCalculator — Unit Tests (Requirements 3.1, 3.2, 3.3, 3.4, 3.5)
// ---------------------------------------------------------------------------

describe('PowerCalculator — Unit Tests', () => {
  // 1. W unit conversion — value passed through directly
  it('W conversion: powerInWatts equals the raw power value', () => {
    const result = calculateTotalPower([{ name: 'Lamp', quantity: 1, power: 100, unit: 'W' }]);
    expect(result.breakdown[0].powerInWatts).toBe(100);
  });

  // 2. A unit conversion — value × 220
  it('A conversion: powerInWatts equals power × 220', () => {
    const result = calculateTotalPower([{ name: 'Motor', quantity: 1, power: 5, unit: 'A' }]);
    expect(result.breakdown[0].powerInWatts).toBe(1100); // 5 × 220
  });

  // 3. V unit conversion — value passed through directly
  it('V conversion: powerInWatts equals the raw power value', () => {
    const result = calculateTotalPower([{ name: 'Device', quantity: 1, power: 200, unit: 'V' }]);
    expect(result.breakdown[0].powerInWatts).toBe(200);
  });

  // 4. Safety margin of 1.3 applied to the raw sum
  it('Safety margin: totalWatts equals rawSum × 1.3', () => {
    const result = calculateTotalPower([{ name: 'Fan', quantity: 1, power: 1000, unit: 'W' }]);
    expect(result.totalWatts).toBe(1300); // 1000 × 1.3
  });

  // 5. kVA conversion — totalWatts / 1000
  it('kVA conversion: totalKVA equals totalWatts / 1000', () => {
    const result = calculateTotalPower([{ name: 'Fan', quantity: 1, power: 1000, unit: 'W' }]);
    expect(result.totalKVA).toBe(1.3); // 1300 / 1000
  });

  // 6. Multiple appliances with different quantities
  it('Multiple appliances: correct breakdown, totalWatts, and totalKVA', () => {
    const result = calculateTotalPower([
      { name: 'TV', quantity: 2, power: 100, unit: 'W' },
      { name: 'Fridge', quantity: 1, power: 150, unit: 'W' },
    ]);

    // Per-appliance breakdown
    expect(result.breakdown).toHaveLength(2);
    expect(result.breakdown[0].powerInWatts).toBe(100);
    expect(result.breakdown[0].totalWatts).toBe(200); // 100 × 2
    expect(result.breakdown[1].powerInWatts).toBe(150);
    expect(result.breakdown[1].totalWatts).toBe(150); // 150 × 1

    // Totals: rawSum = 350, × 1.3 = 455
    expect(result.totalWatts).toBe(455);
    expect(result.totalKVA).toBeCloseTo(0.455, 5);
  });
});
