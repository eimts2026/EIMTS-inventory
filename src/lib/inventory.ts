import { z } from "zod";
import { supabase } from "./supabase";
import type { Json } from "../../supabase/database.types";
import type { Asset, InventoryState } from "../model";
import { createEmptyWorkspace } from "../emptyWorkspace";

const text = z.string();
const nullable = text.nullable();
const version = z.number().int();
const condition = z.enum(["Good", "Fair", "Damaged"]);
const member = z.object({
  user_id: text,
  display_name: text,
  role: z.enum(["IT Admin", "IT Officer"]),
  active: z.boolean(),
  version,
});
const asset = z.object({
  id: text,
  tag: text,
  name: text,
  category: z.enum([
    "Laptop",
    "Desktop",
    "Monitor",
    "Printer",
    "Network",
    "Other",
  ]),
  serial: nullable,
  status: z.enum([
    "Available",
    "Assigned",
    "Needs service",
    "In repair",
    "Retired",
  ]),
  location_id: text,
  person_id: nullable,
  condition,
  purchased_on: nullable,
  warranty_until: nullable,
  cost: z.number().nullable(),
  next_verification_on: nullable,
  last_verified_at: nullable,
  version,
});
const observation = z.object({
  audit_id: text,
  asset_id: text,
  observed_location_id: text,
  condition,
  note: text,
  verified_at: text,
  verified_by: text,
});
const item = z.object({
  audit_id: text,
  asset_id: text,
  expected_location_id: text,
  expected_person_id: nullable,
  expected_tag: text,
  expected_serial: nullable,
  expected_condition: condition,
});
const snapshotSchema = z.object({
  repairs: z.array(
    z.object({
      id: text,
      asset_id: text,
      problem: text,
      vendor: text,
      opened_at: text,
      due_on: text,
      closed_at: nullable,
      cost: z.number(),
      paper_reference: text,
      resolution: text,
      version,
    }),
  ),
  members: z.array(member),
  branches: z.array(
    z.object({ id: text, name: text, active: z.boolean(), version }),
  ),
  locations: z.array(
    z.object({
      id: text,
      name: text,
      branch_id: text,
      active: z.boolean(),
      version,
    }),
  ),
  people: z.array(
    z.object({
      id: text,
      name: text,
      employee_id: text,
      department: text,
      location_id: text,
      active: z.boolean(),
      version,
    }),
  ),
  assets: z.array(asset),
  handovers: z.array(
    z.object({
      id: text,
      asset_id: text,
      person_id: text,
      location_id: text,
      issued_at: text,
      issued_by: text,
      closed_at: nullable,
      due_on: nullable,
      issue_condition: condition,
      accessories: text,
      paper_reference: text,
      filing_location: text,
      signed_received: z.boolean(),
      return_condition: condition.nullable(),
      return_reference: nullable,
      return_filing: nullable,
      version,
    }),
  ),
  audits: z.array(
    z.object({
      id: text,
      name: text,
      location_id: text,
      due_on: text,
      created_at: text,
      closed_at: nullable,
      version,
    }),
  ),
  items: z.array(item),
  observations: z.array(observation),
  issues: z.array(
    z.object({
      id: text,
      asset_id: text,
      audit_id: nullable,
      title: text,
      type: text,
      owner_id: text,
      due_on: text,
      status: z.enum(["Open", "Resolved"]),
      note: text,
      expected_location_id: text,
      observed_location_id: nullable,
      resolved_at: nullable,
      resolution: nullable,
      version,
    }),
  ),
  activity: z.array(
    z.object({
      id: text,
      occurred_at: text,
      action: text,
      entity_type: text,
      entity_id: nullable,
      actor_id: text,
    }),
  ),
  settings: z
    .object({
      organisation: text,
      verification_days: version,
      paper_prefix: text,
      version,
    })
    .nullable(),
});

