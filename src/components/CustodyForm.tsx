import { Select } from "./Select";
import { useState } from "react";
import type { FormEvent } from "react";
import type { Condition } from "../model";
import { assetPayload } from "../lib/inventory";
import { today } from "../model";
import { useInventory } from "../store";
import { ErrorMessage, Field, FormActions, Modal } from "./ui";
import type { AssetDialog } from "./AssetDialogs";

export function CustodyForm({
  dialog,
  onClose,
}: {
  dialog: Extract<AssetDialog, { kind: "issue" | "return" | "transfer" }>;
  onClose: () => void;
}) {
  const { state, command } = useInventory();
  const existing = state.handovers.find((item) => item.id === dialog.id);
  const [assetId, setAssetId] = useState(
    dialog.kind === "return" ? existing?.assetId || "" : dialog.id || "",
  );
  const asset = state.assets.find((item) => item.id === assetId);
  const [personId, setPersonId] = useState(
    dialog.kind === "transfer"
      ? asset?.personId || ""
      : existing?.personId || "",
  );
  const [locationId, setLocationId] = useState(
    asset?.locationId || state.locations[0]?.id || "",
  );
  const [condition, setCondition] = useState<Condition>("Good");
  const [accessories, setAccessories] = useState(
    existing?.accessories || "Charger, carry case",
  );
  const [dueAt, setDueAt] = useState("");
  const [reference, setReference] = useState(
    `${state.settings.paperPrefix}-${today().replaceAll("-", "")}-${String(state.handovers.length + 1).padStart(3, "0")}`,
  );
  const [filing, setFiling] = useState(existing?.filing || "");
  const [received, setReceived] = useState(false);
  const [error, setError] = useState("");
  const title = {
    issue: "Issue an asset",
    return: "Record an asset return",
    transfer: "Transfer an asset",
  }[dialog.kind];
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!asset) return setError("Select an asset.");
    const active = state.handovers.find(
      (item) => item.assetId === asset.id && !item.returnedAt,
    );
    if (
      dialog.kind === "transfer" &&
      !personId &&
      asset.status === "Available"
    ) {
      if (
        await command(
          "save_asset",
          assetPayload({ ...asset, locationId }),
          "Asset location updated",
        )
      )
        onClose();
      return;
    }
    const kind =
      dialog.kind === "transfer"
        ? !personId
          ? "return"
          : asset.status === "Available"
            ? "issue"
            : "transfer"
        : dialog.kind;
    if (kind !== "return" && !personId)
      return setError("Select the receiving employee.");
    if (received && !filing.trim())
      return setError("Record the signed form filing location.");
    const payload = {
      asset_id: asset.id,
      asset_version: asset.version || 1,
      person_id: personId,
      location_id: locationId,
      condition: kind === "return" ? condition : asset.condition,
      paper_reference: reference.trim(),
      return_reference: reference.trim(),
      return_filing: filing.trim(),
      handover_id:
        (dialog.kind === "return" ? existing?.id : active?.id) || null,
      due_on: dueAt || null,
      accessories,
      filing_location: filing.trim(),
      signed_received: received,
    };
    if (await command(kind + "_asset", payload, "Custody record saved"))
      onClose();
  }
  return (
    <Modal
      title={title}
      description="IT records the transaction and the reference to the paper form."
      onClose={onClose}
    >
      <form onSubmit={save}>
        <div className="form-grid">
          <Field label="Asset" full>
            <Select
              required
              disabled={dialog.kind !== "issue" || Boolean(dialog.id)}
              value={assetId}
              onValueChange={(event) => {
                setAssetId(event);
                setLocationId(
                  state.assets.find((item) => item.id === event)?.locationId ||
                    locationId,
                );
              }}
            >
              <option value="">Select an available device</option>
              {state.assets
                .filter(
                  (item) => item.status === "Available" || item.id === assetId,
                )
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.tag} / {item.name}
                  </option>
                ))}
            </Select>
          </Field>
          {dialog.kind !== "return" && (
            <Field label="Employee receiving the asset" full>
              <Select
                required={dialog.kind === "issue"}
                value={personId}
                onValueChange={(event) => setPersonId(event)}
              >
                <option value="">IT stock / no custodian</option>
                {state.people.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name} / {person.employeeId}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field
            label={
              dialog.kind === "return"
                ? "Return location"
                : "Destination location"
            }
            full
          >
            <Select
              required
              value={locationId}
              onValueChange={(event) => setLocationId(event)}
            >
              {state.locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.branch} / {location.name}
                </option>
              ))}
            </Select>
          </Field>
          {dialog.kind === "return" ? (
            <Field label="Condition on return">
              <Select
                value={condition}
                onValueChange={(event) => setCondition(event as Condition)}
              >
                {["Good", "Fair", "Damaged"].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </Select>
            </Field>
          ) : (
            <>
              <Field label="Accessories" full>
                <input
                  maxLength={200}
                  value={accessories}
                  onChange={(event) => setAccessories(event.target.value)}
                />
              </Field>
              <Field label="Expected return (optional)">
                <input
                  type="date"
                  min={today()}
                  value={dueAt}
                  onChange={(event) => setDueAt(event.target.value)}
                />
              </Field>
            </>
          )}
          <Field label="Paper form reference">
            <input
              required
              maxLength={80}
              value={reference}
              onChange={(event) => setReference(event.target.value)}
            />
          </Field>
          {dialog.kind !== "return" && (
            <>
              <Field label="Physical filing location" full>
                <input
                  maxLength={150}
                  value={filing}
                  onChange={(event) => setFiling(event.target.value)}
                  placeholder="Cabinet A / Handovers / 2026"
                />
              </Field>
              <label className="checkbox-field full">
                <input
                  type="checkbox"
                  checked={received}
                  onChange={(event) => setReceived(event.target.checked)}
                />
                Signed paper form received and filed
              </label>
            </>
          )}
        </div>
        <ErrorMessage error={error} />
        <FormActions
          onClose={onClose}
          label={
            dialog.kind === "return"
              ? "Record return"
              : dialog.kind === "transfer"
                ? "Record transfer"
                : "Issue asset"
          }
        />
      </form>
    </Modal>
  );
}
