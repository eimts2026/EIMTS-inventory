export type AssetStatus =
  "Assigned" | "Available" | "Needs service" | "In repair" | "Retired";
export type Condition = "Good" | "Fair" | "Damaged";
export type Category =
  "Laptop" | "Desktop" | "Monitor" | "Printer" | "Network" | "Other";
export interface Asset {
  id: string;
  tag: string;
  name: string;
  category: Category;
  serial: string;
  status: AssetStatus;
  locationId: string;
  personId: string;
  condition: Condition;
  purchased: string;
  warranty: string;
  cost: number;
  nextVerification: string;
  lastVerified: string;
}
export interface Person {
  id: string;
  name: string;
  employeeId: string;
  department: string;
  locationId: string;
}
export interface Location {
  id: string;
  name: string;
  branch: string;
}
export interface Handover {
  id: string;
  assetId: string;
  personId: string;
  issuedAt: string;
  returnedAt: string;
  dueAt: string;
  accessories: string;
  condition: Condition;
  reference: string;
  filing: string;
  received: boolean;
  officer: string;
  returnCondition?: Condition;
  locationId?: string;
  returnReference?: string;
  returnFiling?: string;
}
export interface Observation {
  assetId: string;
  expectedLocationId: string;
  expectedPersonId: string;
  observedLocationId: string;
  condition: Condition;
  verifiedAt: string;
  verifier: string;
  note: string;
}
export interface Audit {
  id: string;
  name: string;
  locationId: string;
  dueAt: string;
  createdAt: string;
  closedAt: string;
  observations: Observation[];
}
export interface Issue {
  id: string;
  assetId: string;
  auditId: string;
  title: string;
  type: string;
  owner: string;
  dueAt: string;
  status: "Open" | "Resolved";
  note: string;
  expectedLocationId: string;
  observedLocationId: string;
  resolvedAt: string;
}
export interface Repair {
  id: string;
  assetId: string;
  problem: string;
  vendor: string;
  openedAt: string;
  dueAt: string;
  closedAt: string;
  cost: number;
  reference: string;
  resolution: string;
}
export interface StockMovement {
  id: string;
  date: string;
  quantity: number;
  note: string;
}
export interface Stock {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  minimum: number;
  movements: StockMovement[];
}
export interface Activity {
  id: string;
  date: string;
  action: string;
  subject: string;
  officer: string;
}
export interface Member {
  id: string;
  name: string;
  email: string;
  role: "IT Admin" | "IT Officer";
}
export interface InventoryState {
  version: 1;
  assets: Asset[];
  people: Person[];
  locations: Location[];
  handovers: Handover[];
  audits: Audit[];
  issues: Issue[];
  repairs: Repair[];
  stock: Stock[];
  activity: Activity[];
  members: Member[];
  settings: {
    organisation: string;
    verificationDays: number;
    paperPrefix: string;
  };
}
export const today = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Colombo" });
export const now = () => new Date().toISOString();
export const uid = () => crypto.randomUUID();
export function relativeDay(offset: number) {
  const date = new Date(`${today()}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}
export function dateLabel(value: string) {
  return value
    ? new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Colombo",
      }).format(new Date(value.length === 10 ? `${value}T12:00:00Z` : value))
    : "—";
}
export function currency(value: number) {
  return `LKR ${new Intl.NumberFormat("en-LK").format(value)}`;
}
export function verificationDue(asset: Asset) {
  return asset.status !== "Retired" && asset.nextVerification <= today();
}
export const officerName = "IT Administrator";
