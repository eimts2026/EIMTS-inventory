import { z } from "zod";

const text = z.string().max(4000);
const id = z.string().min(1).max(100);
const condition = z.enum(["Good", "Fair", "Damaged"]);
const date = z.union([z.literal(""), z.iso.date(), z.iso.datetime()]);
const amount = z.number().finite().nonnegative();
const asset = z.object({
  id,
  tag: id,
  name: id,
  category: z.enum([
    "Laptop",
    "Desktop",
    "Monitor",
    "Printer",
    "Network",
    "Other",
  ]),
  serial: id,
  status: z.enum([
    "Assigned",
    "Available",
    "Needs service",
    "In repair",
    "Retired",
  ]),
  locationId: id,
  personId: text,
  condition,
  purchased: date,
  warranty: date,
  cost: amount,
  nextVerification: date,
  lastVerified: date,
});
export const inventorySchema = z
  .object({
    version: z.literal(1),
    assets: z.array(asset).max(10000),
    people: z
      .array(
        z.object({
          id,
          name: id,
          employeeId: id,
          department: id,
          locationId: id,
        }),
      )
      .max(10000),
    locations: z.array(z.object({ id, name: id, branch: id })).max(1000),
    handovers: z
      .array(
        z.object({
          id,
          assetId: id,
          personId: text,
          issuedAt: date,
          returnedAt: date,
          dueAt: date,
          accessories: text,
          condition,
          reference: id,
          filing: text,
          received: z.boolean(),
          officer: id,
          returnCondition: condition.optional(),
          locationId: id.optional(),
          returnReference: text.optional(),
          returnFiling: text.optional(),
        }),
      )
      .max(50000),
    audits: z
      .array(
        z.object({
          id,
          name: id,
          locationId: id,
          dueAt: date,
          createdAt: date,
          closedAt: date,
          observations: z
            .array(
              z.object({
                assetId: id,
                expectedLocationId: id,
                expectedPersonId: text,
                observedLocationId: text,
                condition,
                verifiedAt: date,
                verifier: text,
                note: text,
              }),
            )
            .max(10000),
        }),
      )
      .max(1000),
    issues: z
      .array(
        z.object({
          id,
          assetId: id,
          auditId: text,
          title: id,
          type: id,
          owner: id,
          dueAt: date,
          status: z.enum(["Open", "Resolved"]),
          note: text,
          expectedLocationId: id,
          observedLocationId: text,
          resolvedAt: date,
        }),
      )
      .max(50000),
    repairs: z
      .array(
        z.object({
          id,
          assetId: id,
          problem: id,
          vendor: id,
          openedAt: date,
          dueAt: date,
          closedAt: date,
          cost: amount,
          reference: text,
          resolution: text,
        }),
      )
      .max(10000),
    stock: z
      .array(
        z.object({
          id,
          name: id,
          unit: id,
          quantity: amount.int(),
          minimum: amount.int(),
          movements: z
            .array(
              z.object({
                id,
                date,
                quantity: z.number().finite().int(),
                note: id,
              }),
            )
            .max(10000),
        }),
      )
      .max(10000),
    activity: z
      .array(z.object({ id, date, action: id, subject: text, officer: id }))
      .max(50000),
    members: z
      .array(
        z.object({
          id,
          name: id,
          email: z.email(),
          role: z.enum(["IT Admin", "IT Officer"]),
        }),
      )
      .max(100),
    settings: z.object({
      organisation: id,
      verificationDays: z.number().int().min(1).max(365),
      paperPrefix: id,
    }),
  })
  .superRefine((state, context) => {
    function requireValid(valid: boolean, message: string) {
      if (!valid) context.addIssue({ code: "custom", message });
    }
    function unique(values: string[]) {
      return (
        new Set(values.map((value) => value.toLowerCase())).size ===
        values.length
      );
    }
    for (const list of [
      state.assets,
      state.people,
      state.locations,
      state.handovers,
      state.audits,
      state.issues,
      state.repairs,
      state.stock,
      state.members,
      state.activity,
    ])
      requireValid(
        unique(list.map((item) => item.id)),
        "Duplicate record IDs.",
      );
    requireValid(
      unique(state.assets.map((item) => item.tag)) &&
        unique(state.assets.map((item) => item.serial)),
      "Duplicate asset tags or serial numbers.",
    );
    requireValid(
      unique(state.people.map((item) => item.employeeId)),
      "Duplicate employee IDs.",
    );
    const assets = new Set(state.assets.map((item) => item.id));
    const people = new Set(state.people.map((item) => item.id));
    const locations = new Set(state.locations.map((item) => item.id));
    requireValid(
      state.assets.every(
        (item) =>
          locations.has(item.locationId) &&
          (!item.personId || people.has(item.personId)),
      ),
      "Invalid asset custodian or location.",
    );
    requireValid(
      state.people.every((item) => locations.has(item.locationId)),
      "Invalid employee location.",
    );
    requireValid(
      state.handovers.every(
        (item) =>
          assets.has(item.assetId) &&
          (!item.personId || people.has(item.personId)) &&
          (!item.locationId || locations.has(item.locationId)),
      ),
      "Invalid handover references.",
    );
    requireValid(
      state.issues.every(
        (item) =>
          assets.has(item.assetId) &&
          locations.has(item.expectedLocationId) &&
          (!item.observedLocationId || locations.has(item.observedLocationId)),
      ),
      "Invalid discrepancy references.",
    );
    requireValid(
      state.repairs.every((item) => assets.has(item.assetId)),
      "Invalid maintenance asset.",
    );
    requireValid(
      state.audits.every(
        (item) =>
          locations.has(item.locationId) &&
          unique(item.observations.map((row) => row.assetId)) &&
          item.observations.every(
            (row) =>
              assets.has(row.assetId) &&
              locations.has(row.expectedLocationId) &&
              (!row.observedLocationId ||
                locations.has(row.observedLocationId)) &&
              (!row.expectedPersonId || people.has(row.expectedPersonId)),
          ),
      ),
      "Invalid audit references.",
    );
    const active = state.handovers.filter((item) => !item.returnedAt);
    requireValid(
      unique(active.map((item) => item.assetId)),
      "Multiple open handovers for one asset.",
    );
    requireValid(
      state.assets.every((item) =>
        item.status === "Assigned"
          ? active.some(
              (handover) =>
                handover.assetId === item.id &&
                handover.personId === item.personId,
            ) && Boolean(item.personId)
          : !item.personId &&
            !active.some((handover) => handover.assetId === item.id),
      ),
      "Assignments and handovers are inconsistent.",
    );
  });
