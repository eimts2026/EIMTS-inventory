import type { InventoryState } from "./model";

// Start every inventory module empty. Real inventory will be imported after review.
export function createEmptyWorkspace(): InventoryState {
  return {
    version: 1,
    assets: [],
    people: [],
    locations: [],
    handovers: [],
    audits: [],
    issues: [],
    repairs: [],
    stock: [],
    activity: [],
    members: [],
    settings: {
      organisation: "EIMTS",
      verificationDays: 90,
      paperPrefix: "HO",
    },
  };
}