// Convert database names at this boundary so the UI keeps its existing model.
export async function loadInventory(
  email: string,
  userId: string,
): Promise<InventoryState> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase.rpc("inventory_snapshot");
  if (error) throw error;
  const raw = snapshotSchema.parse(data);
  if (!raw.settings)
    throw new Error("Your IT access is unavailable. Sign in again.");
  const name = (id: string) =>
    raw.members.find((m) => m.user_id === id)?.display_name || "IT member";
  const state = createEmptyWorkspace();
  state.members = raw.members.map((m) => ({
    id: m.user_id,
    name: m.display_name,
    email: "",
    role: m.role,
    active: m.active,
    version: m.version,
  }));
  const self = state.members.find((m) => m.id === userId);
  if (self) self.email = email;
  state.locations = raw.locations
    .filter((l) => l.active)
    .map((l) => ({
      id: l.id,
      name: l.name,
      branchId: l.branch_id,
      branch: raw.branches.find((b) => b.id === l.branch_id)?.name || "",
      version: l.version,
    }));
  state.people = raw.people.map((p) => ({
    id: p.id,
    name: p.name,
    employeeId: p.employee_id,
    department: p.department,
    locationId: p.location_id,
    version: p.version,
  }));
  state.assets = raw.assets.map((a) => ({
    id: a.id,
    tag: a.tag,
    name: a.name,
    category: a.category,
    serial: a.serial || "",
    status: a.status,
    locationId: a.location_id,
    personId: a.person_id || "",
    condition: a.condition,
    purchased: a.purchased_on || "",
    warranty: a.warranty_until || "",
    cost: a.cost,
    nextVerification: a.next_verification_on || "",
    lastVerified: a.last_verified_at || "",
    version: a.version,
  }));
  state.handovers = raw.handovers.map((h) => ({
    id: h.id,
    assetId: h.asset_id,
    personId: h.person_id,
    locationId: h.location_id,
    issuedAt: h.issued_at,
    returnedAt: h.closed_at || "",
    dueAt: h.due_on || "",
    accessories: h.accessories,
    condition: h.issue_condition,
    reference: h.paper_reference,
    filing: h.filing_location,
    received: h.signed_received,
    officer: name(h.issued_by),
    returnCondition: h.return_condition || undefined,
    returnReference: h.return_reference || "",
    returnFiling: h.return_filing || "",
    version: h.version,
  }));
  state.audits = raw.audits.map((a) => {
    const expected = raw.items.filter((i) => i.audit_id === a.id);
    const observed = raw.observations.filter((o) => o.audit_id === a.id);
    const ids = [
      ...new Set([
        ...expected.map((i) => i.asset_id),
        ...observed.map((o) => o.asset_id),
      ]),
    ];
    return {
      id: a.id,
      name: a.name,
      locationId: a.location_id,
      dueAt: a.due_on,
      createdAt: a.created_at,
      closedAt: a.closed_at || "",
      version: a.version,
      observations: ids.map((id) => {
        const i = expected.find((i) => i.asset_id === id);
        const o = observed.find((o) => o.asset_id === id);
        return {
          assetId: id,
          expectedLocationId: i?.expected_location_id || a.location_id,
          expectedPersonId: i?.expected_person_id || "",
          expectedTag: i?.expected_tag,
          expectedSerial: i?.expected_serial || "",
          observedLocationId: o?.observed_location_id || "",
          condition: o?.condition || i?.expected_condition || "Good",
          verifiedAt: o?.verified_at || "",
          verifier: o ? name(o.verified_by) : "",
          note: o?.note || "",
        };
      }),
    };
  });
  state.issues = raw.issues.map((d) => ({
    id: d.id,
    assetId: d.asset_id,
    auditId: d.audit_id || "",
    title: d.title,
    type: d.type,
    owner: name(d.owner_id),
    ownerId: d.owner_id,
    dueAt: d.due_on,
    status: d.status,
    note: [d.note, d.resolution].filter(Boolean).join("\n"),
    expectedLocationId: d.expected_location_id,
    observedLocationId: d.observed_location_id || "",
    resolvedAt: d.resolved_at || "",
    version: d.version,
  }));
  state.activity = raw.activity.map((e) => ({
    id: e.id,
    date: e.occurred_at,
    action: `${e.entity_type} ${e.action.toLowerCase()}`,
    subject: e.entity_id || "Workspace",
    officer: name(e.actor_id),
  }));
  state.repairs = raw.repairs.map((r) => ({
    id: r.id,
    assetId: r.asset_id,
    problem: r.problem,
    vendor: r.vendor,
    openedAt: r.opened_at,
    dueAt: r.due_on,
    closedAt: r.closed_at || "",
    cost: r.cost,
    reference: r.paper_reference,
    resolution: r.resolution,
    version: r.version,
  }));
  state.settings = {
    organisation: raw.settings.organisation,
    verificationDays: raw.settings.verification_days,
    paperPrefix: raw.settings.paper_prefix,
    version: raw.settings.version,
  };
  return state;
}

export function readableError(error: unknown) {
  if (error && typeof error === "object" && "code" in error) {
    if (error.code === "40001")
      return "This record changed. Reload it before saving again.";
    if (error.code === "23505")
      return "This record already exists. Reload and check the tag, serial, or reference.";
    if (error.code === "42501")
      return "Your account does not have permission for this operation.";
  }
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  )
    return error.message;
  return "The request could not be completed. Check your connection and try again.";
}

export async function sendCommand(
  requestId: string,
  action: string,
  payload: Json,
) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase.rpc("inventory_command", {
    p_request_id: requestId,
    p_action: action,
    p_data: payload,
  });
  if (error) throw error;
  return data;
}

export function assetPayload(asset: Asset): Json {
  return {
    id: asset.id,
    tag: asset.tag.trim(),
    name: asset.name.trim(),
    category: asset.category,
    serial: asset.serial.trim() || null,
    location_id: asset.locationId,
    condition: asset.condition,
    purchased_on: asset.purchased || null,
    warranty_until: asset.warranty || null,
    cost: asset.cost,
    next_verification_on: asset.nextVerification || null,
    ...(asset.version ? { version: asset.version } : {}),
  };
}
