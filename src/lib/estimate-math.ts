export interface LineItem {
  id?: number;
  category_id: string;
  custom_category: string;
  room: string;
  quantity: string;
  unit_type: string;
  unit_cost: string;
  material_cost: string;
  notes: string;
  assembly_id: string | null;
  material_from_assembly: boolean;
  ai_suggested: boolean;
}

const VALID_NUMBER_PATTERN = /^$|^\d+(\.\d+)?$/;

export function isValidLineItemNumber(value: string): boolean {
  return VALID_NUMBER_PATTERN.test(value);
}

export function lineItemHasInvalidNumbers(item: LineItem): boolean {
  return (
    !isValidLineItemNumber(item.quantity) ||
    !isValidLineItemNumber(item.unit_cost) ||
    !isValidLineItemNumber(item.material_cost)
  );
}

function safeNumber(value: string): number {
  return isValidLineItemNumber(value) && value !== "" ? parseFloat(value) : 0;
}

export function calcItemTotal(item: LineItem): number {
  const qty = safeNumber(item.quantity);
  const labor = safeNumber(item.unit_cost) * qty;
  const material = safeNumber(item.material_cost) * qty;
  return labor + material;
}

export interface EstimateTotalsOptions {
  contingencyPct: string;
  markupEnabled: boolean;
  markupPct: string;
  managementFeeEnabled: boolean;
  managementFeePct: string;
}

export interface EstimateTotals {
  subtotal: number;
  contingency: number;
  subtotalWithContingency: number;
  markup: number;
  subtotalWithMarkup: number;
  managementFee: number;
  total: number;
}

export function computeEstimateTotals(items: LineItem[], options: EstimateTotalsOptions): EstimateTotals {
  const subtotal = items.reduce((s, item) => s + calcItemTotal(item), 0);
  const contingency = subtotal * (safeNumber(options.contingencyPct) / 100);
  const subtotalWithContingency = subtotal + contingency;
  const markup = options.markupEnabled ? subtotalWithContingency * (safeNumber(options.markupPct) / 100) : 0;
  const subtotalWithMarkup = subtotalWithContingency + markup;
  const managementFee = options.managementFeeEnabled ? subtotalWithMarkup * (safeNumber(options.managementFeePct) / 100) : 0;
  const total = subtotalWithMarkup + managementFee;
  return { subtotal, contingency, subtotalWithContingency, markup, subtotalWithMarkup, managementFee, total };
}
