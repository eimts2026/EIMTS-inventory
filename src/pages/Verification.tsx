import { Select } from "../components/Select";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  ArrowLeft,
  Camera,
  Check,
  CheckCheck,
  ClipboardCheck,
  Plus,
  ScanLine,
  X,
} from "lucide-react";
import type { IScannerControls } from "@zxing/browser";
import type { Asset, Condition, Observation } from "../model";
import {
  dateLabel,
  now,
  officerName,
  relativeDay,
  today,
  uid,
  verificationDue,
} from "../model";
import { useInventory } from "../store";
import {
  Badge,
  Empty,
  ErrorMessage,
  Field,
  FormActions,
  IconForAsset,
  Modal,
  PageHeading,
  Panel,
} from "../components/ui";
import type { AssetDialog } from "../components/AssetDialogs";

function CameraScanner({
  onRead,
  onClose,
}: {
  onRead: (tag: string) => void;
  onClose: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    let controls: IScannerControls | undefined;
    async function start() {
      try {
        const { BrowserQRCodeReader } = await import("@zxing/browser");
        if (cancelled || !video.current) return;
        const reader = new BrowserQRCodeReader();
        controls = await reader.decodeFromVideoDevice(
          undefined,
          video.current,
          (result, _error, current) => {
            if (result && !cancelled) {
              cancelled = true;
              current.stop();
              onRead(result.getText());
            }
          },
        );
        if (cancelled) controls.stop();
      } catch {
        if (!cancelled)
          setError(
            "Camera could not start. Allow camera access or enter the printed asset tag below.",
          );
      }
    }
    void start();
    return () => {
      cancelled = true;
      controls?.stop();
    };
  }, [onRead]);
  return (
    <div className="camera-panel">
      <div>
        <strong>Point the camera at an asset label</strong>
        <button
          className="icon-button"
          aria-label="Stop camera"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>
      <video ref={video} autoPlay playsInline muted />
      <ErrorMessage error={error} />
    </div>
  );
}

