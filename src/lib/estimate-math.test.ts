import { describe, it, expect } from "vitest";
import { calcItemTotal, computeEstimateTotals, type LineItem } from "./estimate-math";

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
});
