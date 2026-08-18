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

export function calcItemTotal(item: LineItem): number {
  const qty = parseFloat(item.quantity || "0");
  const labor = parseFloat(item.unit_cost || "0") * qty;
  const material = parseFloat(item.material_cost || "0") * qty;
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
  const contingency = subtotal * (parseFloat(options.contingencyPct || "0") / 100);
  const subtotalWithContingency = subtotal + contingency;
  const markup = options.markupEnabled ? subtotalWithContingency * (parseFloat(options.markupPct || "0") / 100) : 0;
  const subtotalWithMarkup = subtotalWithContingency + markup;
  const managementFee = options.managementFeeEnabled ? subtotalWithMarkup * (parseFloat(options.managementFeePct || "0") / 100) : 0;
  const total = subtotalWithMarkup + managementFee;
  return { subtotal, contingency, subtotalWithContingency, markup, subtotalWithMarkup, managementFee, total };
}
