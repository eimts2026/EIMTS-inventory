import { Select } from "../components/Select";
import { useState } from "react";
import type { FormEvent } from "react";
import { Check, CircleAlert, Plus, Wrench } from "lucide-react";
import type { Issue, Repair } from "../model";
import {
  currency,
  dateLabel,
  now,
  officerName,
  relativeDay,
  today,
  uid,
} from "../model";
import { useInventory } from "../store";
import {
  Badge,
  Empty,
  ErrorMessage,
  Field,
  FormActions,
  Modal,
  PageHeading,
  SearchField,
} from "../components/ui";
import type { AssetDialog } from "../components/AssetDialogs";

export function Issues({ onOpen }: { onOpen: (dialog: AssetDialog) => void }) {
  const { state, commit } = useInventory();
  const [tab, setTab] = useState("Open");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [resolving, setResolving] = useState<Issue | null>(null);
  const [assetId, setAssetId] = useState("");
  const [title, setTitle] = useState("");
  const [type, setType] = useState("Location mismatch");
  const [owner, setOwner] = useState(officerName);
  const [dueAt, setDueAt] = useState(relativeDay(7));
  const [observedLocationId, setObservedLocationId] = useState("");
  const [note, setNote] = useState("");
  const [resolution, setResolution] = useState("");
  const [applyLocation, setApplyLocation] = useState(false);
  const [error, setError] = useState("");
  const filtered = state.issues.filter(
    (issue) =>
      issue.status === tab &&
      `${issue.title} ${state.assets.find((asset) => asset.id === issue.assetId)?.tag} ${issue.owner}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  function save(event: FormEvent) {
    event.preventDefault();
    const asset = state.assets.find((item) => item.id === assetId);
    if (!asset || !title.trim())
      return setError("Select an asset and describe the discrepancy.");
    const issue: Issue = {
      id: uid(),
      assetId,
      auditId: "",
      title: title.trim(),
      type,
      owner,
      dueAt,
      status: "Open",
      note: note.trim(),
      expectedLocationId: asset.locationId,
      observedLocationId,
      resolvedAt: "",
    };
    commit("Discrepancy opened", `${asset.tag} · ${title.trim()}`, (draft) => {
      draft.issues.unshift(issue);
    });
    setCreating(false);
    setTitle("");
    setNote("");
  }
  function resolve(event: FormEvent) {
    event.preventDefault();
    if (!resolving || !resolution.trim())
      return setError("Record how the discrepancy was resolved.");
    commit(
      "Discrepancy resolved",
      `${state.assets.find((asset) => asset.id === resolving.assetId)?.tag} · ${resolution.trim()}`,
      (draft) => {
        const issue = draft.issues.find((item) => item.id === resolving.id)!;
        issue.status = "Resolved";
        issue.resolvedAt = now();
        issue.note += `\nResolution: ${resolution.trim()}`;
        if (applyLocation && issue.observedLocationId)
          draft.assets.find((asset) => asset.id === issue.assetId)!.locationId =
            issue.observedLocationId;
      },
    );
    setResolving(null);
  }
  return (
    <>
      <PageHeading
        title="Discrepancies"
        description="Keep each mismatch visible until someone accounts for it."
      >
        <button
          className="button primary"
          onClick={() => {
            setCreating(true);
            setError("");
          }}
        >
          <Plus size={17} />
          Raise discrepancy
        </button>
      </PageHeading>
      <div className="summary-strip">
        <div>
          <strong>
            {state.issues.filter((issue) => issue.status === "Open").length}
          </strong>
          <span>Open discrepancies</span>
        </div>
        <div>
          <strong>
            {
              state.issues.filter(
                (issue) => issue.status === "Open" && issue.dueAt < today(),
              ).length
            }
          </strong>
          <span>Follow-ups overdue</span>
        </div>
        <div>
          <strong>
            {state.issues.filter((issue) => issue.status === "Resolved").length}
          </strong>
          <span>Resolved</span>
        </div>
      </div>
      <section className="panel">
        <div className="tabs">
          {["Open", "Resolved"].map((value) => (
            <button
              className={tab === value ? "active" : ""}
              key={value}
              onClick={() => setTab(value)}
            >
              {value}
            </button>
          ))}
        </div>
        <div className="table-toolbar">
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder="Search discrepancy, asset tag, or owner…"
          />
        </div>
        {!filtered.length ? (
          <Empty
            title="No discrepancies here"
            description="New discrepancies from verification will appear here for follow-up."
          />
        ) : (
          <div className="issue-list">
            {filtered.map((issue) => {
              const asset = state.assets.find(
                (asset) => asset.id === issue.assetId,
              )!;
              return (
                <article className="issue-row" key={issue.id}>
                  <span
                    className={`attention-icon ${issue.status === "Resolved" ? "green" : "amber"}`}
                  >
                    {issue.status === "Resolved" ? (
                      <Check size={21} />
                    ) : (
                      <CircleAlert size={21} />
                    )}
                  </span>
                  <div className="issue-main">
                    <div>
                      <h3>{issue.title}</h3>
                      <Badge
                        tone={
                          issue.status === "Open" && issue.dueAt < today()
                            ? "red"
                            : ""
                        }
                      >
                        {issue.status === "Open" && issue.dueAt < today()
                          ? "Overdue"
                          : issue.status}
                      </Badge>
                    </div>
                    <button
                      className="table-link"
                      onClick={() => onOpen({ kind: "details", id: asset.id })}
                    >
                      {asset.tag} / {asset.name}
                    </button>
                    <p>{issue.note}</p>
                    {issue.observedLocationId && (
                      <div className="location-comparison">
                        <span>
                          Expected{" "}
                          <strong>
                            {
                              state.locations.find(
                                (location) =>
                                  location.id === issue.expectedLocationId,
                              )?.branch
                            }
                          </strong>
                        </span>
                        <span>
                          Observed{" "}
                          <strong>
                            {
                              state.locations.find(
                                (location) =>
                                  location.id === issue.observedLocationId,
                              )?.branch
                            }
                          </strong>
                        </span>
                      </div>
                    )}
                    <small>
                      {issue.owner} /{" "}
                      {issue.status === "Resolved"
                        ? `Resolved ${dateLabel(issue.resolvedAt)}`
                        : `Due ${dateLabel(issue.dueAt)}`}
                    </small>
                  </div>
                  {issue.status === "Open" && (
                    <button
                      className="button secondary small"
                      onClick={() => {
                        setResolving(issue);
                        setResolution("");
                        setApplyLocation(false);
                        setError("");
                      }}
                    >
                      Resolve
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
      {creating && (
        <Modal title="Raise a discrepancy" onClose={() => setCreating(false)}>
          <form onSubmit={save}>
            <div className="form-grid">
              <Field label="Asset" full>
                <Select
                  required
                  value={assetId}
                  onValueChange={(event) => setAssetId(event)}
                >
                  <option value="">Select an asset</option>
                  {state.assets.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.tag} / {asset.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Description" full>
                <input
                  required
                  maxLength={150}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </Field>
              <Field label="Issue type">
                <Select value={type} onValueChange={(event) => setType(event)}>
                  {[
                    "Location mismatch",
                    "Custodian mismatch",
                    "Not seen",
                    "Damage",
                    "Missing accessory",
                    "Label damaged",
                    "Other",
                  ].map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Follow-up due">
                <input
                  required
                  type="date"
                  value={dueAt}
                  onChange={(event) => setDueAt(event.target.value)}
                />
              </Field>
              <Field label="IT owner">
                <Select
                  required
                  value={owner}
                  onValueChange={(event) => setOwner(event)}
                >
                  {state.members.map((member) => (
                    <option key={member.id}>{member.name}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Observed location">
                <Select
                  value={observedLocationId}
                  onValueChange={(event) => setObservedLocationId(event)}
                >
                  <option value="">Not observed</option>
                  {state.locations.map((location) => (
                    <option value={location.id} key={location.id}>
                      {location.branch} / {location.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Notes" full>
                <textarea
                  maxLength={500}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
              </Field>
            </div>
            <ErrorMessage error={error} />
            <FormActions
              onClose={() => setCreating(false)}
              label="Raise discrepancy"
            />
          </form>
        </Modal>
      )}
      {resolving && (
        <Modal
          title="Resolve discrepancy"
          description={resolving.title}
          onClose={() => setResolving(null)}
        >
          <form onSubmit={resolve}>
            <div className="form-grid">
              <Field label="Resolution and evidence reference" full>
                <textarea
                  required
                  maxLength={500}
                  value={resolution}
                  onChange={(event) => setResolution(event.target.value)}
                  placeholder="What was confirmed, by whom, and the paper reference if applicable"
                />
              </Field>
              {resolving.observedLocationId &&
                resolving.observedLocationId !==
                  resolving.expectedLocationId && (
                  <label className="checkbox-field full">
                    <input
                      type="checkbox"
                      checked={applyLocation}
                      onChange={(event) =>
                        setApplyLocation(event.target.checked)
                      }
                    />
                    Update the register to the observed location
                  </label>
                )}
              <p className="field-note full">
                The original expected and observed locations stay in this
                discrepancy’s history.
              </p>
            </div>
            <ErrorMessage error={error} />
            <FormActions
              onClose={() => setResolving(null)}
              label="Resolve discrepancy"
            />
          </form>
        </Modal>
      )}
    </>
  );
}

export function Maintenance({
  onOpen,
}: {
  onOpen: (dialog: AssetDialog) => void;
}) {
  const { state, commit } = useInventory();
  const [creating, setCreating] = useState(false);
  const [closing, setClosing] = useState<Repair | null>(null);
  const [tab, setTab] = useState("In progress");
  const [assetId, setAssetId] = useState("");
  const [problem, setProblem] = useState("");
  const [vendor, setVendor] = useState("Internal IT");
  const [dueAt, setDueAt] = useState(relativeDay(7));
  const [reference, setReference] = useState("");
  const [cost, setCost] = useState(0);
  const [resolution, setResolution] = useState("");
  const [error, setError] = useState("");
  const eligible = state.assets.filter(
    (asset) => asset.status === "Available" || asset.status === "Needs service",
  );
  const filtered = state.repairs.filter((repair) =>
    tab === "Completed" ? Boolean(repair.closedAt) : !repair.closedAt,
  );
  function create(event: FormEvent) {
    event.preventDefault();
    const asset = state.assets.find((item) => item.id === assetId);
    if (
      !asset ||
      (asset.status !== "Available" && asset.status !== "Needs service")
    )
      return setError(
        "Choose an asset in IT stock. Record a return first for an assigned device.",
      );
    if (!problem.trim() || !vendor.trim())
      return setError("Enter the fault and service provider.");
    const repair: Repair = {
      id: uid(),
      assetId,
      problem: problem.trim(),
      vendor: vendor.trim(),
      dueAt,
      reference: reference.trim(),
      openedAt: now(),
      closedAt: "",
      cost: 0,
      resolution: "",
    };
    commit(
      "Maintenance opened",
      `${asset.tag} · ${problem.trim()}`,
      (draft) => {
        draft.repairs.unshift(repair);
        draft.assets.find((item) => item.id === assetId)!.status = "In repair";
      },
    );
    setCreating(false);
    setProblem("");
    setReference("");
  }
  function finish(event: FormEvent) {
    event.preventDefault();
    if (!closing || !resolution.trim())
      return setError("Record the repair outcome.");
    commit(
      "Maintenance completed",
      `${state.assets.find((asset) => asset.id === closing.assetId)?.tag} · ${resolution.trim()}`,
      (draft) => {
        const repair = draft.repairs.find((item) => item.id === closing.id)!;
        repair.closedAt = now();
        repair.cost = cost;
        repair.resolution = resolution.trim();
        const asset = draft.assets.find((item) => item.id === closing.assetId)!;
        asset.status = "Available";
        asset.condition = "Good";
      },
    );
    setClosing(null);
  }
  return (
    <>
      <PageHeading
        title="Maintenance"
        description="Follow each fault from service request to return to IT stock."
      >
        <button
          className="button primary"
          onClick={() => {
            setCreating(true);
            setError("");
          }}
        >
          <Plus size={17} />
          Log repair
        </button>
      </PageHeading>
      <div className="summary-strip">
        <div>
          <strong>
            {state.repairs.filter((item) => !item.closedAt).length}
          </strong>
          <span>Repairs in progress</span>
        </div>
        <div>
          <strong>
            {
              state.repairs.filter(
                (item) => !item.closedAt && item.dueAt < today(),
              ).length
            }
          </strong>
          <span>Service overdue</span>
        </div>
        <div>
          <strong>
            {currency(state.repairs.reduce((sum, item) => sum + item.cost, 0))}
          </strong>
          <span>Recorded repair costs</span>
        </div>
      </div>
      {state.assets.some((asset) => asset.status === "Needs service") && (
        <div className="info-note">
          <Wrench size={19} />
          <div>
            <strong>Devices awaiting service assessment</strong>
            <p>
              Damaged returns remain unavailable for issue until service is
              completed.
            </p>
            <div className="row-actions wrap">
              {state.assets
                .filter((asset) => asset.status === "Needs service")
                .map((asset) => (
                  <button
                    key={asset.id}
                    className="button secondary small"
                    onClick={() => {
                      setAssetId(asset.id);
                      setCreating(true);
                      setError("");
                    }}
                  >
                    {asset.tag} / Log repair
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}
      <section className="panel">
        <div className="tabs">
          {["In progress", "Completed"].map((value) => (
            <button
              key={value}
              className={value === tab ? "active" : ""}
              onClick={() => setTab(value)}
            >
              {value}
            </button>
          ))}
        </div>
        {!filtered.length ? (
          <Empty
            title="No repairs here"
            description="Log a repair when a device in IT stock needs service."
          />
        ) : (
          <div className="issue-list">
            {filtered.map((repair) => {
              const asset = state.assets.find(
                (item) => item.id === repair.assetId,
              )!;
              return (
                <article className="issue-row" key={repair.id}>
                  <span className="attention-icon blue">
                    <Wrench size={20} />
                  </span>
                  <div className="issue-main">
                    <div>
                      <h3>{repair.problem}</h3>
                      <Badge>
                        {repair.closedAt ? "Completed" : "In repair"}
                      </Badge>
                    </div>
                    <button
                      className="table-link"
                      onClick={() => onOpen({ kind: "details", id: asset.id })}
                    >
                      {asset.name} / {asset.tag}
                    </button>
                    <p>
                      {repair.vendor} /{" "}
                      {repair.reference || "Reference pending"}
                    </p>
                    {repair.resolution && (
                      <p>
                        {repair.resolution} / {currency(repair.cost)}
                      </p>
                    )}
                    <small>
                      Opened {dateLabel(repair.openedAt)} /{" "}
                      {repair.closedAt
                        ? `Completed ${dateLabel(repair.closedAt)}`
                        : `Expected ${dateLabel(repair.dueAt)}`}
                    </small>
                  </div>
                  {!repair.closedAt && (
                    <button
                      className="button secondary small"
                      onClick={() => {
                        setClosing(repair);
                        setResolution("");
                        setCost(0);
                        setError("");
                      }}
                    >
                      Complete repair
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
      {creating && (
        <Modal
          title="Log a repair"
          description="Assigned equipment needs a recorded return before service."
          onClose={() => setCreating(false)}
        >
          <form onSubmit={create}>
            <div className="form-grid">
              <Field label="Asset in IT stock" full>
                <Select
                  required
                  value={assetId}
                  onValueChange={(event) => setAssetId(event)}
                >
                  <option value="">Choose a device</option>
                  {eligible.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.tag} / {asset.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Fault description" full>
                <input
                  required
                  maxLength={200}
                  value={problem}
                  onChange={(event) => setProblem(event.target.value)}
                />
              </Field>
              <Field label="Service provider">
                <input
                  required
                  maxLength={100}
                  value={vendor}
                  onChange={(event) => setVendor(event.target.value)}
                />
              </Field>
              <Field label="Expected completion">
                <input
                  required
                  type="date"
                  min={today()}
                  value={dueAt}
                  onChange={(event) => setDueAt(event.target.value)}
                />
              </Field>
              <Field label="Paper service reference" full>
                <input
                  maxLength={80}
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                />
              </Field>
            </div>
            <ErrorMessage error={error} />
            <FormActions
              onClose={() => setCreating(false)}
              label="Log repair"
            />
          </form>
        </Modal>
      )}
      {closing && (
        <Modal
          title="Complete repair"
          description={closing.problem}
          onClose={() => setClosing(null)}
        >
          <form onSubmit={finish}>
            <div className="form-grid">
              <Field label="Repair outcome" full>
                <textarea
                  required
                  maxLength={500}
                  value={resolution}
                  onChange={(event) => setResolution(event.target.value)}
                />
              </Field>
              <Field label="Repair cost (LKR)" full>
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={cost}
                  onChange={(event) => setCost(Number(event.target.value))}
                />
              </Field>
              <label className="checkbox-field full">
                <input type="checkbox" required />
                Device checked and ready for IT stock
              </label>
            </div>
            <ErrorMessage error={error} />
            <FormActions
              onClose={() => setClosing(null)}
              label="Complete repair"
            />
          </form>
        </Modal>
      )}
    </>
  );
}
