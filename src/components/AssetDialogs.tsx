import { assetPayload } from "../lib/inventory";
import { Select } from "./Select";
import { CustodyForm } from "./CustodyForm";
import { PaperPreview } from "./PaperPreview";
import { useState } from "react";
import type { FormEvent } from "react";
import {
  ArrowLeftRight,
  ArrowUpRight,
  ClipboardCheck,
  FileText,
  Pencil,
  Printer,
  QrCode,
  UserRound,
} from "lucide-react";
import Papa from "papaparse";
import type { Asset, Category, Condition } from "../model";
import { currency, dateLabel, relativeDay, today, uid } from "../model";
import { useInventory } from "../store";
import {
  Badge,
  ErrorMessage,
  Field,
  FormActions,
  IconForAsset,
  Modal,
} from "./ui";
import { exportCsv } from "../lib/files";

export type AssetDialog =
  | { kind: "asset"; id?: string }
  | { kind: "details"; id: string }
  | { kind: "issue"; id?: string }
  | { kind: "return"; id: string }
  | { kind: "transfer"; id: string }
  | { kind: "import" }
  | {
      kind: "paper";
      document: "asset" | "handover" | "labels";
      ids: string[];
      handoverId?: string;
    };
export const categories: Category[] = [
  "Laptop",
  "Desktop",
  "Monitor",
  "Printer",
  "Network",
  "Other",
];

export function AssetDialogs({
  dialog,
  onClose,
  onOpen,
}: {
  dialog: AssetDialog;
  onClose: () => void;
  onOpen: (dialog: AssetDialog) => void;
}) {
  if (dialog.kind === "asset")
    return <AssetForm id={dialog.id} onClose={onClose} />;
  if (dialog.kind === "details")
    return <AssetDetail id={dialog.id} onClose={onClose} onOpen={onOpen} />;
  if (
    dialog.kind === "issue" ||
    dialog.kind === "return" ||
    dialog.kind === "transfer"
  )
    return <CustodyForm dialog={dialog} onClose={onClose} />;
  if (dialog.kind === "import") return <ImportAssets onClose={onClose} />;
  return <PaperPreview dialog={dialog} onClose={onClose} />;
}

