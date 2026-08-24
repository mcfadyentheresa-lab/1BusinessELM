import { describe, it, expect } from "vitest";
import { calcItemTotal, computeEstimateTotals, isValidLineItemNumber, lineItemHasInvalidNumbers, type LineItem } from "./estimate-math";

function item(overrides: Partial<LineItem> = {}): LineItem {
  return {
    category_id: "cat-1",
    custom_category: "",
    room: "",
    quantity: "1",
    unit_type: "sq_ft",
    unit_cost: "0",
    material_cost: "0",
    notes: "",
    assembly_id: null,
    material_from_assembly: false,
    ai_suggested: false,
    ...overrides,
  };
}

describe("calcItemTotal", () => {
  it("multiplies (labor + material) by quantity", () => {
    // 10 sq ft * ($5 labor + $2 material) = $70
    const result = calcItemTotal(item({ quantity: "10", unit_cost: "5", material_cost: "2" }));
    expect(result).toBe(70);
  });

  it("treats missing/blank numeric fields as zero", () => {
    const result = calcItemTotal(item({ quantity: "", unit_cost: "", material_cost: "" }));
    expect(result).toBe(0);
  });

  it("treats a non-numeric quantity as zero instead of NaN", () => {
    // Regression: a bad value used to make labor/material NaN, and NaN
    // poisons Array.reduce for every other item's total too - a single
    // stray "." could silently zero out the entire estimate's total.
    const result = calcItemTotal(item({ quantity: ".", unit_cost: "5", material_cost: "2" }));
    expect(result).toBe(0);
    expect(Number.isNaN(result)).toBe(false);
  });
});

describe("lineItemHasInvalidNumbers", () => {
  it("flags a bare '.' as invalid", () => {
    expect(lineItemHasInvalidNumbers(item({ quantity: "." }))).toBe(true);
  });

  it("does not flag valid decimals or empty strings", () => {
    expect(lineItemHasInvalidNumbers(item({ quantity: "12.5", unit_cost: "0", material_cost: "" }))).toBe(false);
  });

  it("does not flag a fully valid item", () => {
    expect(lineItemHasInvalidNumbers(item({ quantity: "10", unit_cost: "5", material_cost: "2" }))).toBe(false);
  });
});

describe("isValidLineItemNumber", () => {
  it("accepts empty string, integers, and decimals", () => {
    expect(isValidLineItemNumber("")).toBe(true);
    expect(isValidLineItemNumber("0")).toBe(true);
    expect(isValidLineItemNumber("12.5")).toBe(true);
  });

  it("rejects negatives, garbage, and a bare dot", () => {
    expect(isValidLineItemNumber("-5")).toBe(false);
    expect(isValidLineItemNumber("abc")).toBe(false);
    expect(isValidLineItemNumber(".")).toBe(false);
  });
});

describe("computeEstimateTotals", () => {
  // Hand-calculated reference case:
  //   Item A: 10 sq ft * ($20 labor + $5 material) = $250
  //   Item B: 2 hours  * ($100 labor + $0 material) = $200
  //   subtotal = $450
  //   contingency 10%  = $45          -> subtotalWithContingency = $495
  //   markup 25% of $495 = $123.75    -> subtotalWithMarkup = $618.75
  //   management fee 15% of $618.75 = $92.8125 -> total = $711.5625
  const items: LineItem[] = [
    item({ quantity: "10", unit_type: "sq_ft", unit_cost: "20", material_cost: "5" }),
    item({ quantity: "2", unit_type: "hour", unit_cost: "100", material_cost: "0" }),
  ];

  it("chains contingency -> markup -> management fee in the correct order, on the correct base each time", () => {
    const result = computeEstimateTotals(items, {
      contingencyPct: "10",
      markupEnabled: true,
      markupPct: "25",
      managementFeeEnabled: true,
      managementFeePct: "15",
    });

    expect(result.subtotal).toBe(450);
    expect(result.contingency).toBeCloseTo(45, 6);
    expect(result.subtotalWithContingency).toBeCloseTo(495, 6);
    expect(result.markup).toBeCloseTo(123.75, 6);
    expect(result.subtotalWithMarkup).toBeCloseTo(618.75, 6);
    expect(result.managementFee).toBeCloseTo(92.8125, 6);
    expect(result.total).toBeCloseTo(711.5625, 6);
  });

  it("skips markup entirely when markupEnabled is false, regardless of markupPct", () => {
    const result = computeEstimateTotals(items, {
      contingencyPct: "0",
      markupEnabled: false,
      markupPct: "25",
      managementFeeEnabled: false,
      managementFeePct: "15",
    });

    expect(result.subtotal).toBe(450);
    expect(result.markup).toBe(0);
    expect(result.managementFee).toBe(0);
    expect(result.total).toBe(450);
  });

  it("computes management fee on top of markup, not on the pre-markup subtotal", () => {
    // subtotal = 450, no contingency, markup 10% -> 45 -> subtotalWithMarkup = 495
    // management fee 10% of 495 (not of 450) = 49.5 -> total = 544.5
    const result = computeEstimateTotals(items, {
      contingencyPct: "0",
      markupEnabled: true,
      markupPct: "10",
      managementFeeEnabled: true,
      managementFeePct: "10",
    });

    expect(result.managementFee).toBeCloseTo(49.5, 6);
    expect(result.total).toBeCloseTo(544.5, 6);
  });

  it("excludes one invalid item's numbers rather than NaN-ing the whole total", () => {
    // Regression for §7d: one bad line item used to poison the entire
    // estimate's total via NaN, silently rendering as $0.00.
    const withOneBadItem: LineItem[] = [
      item({ quantity: "10", unit_type: "sq_ft", unit_cost: "20", material_cost: "5" }),
      item({ quantity: ".", unit_type: "hour", unit_cost: "100", material_cost: "0" }),
    ];

    const result = computeEstimateTotals(withOneBadItem, {
      contingencyPct: "0",
      markupEnabled: false,
      markupPct: "0",
      managementFeeEnabled: false,
      managementFeePct: "0",
    });

    expect(result.subtotal).toBe(250);
    expect(Number.isNaN(result.total)).toBe(false);
    expect(result.total).toBe(250);
  });

  it("treats a garbage contingency/markup/management fee percentage as 0 instead of NaN", () => {
    // Regression: unlike line items, these three top-level fields had zero
    // validation anywhere (no sanitizeNumericInput client-side, no check in
    // save_estimate) - a raw parseFloat() on a bad value reproduced the
    // exact §7d/item 11 NaN-total bug for a different set of fields after
    // that bug was supposedly closed for line items.
    const result = computeEstimateTotals(items, {
      contingencyPct: "abc",
      markupEnabled: true,
      markupPct: ".",
      managementFeeEnabled: true,
      managementFeePct: "-5",
    });

    expect(result.subtotal).toBe(450);
    expect(Number.isNaN(result.contingency)).toBe(false);
    expect(Number.isNaN(result.markup)).toBe(false);
    expect(Number.isNaN(result.managementFee)).toBe(false);
    expect(Number.isNaN(result.total)).toBe(false);
    expect(result.total).toBe(450);
  });
});