export function Verification({
  onOpen,
}: {
  onOpen: (dialog: AssetDialog) => void;
}) {
  const { state, commit, notify } = useInventory();
  const [selected, setSelected] = useState(
    state.audits.find((audit) => !audit.closedAt)?.id || "",
  );
  const [creating, setCreating] = useState(false);
  const [closing, setClosing] = useState(false);
  const [name, setName] = useState("");
  const [locationId, setLocationId] = useState(state.locations[0]?.id || "");
  const [dueAt, setDueAt] = useState(relativeDay(7));
  const [tag, setTag] = useState("");
  const [camera, setCamera] = useState(false);
  const [found, setFound] = useState<Asset | null>(null);
  const [serial, setSerial] = useState("");
  const [observedLocation, setObservedLocation] = useState(locationId);
  const [condition, setCondition] = useState<Condition>("Good");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const audit = state.audits.find((item) => item.id === selected);
  const verified =
    audit?.observations.filter((item) => item.verifiedAt).length || 0;
  const outstanding =
    audit?.observations.filter((item) => !item.verifiedAt) || [];
  function create(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return setError("Enter a verification name.");
    const expected = state.assets.filter(
      (asset) => asset.locationId === locationId && asset.status !== "Retired",
    );
    if (!expected.length)
      return setError("This location has no active assets to verify.");
    const id = uid();
    commit("Verification started", name.trim(), (draft) => {
      draft.audits.unshift({
        id,
        name: name.trim(),
        locationId,
        dueAt,
        createdAt: now(),
        closedAt: "",
        observations: expected.map((asset) => ({
          assetId: asset.id,
          expectedLocationId: asset.locationId,
          expectedPersonId: asset.personId,
          observedLocationId: "",
          condition: asset.condition,
          verifiedAt: "",
          verifier: "",
          note: "",
        })),
      });
    });
    setSelected(id);
    setCreating(false);
    setName("");
  }
  function lookup(value = tag) {
    setError("");
    const asset = state.assets.find(
      (item) => item.tag.toLowerCase() === value.trim().toLowerCase(),
    );
    if (!asset)
      return setError(
        "Asset tag not found. Check the label or search the asset register.",
      );
    if (asset.status === "Retired")
      return setError(
        "This asset is retired. Review its record before including it in an audit.",
      );
    if (
      audit?.observations.find((item) => item.assetId === asset.id)?.verifiedAt
    )
      return setError("This asset has already been verified in this audit.");
    setFound(asset);
    setSerial("");
    setCondition(asset.condition);
    setObservedLocation(audit?.locationId || asset.locationId);
    setNote("");
  }
  function verify(event: FormEvent) {
    event.preventDefault();
    if (!found || !audit || audit.closedAt) return;
    if (serial.trim().toLowerCase() !== found.serial.toLowerCase())
      return setError(
        "The serial does not match the register. Check the physical device and raise a discrepancy if necessary.",
      );
    const snapshot = audit.observations.find(
      (item) => item.assetId === found.id,
    );
    const expected = snapshot?.expectedLocationId || found.locationId;
    const mismatch = expected !== observedLocation || !snapshot;
    const needsIssue = mismatch || condition === "Damaged";
    const issueId = uid();
    const observation: Observation = {
      assetId: found.id,
      expectedLocationId: expected,
      expectedPersonId: snapshot?.expectedPersonId || found.personId,
      observedLocationId: observedLocation,
      condition,
      verifiedAt: now(),
      verifier: officerName,
      note: note.trim(),
    };
    commit(
      "Physical verification recorded",
      `${found.tag} · ${audit.name}`,
      (draft) => {
        const target = draft.audits.find((item) => item.id === audit.id)!;
        const index = target.observations.findIndex(
          (item) => item.assetId === found.id,
        );
        if (index >= 0) target.observations[index] = observation;
        else target.observations.push(observation);
        const asset = draft.assets.find((item) => item.id === found.id)!;
        asset.lastVerified = today();
        asset.condition = condition;
        if (asset.status === "Available" || asset.status === "Needs service") {
          asset.status =
            condition === "Damaged" ? "Needs service" : "Available";
        }
        asset.nextVerification = relativeDay(draft.settings.verificationDays);
        if (needsIssue)
          draft.issues.unshift({
            id: issueId,
            assetId: found.id,
            auditId: audit.id,
            title: mismatch
              ? "Observed location differs from the audit record"
              : "Damage found during verification",
            type: mismatch ? "Location mismatch" : "Damage",
            owner: officerName,
            dueAt: relativeDay(7),
            status: "Open",
            note: note.trim(),
            expectedLocationId: expected,
            observedLocationId: observedLocation,
            resolvedAt: "",
          });
      },
    );
    setFound(null);
    setTag("");
    setError("");
    if (needsIssue) notify("Verification recorded and discrepancy opened");
  }
  function closeAudit() {
    if (!audit) return;
    const missingIds = outstanding.map((item) => ({ ...item, issueId: uid() }));
    commit(
      "Verification closed",
      `${audit.name} · ${missingIds.length} unseen assets`,
      (draft) => {
        draft.audits.find((item) => item.id === audit.id)!.closedAt = now();
        missingIds.forEach((item) => {
          draft.issues.unshift({
            id: item.issueId,
            assetId: item.assetId,
            auditId: audit.id,
            title: "Asset unseen when verification closed",
            type: "Not seen",
            owner: officerName,
            dueAt: relativeDay(7),
            status: "Open",
            note: "Follow up on the physical device and recorded custodian.",
            expectedLocationId: item.expectedLocationId,
            observedLocationId: "",
            resolvedAt: "",
          });
        });
      },
    );
    setClosing(false);
    setFound(null);
  }
  return (
    <>
      <PageHeading
        title="Physical verification"
        description="Scan the label. Check the device. Keep a record of what you found."
      >
        <button
          className="button primary"
          onClick={() => {
            setCreating(true);
            setError("");
          }}
        >
          <Plus size={17} />
          Start verification
        </button>
      </PageHeading>
      <div className="summary-strip">
        <div>
          <strong>
            {state.audits.filter((item) => !item.closedAt).length}
          </strong>
          <span>Audits in progress</span>
        </div>
        <div>
          <strong>{state.assets.filter(verificationDue).length}</strong>
          <span>Assets due for verification</span>
        </div>
        <div>
          <strong>{state.audits.filter((item) => item.closedAt).length}</strong>
          <span>Completed audits</span>
        </div>
      </div>
      <div className="verification-layout">
        <div className="audit-list">
          {state.audits.map((item) => (
            <button
              key={item.id}
              className={`audit-card ${item.id === selected ? "selected" : ""}`}
              onClick={() => {
                setSelected(item.id);
                setFound(null);
                setError("");
                setCamera(false);
              }}
            >
              <div>
                <ClipboardCheck size={20} />
                <Badge>{item.closedAt ? "Completed" : "In progress"}</Badge>
              </div>
              <h3>{item.name}</h3>
              <p>
                {
                  state.locations.find(
                    (location) => location.id === item.locationId,
                  )?.branch
                }{" "}
                / Due {dateLabel(item.dueAt)}
              </p>
              <div className="progress-track">
                <span
                  style={{
                    width: `${(item.observations.filter((row) => row.verifiedAt).length / (item.observations.length || 1)) * 100}%`,
                  }}
                />
              </div>
              <small>
                {item.observations.filter((row) => row.verifiedAt).length} of{" "}
                {item.observations.length} verified
              </small>
            </button>
          ))}
        </div>
        {audit ? (
          <Panel
            title={audit.name}
            description={`${verified} verified · ${outstanding.length} outstanding`}
            action={
              audit.closedAt ? (
                <Badge>Completed</Badge>
              ) : (
                <button
                  className="button secondary small"
                  onClick={() => setClosing(true)}
                >
                  <CheckCheck size={16} />
                  Close audit
                </button>
              )
            }
          >
            {!audit.closedAt && (
              <div className="scan-workspace">
                {found ? (
                  <form onSubmit={verify}>
                    <button
                      type="button"
                      className="text-link"
                      onClick={() => {
                        setFound(null);
                        setError("");
                      }}
                    >
                      <ArrowLeft size={15} />
                      Back to scanning
                    </button>
                    <div className="scan-asset">
                      <span className="device-icon">
                        <IconForAsset category={found.category} />
                      </span>
                      <div>
                        <strong>{found.name}</strong>
                        <p>{found.tag}</p>
                      </div>
                    </div>
                    <div className="form-grid">
                      <Field label="Serial number on the physical device" full>
                        <input
                          autoFocus
                          required
                          value={serial}
                          onChange={(event) => setSerial(event.target.value)}
                          placeholder="Type the serial to confirm this device"
                        />
                      </Field>
                      <Field label="Observed location">
                        <Select
                          value={observedLocation}
                          onValueChange={(event) => setObservedLocation(event)}
                        >
                          {state.locations.map((location) => (
                            <option value={location.id} key={location.id}>
                              {location.branch} / {location.name}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Field label="Observed condition">
                        <Select
                          value={condition}
                          onValueChange={(event) =>
                            setCondition(event as Condition)
                          }
                        >
                          {["Good", "Fair", "Damaged"].map((value) => (
                            <option key={value}>{value}</option>
                          ))}
                        </Select>
                      </Field>
                      <Field label="Verification notes" full>
                        <input
                          maxLength={300}
                          value={note}
                          onChange={(event) => setNote(event.target.value)}
                          placeholder="Accessories, damage, or anything to follow up"
                        />
                      </Field>
                    </div>
                    <ErrorMessage error={error} />
                    <button className="button primary" type="submit">
                      <Check size={17} />
                      Record verification
                    </button>
                  </form>
                ) : (
                  <>
                    <div className="scan-intro">
                      <span className="scan-icon">
                        <ScanLine size={28} />
                      </span>
                      <div>
                        <h3>Check the next device</h3>
                        <p>
                          Use a camera, a USB scanner, or enter the printed tag.
                        </p>
                      </div>
                    </div>
                    {camera && (
                      <CameraScanner
                        onClose={() => setCamera(false)}
                        onRead={(value) => {
                          setTag(value);
                          setCamera(false);
                          lookup(value);
                        }}
                      />
                    )}
                    <form
                      className="scan-input"
                      onSubmit={(event) => {
                        event.preventDefault();
                        lookup();
                      }}
                    >
                      <input
                        aria-label="Asset tag to verify"
                        required
                        value={tag}
                        onChange={(event) => setTag(event.target.value)}
                        placeholder="e.g. EIMTS-IT-0016"
                      />
                      <button className="button primary">Find asset</button>
                      <button
                        type="button"
                        className="icon-button outlined"
                        aria-label="Scan with camera"
                        onClick={() => setCamera((value) => !value)}
                      >
                        <Camera size={19} />
                      </button>
                    </form>
                    <ErrorMessage error={error} />
                  </>
                )}
              </div>
            )}
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Expected asset</th>
                    <th>Expected custodian</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.observations.map((item) => {
                    const asset = state.assets.find(
                      (asset) => asset.id === item.assetId,
                    )!;
                    return (
                      <tr key={item.assetId}>
                        <td>
                          <button
                            className="table-link"
                            onClick={() =>
                              onOpen({ kind: "details", id: item.assetId })
                            }
                          >
                            {asset.name}
                          </button>
                          <small className="cell-secondary">{asset.tag}</small>
                        </td>
                        <td>
                          {state.people.find(
                            (person) => person.id === item.expectedPersonId,
                          )?.name || "IT stock"}
                        </td>
                        <td>
                          {item.verifiedAt ? (
                            <>
                              <Badge>Recorded</Badge>
                              <small className="cell-secondary">
                                {dateLabel(item.verifiedAt)} / {item.verifier}
                              </small>
                            </>
                          ) : (
                            <Badge tone={audit.closedAt ? "red" : "gray"}>
                              {audit.closedAt ? "Not seen" : "Awaiting check"}
                            </Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        ) : (
          <Panel title="Your first physical verification">
            <Empty
              title="Start with one location"
              description="We will capture its expected inventory so missing devices stay visible."
            />
          </Panel>
        )}
      </div>
      {creating && (
        <Modal
          title="Start physical verification"
          description="The expected asset list is captured when the audit starts."
          onClose={() => setCreating(false)}
        >
          <form onSubmit={create}>
            <div className="form-grid">
              <Field label="Verification name" full>
                <input
                  required
                  maxLength={100}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. Kandy quarterly verification"
                />
              </Field>
              <Field label="Location" full>
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
              <Field label="Due date" full>
                <input
                  required
                  type="date"
                  min={today()}
                  value={dueAt}
                  onChange={(event) => setDueAt(event.target.value)}
                />
              </Field>
            </div>
            <ErrorMessage error={error} />
            <FormActions
              onClose={() => setCreating(false)}
              label="Start verification"
            />
          </form>
        </Modal>
      )}
      {closing && (
        <Modal
          title="Close this verification?"
          onClose={() => setClosing(false)}
        >
          <div className="modal-body">
            <p>
              {outstanding.length
                ? `${outstanding.length} assets have not been seen. Each will open a discrepancy assigned to IT for follow-up.`
                : "Every expected asset has been physically verified. The audit is ready to close."}
            </p>
            <p className="muted">
              The audit’s expected locations and custodians remain in its
              history.
            </p>
          </div>
          <div className="form-actions">
            <button
              className="button secondary"
              onClick={() => setClosing(false)}
            >
              Keep checking
            </button>
            <button className="button primary" onClick={closeAudit}>
              Close audit
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