function AssetForm({ id, onClose }: { id?: string; onClose: () => void }) {
  const { state, command } = useInventory();
  const existing = state.assets.find((asset) => asset.id === id);
  const nextNumber =
    Math.max(
      0,
      ...state.assets.map(
        (asset) => Number(asset.tag.replace("EIMTS-IT-", "")) || 0,
      ),
    ) + 1;
  const [asset, setAsset] = useState<Asset>(
    existing || {
      id: uid(),
      tag: `EIMTS-IT-${String(nextNumber).padStart(4, "0")}`,
      name: "",
      category: "Laptop",
      serial: "",
      status: "Available",
      locationId: state.locations[0]?.id || "",
      personId: "",
      condition: "Good",
      purchased: "",
      warranty: "",
      cost: null,
      nextVerification: relativeDay(state.settings.verificationDays),
      lastVerified: "",
    },
  );
  const [error, setError] = useState("");
  const update = <K extends keyof Asset>(key: K, value: Asset[K]) =>
    setAsset((previous) => ({ ...previous, [key]: value }));
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!asset.name.trim() || !asset.tag.trim())
      return setError("Enter an asset name and tag.");
    if (
      await command(
        "save_asset",
        assetPayload(asset),
        existing ? "Asset updated" : "Asset registered",
      )
    )
      onClose();
  }
  return (
    <Modal
      title={existing ? "Edit asset" : "Register an asset"}
      description="Give each physical device a permanent identity."
      onClose={onClose}
      wide
    >
      <form onSubmit={save}>
        <div className="form-grid">
          <Field label="Asset name" full>
            <input
              required
              maxLength={120}
              value={asset.name}
              onChange={(event) => update("name", event.target.value)}
              placeholder="e.g. Dell Latitude 5440"
            />
          </Field>
          <Field label="Asset tag">
            <input
              required
              maxLength={40}
              value={asset.tag}
              onChange={(event) => update("tag", event.target.value)}
            />
          </Field>
          <Field label="Serial number">
            <input
              maxLength={80}
              value={asset.serial}
              onChange={(event) => update("serial", event.target.value)}
              placeholder="Manufacturer serial"
            />
          </Field>
          <Field label="Category">
            <Select
              value={asset.category}
              onValueChange={(event) => update("category", event as Category)}
            >
              {categories.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </Select>
          </Field>
          <Field label="Location">
            <Select
              required
              value={asset.locationId}
              onValueChange={(event) => update("locationId", event)}
            >
              {state.locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.branch} / {location.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Condition">
            <Select
              value={asset.condition}
              onValueChange={(event) => update("condition", event as Condition)}
            >
              {["Good", "Fair", "Damaged"].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </Select>
          </Field>
          <Field label="Next verification">
            <input
              type="date"
              required
              value={asset.nextVerification}
              onChange={(event) =>
                update("nextVerification", event.target.value)
              }
            />
          </Field>
          <Field label="Purchase date">
            <input
              type="date"
              value={asset.purchased}
              onChange={(event) => update("purchased", event.target.value)}
            />
          </Field>
          <Field label="Warranty expiry">
            <input
              type="date"
              value={asset.warranty}
              onChange={(event) => update("warranty", event.target.value)}
            />
          </Field>
          <Field label="Purchase cost (LKR)">
            <input
              type="number"
              min="0"
              step="0.01"
              value={asset.cost ?? ""}
              onChange={(event) =>
                update(
                  "cost",
                  event.target.value ? Number(event.target.value) : null,
                )
              }
            />
          </Field>
          <p className="field-note full">
            Assignment and lifecycle changes are recorded through custody,
            maintenance, and retirement actions.
          </p>
        </div>
        <ErrorMessage error={error} />
        <FormActions
          onClose={onClose}
          label={existing ? "Save asset" : "Register asset"}
        />
      </form>
    </Modal>
  );
}

function AssetDetail({
  id,
  onClose,
  onOpen,
}: {
  id: string;
  onClose: () => void;
  onOpen: (dialog: AssetDialog) => void;
}) {
  const { state, command } = useInventory();
  const asset = state.assets.find((item) => item.id === id)!;
  const person = state.people.find((item) => item.id === asset.personId);
  const location = state.locations.find((item) => item.id === asset.locationId);
  const handover = state.handovers.find(
    (item) => item.assetId === id && !item.returnedAt,
  );
  const [tab, setTab] = useState("Details");
  const [retiring, setRetiring] = useState(false);
  const [reason, setReason] = useState("");
  return (
    <Modal title={asset.name} description={asset.tag} onClose={onClose} wide>
      <div className="asset-detail-hero">
        <span className="device-icon large">
          <IconForAsset category={asset.category} size={35} />
        </span>
        <div>
          <Badge>{asset.status}</Badge>
          <p>
            {asset.category} <span className="muted">/ {asset.serial}</span>
          </p>
        </div>
        <button
          className="button secondary"
          onClick={() => onOpen({ kind: "asset", id })}
        >
          <Pencil size={15} />
          Edit
        </button>
      </div>
      <div className="tabs">
        {["Details", "Custody history", "Activity"].map((value) => (
          <button
            key={value}
            className={value === tab ? "active" : ""}
            onClick={() => setTab(value)}
          >
            {value}
          </button>
        ))}
      </div>
      {tab === "Details" && (
        <>
          <dl className="detail-grid">
            {[
              ["Custodian", person?.name || "IT stock"],
              ["Location", `${location?.branch} / ${location?.name}`],
              ["Condition", asset.condition],
              ["Purchased", dateLabel(asset.purchased)],
              ["Purchase cost", currency(asset.cost)],
              ["Warranty expires", dateLabel(asset.warranty)],
              ["Last verified", dateLabel(asset.lastVerified)],
              ["Next verification", dateLabel(asset.nextVerification)],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <div className="detail-actions">
            {asset.status === "Available" && (
              <button
                className="button primary"
                onClick={() => onOpen({ kind: "issue", id })}
              >
                <UserRound size={16} />
                Issue asset
              </button>
            )}
            {handover && (
              <button
                className="button primary"
                onClick={() => onOpen({ kind: "return", id: handover.id })}
              >
                <ArrowUpRight size={16} />
                Record return
              </button>
            )}
            {(asset.status === "Assigned" || asset.status === "Available") && (
              <button
                className="button secondary"
                onClick={() => onOpen({ kind: "transfer", id })}
              >
                <ArrowLeftRight size={16} />
                Transfer
              </button>
            )}
            <button
              className="button secondary"
              onClick={() =>
                onOpen({ kind: "paper", document: "asset", ids: [id] })
              }
            >
              <Printer size={16} />
              Print record
            </button>
            <button
              className="button secondary"
              onClick={() =>
                onOpen({ kind: "paper", document: "labels", ids: [id] })
              }
            >
              <QrCode size={16} />
              QR label
            </button>
          </div>
          {(asset.status === "Available" ||
            asset.status === "Needs service") && (
            <div className="retire-section">
              {retiring ? (
                <form
                  onSubmit={async (event) => {
                    event.preventDefault();
                    if (!reason.trim()) return;
                    if (
                      await command(
                        "retire_asset",
                        {
                          asset_id: asset.id,
                          asset_version: asset.version || 1,
                          note: reason.trim(),
                        },
                        "Asset retired",
                      )
                    )
                      onClose();
                  }}
                >
                  <Field label="Retirement reason">
                    <input
                      required
                      maxLength={200}
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                    />
                  </Field>
                  <button className="button danger">Confirm retirement</button>
                </form>
              ) : (
                <button
                  className="subtle-button"
                  onClick={() => setRetiring(true)}
                >
                  Retire this asset
                </button>
              )}
            </div>
          )}
        </>
      )}
      {tab === "Custody history" && (
        <div className="timeline">
          {state.handovers
            .filter((item) => item.assetId === id)
            .map((item) => (
              <div key={item.id}>
                <span className="timeline-dot" />
                <strong>
                  {state.people.find((person) => person.id === item.personId)
                    ?.name || "IT stock transfer"}
                </strong>
                <p>
                  {dateLabel(item.issuedAt)} —{" "}
                  {item.returnedAt
                    ? dateLabel(item.returnedAt)
                    : "Currently assigned"}
                </p>
                <p>
                  {item.reference} / {item.filing || "Filing location pending"}
                </p>
                <Badge>{item.received ? "Recorded" : "Pending"}</Badge>
                <button
                  className="text-link"
                  onClick={() =>
                    onOpen({
                      kind: "paper",
                      document: "handover",
                      ids: [id],
                      handoverId: item.id,
                    })
                  }
                >
                  <FileText size={15} />
                  Print handover
                </button>
              </div>
            ))}
          {!state.handovers.some((item) => item.assetId === id) && (
            <p className="muted">This asset has no handovers yet.</p>
          )}
        </div>
      )}
      {tab === "Activity" && (
        <div className="timeline">
          {state.activity
            .filter((item) => item.subject.includes(asset.tag))
            .map((item) => (
              <div key={item.id}>
                <span className="timeline-dot" />
                <strong>{item.action}</strong>
                <p>{item.subject}</p>
                <small>
                  {dateLabel(item.date)} / {item.officer}
                </small>
              </div>
            ))}
          <div>
            <span className="timeline-dot" />
            <strong>Asset registered</strong>
            <p>Purchase recorded {dateLabel(asset.purchased)}</p>
          </div>
        </div>
      )}
    </Modal>
  );
}

function ImportAssets({ onClose }: { onClose: () => void }) {
  const { state, command } = useInventory();
  const [rows, setRows] = useState<Asset[]>([]);
  const [error, setError] = useState("");
  async function read(file?: File) {
    setRows([]);
    setError("");
    if (!file) return;
    if (file.size > 1024 * 1024)
      return setError("Choose a CSV file smaller than 1 MB.");
    const parsed = Papa.parse<Record<string, string>>(await file.text(), {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (header) => header.trim().toLowerCase(),
    });
    if (parsed.errors.length)
      return setError(
        "The CSV could not be read. Check quotes and column counts.",
      );
    if (!parsed.data.length || parsed.data.length > 1000)
      return setError("Import between 1 and 1,000 assets at a time.");
    const tags = new Set(state.assets.map((asset) => asset.tag.toLowerCase()));
    const serials = new Set(
      state.assets.map((asset) => asset.serial.toLowerCase()),
    );
    const imported: Asset[] = [];
    for (const [index, row] of parsed.data.entries()) {
      const tag = row.tag?.trim().toUpperCase();
      const serial = row.serial?.trim();
      const category = categories.find(
        (value) => value.toLowerCase() === row.category?.trim().toLowerCase(),
      );
      const location = state.locations.find(
        (value) =>
          value.branch.toLowerCase() === row.branch?.trim().toLowerCase() &&
          value.name.toLowerCase() === row.location?.trim().toLowerCase(),
      );
      if (!tag || !serial || !row.name?.trim() || !category || !location)
        return setError(
          `Row ${index + 2} needs a tag, name, serial, valid category, and an existing branch/location pair.`,
        );
      if (tags.has(tag.toLowerCase()) || serials.has(serial.toLowerCase()))
        return setError(
          `Row ${index + 2} repeats an asset tag or serial number.`,
        );
      tags.add(tag.toLowerCase());
      serials.add(serial.toLowerCase());
      imported.push({
        id: uid(),
        tag,
        serial,
        name: row.name.trim(),
        category,
        locationId: location.id,
        personId: "",
        status: "Available",
        condition: "Good",
        purchased: today(),
        warranty: "",
        cost: 0,
        nextVerification: relativeDay(state.settings.verificationDays),
        lastVerified: "",
      });
    }
    setRows(imported);
  }
  return (
    <Modal
      title="Import assets"
      description="Validate the full CSV before adding any records."
      onClose={onClose}
    >
      <div className="modal-body">
        <div className="info-note">
          Required columns are tag, name, serial, category, branch, and
          location. Imported assets enter IT stock with today’s registration
          date.
        </div>
        <button
          className="button secondary"
          onClick={() =>
            exportCsv("asset-import-template.csv", [
              {
                tag: "EIMTS-IT-0025",
                name: "Dell Latitude 5450",
                serial: "DEMO-NEW-001",
                category: "Laptop",
                branch: state.locations[0]?.branch || "",
                location: state.locations[0]?.name || "",
              },
            ])
          }
        >
          Download CSV template
        </button>
        <Field label="Choose a CSV file">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => void read(event.target.files?.[0])}
          />
        </Field>
        <ErrorMessage error={error} />
        {rows.length > 0 && (
          <div className="success-note">
            <ClipboardCheck size={20} />
            <strong>{rows.length} assets ready to import</strong>
            <p>All tags and serial numbers are unique.</p>
          </div>
        )}
      </div>
      <div className="form-actions">
        <button className="button secondary" onClick={onClose}>
          Cancel
        </button>
        <button
          className="button primary"
          disabled={!rows.length || Boolean(error)}
          onClick={async () => {
            if (
              await command(
                "import_assets",
                { assets: rows.map(assetPayload) },
                "Assets imported",
              )
            )
              onClose();
          }}
        >
          Import {rows.length || ""} assets
        </button>
      </div>
    </Modal>
  );
}
