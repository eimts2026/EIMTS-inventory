import { Select } from "./Select";
import { useState } from "react";
import type { FormEvent } from "react";
import type { Condition } from "../model";
import { now, officerName, today, uid } from "../model";
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
  const { state, commit } = useInventory();
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
  function save(event: FormEvent) {
    event.preventDefault();
    if (!asset) return setError("Select an asset.");
    if (dialog.kind === "issue" && asset.status !== "Available")
      return setError("Select an available asset.");
    if (dialog.kind === "return" && (!existing || existing.returnedAt))
      return setError("This handover has already been returned.");
    if (
      dialog.kind === "transfer" &&
      asset.status !== "Assigned" &&
      asset.status !== "Available"
    )
      return setError("This asset cannot be transferred in its current state.");
    if (
      dialog.kind === "transfer" &&
      asset.locationId === locationId &&
      asset.personId === personId
    )
      return setError("Choose a different location or custodian.");
    if (dialog.kind === "issue" && !personId)
      return setError("Select the employee receiving this asset.");
    if (dueAt && dueAt < today())
      return setError("Expected return must be today or later.");
    if (!reference.trim()) return setError("Enter the paper form reference.");
    if (received && !filing.trim())
      return setError("Record the filing location for the signed form.");
    const entryId = uid();
    commit(
      {
        issue: "Asset issued",
        return: "Asset returned",
        transfer: "Asset transferred",
      }[dialog.kind],
      `${asset.tag} · ${reference.trim()}`,
      (draft) => {
        const target = draft.assets.find((item) => item.id === assetId)!;
        target.locationId = locationId;
        if (dialog.kind === "return") {
          const handover = draft.handovers.find(
            (item) => item.id === dialog.id,
          )!;
          handover.returnedAt = now();
          handover.returnCondition = condition;
          handover.returnReference = reference.trim();
          handover.returnFiling = filing.trim();
          target.personId = "";
          target.status =
            condition === "Damaged" ? "Needs service" : "Available";
          target.condition = condition;
        } else {
          const active = draft.handovers.find(
            (item) => item.assetId === assetId && !item.returnedAt,
          );
          if (active) active.returnedAt = now();
          target.personId = personId;
          target.status = personId ? "Assigned" : "Available";
          draft.handovers.unshift({
            id: entryId,
            assetId,
            personId,
            issuedAt: now(),
            returnedAt: personId ? "" : now(),
            dueAt,
            accessories,
            condition: target.condition,
            reference: reference.trim(),
            filing: filing.trim(),
            received,
            officer: officerName,
            locationId,
          });
        }
      },
    );
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
