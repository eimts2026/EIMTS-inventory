import type { Asset, Category, InventoryState } from "./model";
import { now, relativeDay } from "./model";

export function createSeed(): InventoryState {
  const names: [string, Category][] = [
    ["Dell Latitude 5440", "Laptop"],
    ["HP ProBook 450 G10", "Laptop"],
    ["Lenovo ThinkPad E14", "Laptop"],
    ["Dell UltraSharp 24", "Monitor"],
    ["HP LaserJet Pro M404", "Printer"],
    ["Dell OptiPlex 7010", "Desktop"],
    ["Lenovo ThinkPad L14", "Laptop"],
    ["TP-Link Omada switch", "Network"],
    ["HP EliteBook 840", "Laptop"],
    ["Dell P2422H", "Monitor"],
    ["HP ProBook 440 G9", "Laptop"],
    ["Brother HL-L2375DW", "Printer"],
    ["Lenovo ThinkCentre M70", "Desktop"],
    ["Dell Latitude 5430", "Laptop"],
    ["HP E24 G5", "Monitor"],
    ["Ubiquiti UniFi U6", "Network"],
    ["Dell Latitude 3540", "Laptop"],
    ["HP EliteDesk 800", "Desktop"],
    ["Lenovo ThinkPad E16", "Laptop"],
    ["APC Back-UPS 650", "Other"],
    ["Dell P2425H", "Monitor"],
    ["HP ProBook 450 G8", "Laptop"],
    ["Cisco Business 110", "Network"],
    ["Dell OptiPlex 3060", "Desktop"],
  ];
  const people = [
    ["Nimali Perera", "Recruitment"],
    ["Kasun Fernando", "Finance"],
    ["Dilini Silva", "Operations"],
    ["Amal Jayasinghe", "Recruitment"],
    ["Tharushi De Silva", "HR"],
    ["Ruwan Senanayake", "Finance"],
    ["Shanika Wijesinghe", "Operations"],
    ["Dinesh Kumara", "Recruitment"],
  ].map(([name, department], index) => ({
    id: `person-${index + 1}`,
    name,
    department,
    employeeId: `EMP-${String(index + 1).padStart(3, "0")}`,
    locationId: `loc-${(index % 3) + 1}`,
  }));
  const assets: Asset[] = names.map(([name, category], index) => ({
    id: `asset-${index + 1}`,
    tag: `EIMTS-IT-${String(index + 1).padStart(4, "0")}`,
    name,
    category,
    serial: `SN-${["DL", "HP", "LN"][index % 3]}${830410 + index}`,
    locationId: `loc-${(index % 3) + 1}`,
    personId: index < 17 ? people[index % people.length].id : "",
    status:
      index < 17
        ? "Assigned"
        : index < 21
          ? "Available"
          : index < 23
            ? "In repair"
            : "Retired",
    condition: index === 21 || index === 22 ? "Damaged" : "Good",
    purchased: relativeDay(-380 - index * 12),
    warranty: relativeDay(index < 4 ? 15 + index * 8 : 180 + index * 10),
    cost: category === "Laptop" ? 235000 : 68000,
    nextVerification: relativeDay(index < 5 ? -8 + index : 45 + index),
    lastVerified: relativeDay(-85 + index),
  }));
  const auditAssets = assets.filter(
    (asset) => asset.locationId === "loc-1" && asset.status !== "Retired",
  );
  auditAssets.slice(0, 5).forEach((asset) => {
    asset.lastVerified = relativeDay(-1);
    asset.nextVerification = relativeDay(89);
  });
  return {
    version: 1,
    assets,
    people,
    locations: [
      { id: "loc-1", name: "Head office", branch: "Colombo" },
      { id: "loc-2", name: "Branch office", branch: "Kandy" },
      { id: "loc-3", name: "Branch office", branch: "Kurunegala" },
    ],
    handovers: assets
      .filter((asset) => asset.status === "Assigned")
      .map((asset, index) => ({
        id: `handover-${index + 1}`,
        assetId: asset.id,
        personId: asset.personId,
        locationId: asset.locationId,
        issuedAt: relativeDay(-40 - index),
        returnedAt: "",
        dueAt: index === 0 ? relativeDay(-2) : "",
        accessories: "Charger, carry case",
        condition: "Good",
        reference: `HO-2026-${String(index + 1).padStart(3, "0")}`,
        filing: "IT cabinet A / Handovers / 2026",
        received: index > 1,
        officer: "IT Administrator",
      })),
    audits: [
      {
        id: "audit-1",
        name: "Head office · November verification",
        locationId: "loc-1",
        dueAt: relativeDay(7),
        createdAt: relativeDay(-2),
        closedAt: "",
        observations: auditAssets.map((asset, index) => ({
          assetId: asset.id,
          expectedLocationId: asset.locationId,
          expectedPersonId: asset.personId,
          observedLocationId: index < 5 ? asset.locationId : "",
          condition: asset.condition,
          verifiedAt: index < 5 ? relativeDay(-1) : "",
          verifier: index < 5 ? "IT Administrator" : "",
          note: "",
        })),
      },
    ],
    issues: [
      {
        id: "issue-1",
        assetId: "asset-2",
        auditId: "",
        title: "Device reported at a different branch",
        type: "Location mismatch",
        owner: "IT Administrator",
        dueAt: relativeDay(2),
        status: "Open",
        note: "Confirm the transfer with the issuing officer.",
        expectedLocationId: "loc-2",
        observedLocationId: "loc-1",
        resolvedAt: "",
      },
      {
        id: "issue-2",
        assetId: "asset-5",
        auditId: "",
        title: "Serial label needs replacement",
        type: "Label damaged",
        owner: "IT Administrator",
        dueAt: relativeDay(4),
        status: "Open",
        note: "Verify the serial against the device settings.",
        expectedLocationId: "loc-2",
        observedLocationId: "loc-2",
        resolvedAt: "",
      },
      {
        id: "issue-3",
        assetId: "asset-9",
        auditId: "",
        title: "Charger missing on physical check",
        type: "Missing accessory",
        owner: "IT Administrator",
        dueAt: relativeDay(-1),
        status: "Open",
        note: "Follow up with the recorded custodian.",
        expectedLocationId: "loc-3",
        observedLocationId: "loc-3",
        resolvedAt: "",
      },
    ],
    repairs: [
      {
        id: "repair-1",
        assetId: "asset-22",
        problem: "Battery does not hold charge",
        vendor: "Service centre",
        openedAt: relativeDay(-5),
        dueAt: relativeDay(4),
        closedAt: "",
        cost: 0,
        reference: "REP-2026-001",
        resolution: "",
      },
      {
        id: "repair-2",
        assetId: "asset-23",
        problem: "Intermittent power failure",
        vendor: "Internal IT",
        openedAt: relativeDay(-2),
        dueAt: relativeDay(6),
        closedAt: "",
        cost: 0,
        reference: "REP-2026-002",
        resolution: "",
      },
    ],
    stock: [
      {
        id: "stock-1",
        name: "HP 76A black toner",
        unit: "cartridge",
        quantity: 3,
        minimum: 5,
        movements: [],
      },
      {
        id: "stock-2",
        name: "Cat6 patch cable · 2m",
        unit: "cable",
        quantity: 18,
        minimum: 10,
        movements: [],
      },
      {
        id: "stock-3",
        name: "USB-C adapter",
        unit: "adapter",
        quantity: 6,
        minimum: 4,
        movements: [],
      },
      {
        id: "stock-4",
        name: "AA battery pack",
        unit: "pack",
        quantity: 2,
        minimum: 4,
        movements: [],
      },
    ],
    activity: [
      {
        id: "activity-1",
        date: now(),
        action: "Sample workspace created",
        subject: "24 assets across 3 branches",
        officer: "IT Administrator",
      },
      {
        id: "activity-2",
        date: relativeDay(-1),
        action: "Verification recorded",
        subject: "Head office verification · 5 assets",
        officer: "IT Administrator",
      },
      {
        id: "activity-3",
        date: relativeDay(-2),
        action: "Maintenance opened",
        subject: "EIMTS-IT-0023",
        officer: "IT Administrator",
      },
    ],
    members: [
      {
        id: "member-1",
        name: "IT Administrator",
        email: "admin@example.com",
        role: "IT Admin",
      },
      {
        id: "member-2",
        name: "IT Officer",
        email: "officer@example.com",
        role: "IT Officer",
      },
    ],
    settings: {
      organisation: "EIMTS",
      verificationDays: 90,
      paperPrefix: "HO",
    },
  };
}
