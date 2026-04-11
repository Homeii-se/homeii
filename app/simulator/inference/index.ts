/**
 * Inference layer — profile inference and bill parsing.
 * Master re-export for the inference/ directory.
 */

export * from "./profile";
export { parsedInvoiceToBillData, mergeBillData } from "./bill-parser";