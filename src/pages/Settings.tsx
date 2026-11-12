import { useState } from "react";
import type { FormEvent } from "react";
import {
  ArrowDownToLine,
  DatabaseBackup,
  FolderOpen,
  Plus,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { useInventory } from "../store";
import { createSeed } from "../seed";
import { inventorySchema } from "../schema";
import type { InventoryState, Member } from "../model";
import { today, uid } from "../model";
import { download } from "../lib/files";
import {
  ErrorMessage,
  Field,
  FormActions,
  Modal,
  PageHeading,
  Panel,
} from "../components/ui";

export function Settings() {
  const { state, commit, replace, notify } = useInventory();
  const [organisation, setOrganisation] = useState(state.settings.organisation);
  const [interval, setInterval] = useState(state.settings.verificationDays);
  const [prefix, setPrefix] = useState(state.settings.paperPrefix);
  const [member, setMember] = useState<Member | null>(null);
  const [restoring, setRestoring] = useState<InventoryState | null>(null);
  const [resetting, setResetting] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  function save(event: FormEvent) {
    event.preventDefault();
    if (!organisation.trim() || !prefix.trim())
      return setError("Enter an organisation name and paper reference prefix.");
    commit("Workspace settings saved", organisation.trim(), (draft) => {
      draft.settings = {
        organisation: organisation.trim(),
        verificationDays: interval,
        paperPrefix: prefix.trim(),
      };
    });
  }
  async function readBackup(file?: File) {
    setError("");
    if (!file) return;
    if (file.size > 8 * 1024 * 1024)
      return setError("Choose an EIMTS preview backup smaller than 8 MB.");
    try {
      const parsed = inventorySchema.safeParse(JSON.parse(await file.text()));
      if (!parsed.success)
        return setError(
          "This file is not a valid EIMTS preview backup. Its structure, IDs, or inventory references could not be validated.",
        );
      setRestoring(parsed.data);
    } catch {
      setError(
        "The backup could not be read. Choose a valid JSON backup exported from this preview.",
      );
    }
  }
  function saveMember(event: FormEvent) {
    event.preventDefault();
    if (!member || !member.name.trim())
      return setError("Enter the IT member’s name.");
    if (
      state.members.some(
        (item) =>
          item.email.toLowerCase() === member.email.trim().toLowerCase(),
      )
    )
      return setError("This email is already listed.");
    const clean = {
      ...member,
      name: member.name.trim(),
      email: member.email.trim().toLowerCase(),
    };
    commit("IT access draft added", clean.name, (draft) => {
      draft.members.push(clean);
    });
    setMember(null);
  }
  return (
    <>
      <PageHeading
        title="Workspace settings"
        description="Organisation details, IT access design, and preview data."
      />
      <div className="settings-layout">
        <Panel title="General" description="Defaults for new records.">
          <form onSubmit={save}>
            <div className="form-grid">
              <Field label="Organisation name" full>
                <input
                  required
                  maxLength={80}
                  value={organisation}
                  onChange={(event) => setOrganisation(event.target.value)}
                />
              </Field>
              <Field label="Verification interval (days)">
                <input
                  required
                  type="number"
                  min="1"
                  max="365"
                  value={interval}
                  onChange={(event) => setInterval(Number(event.target.value))}
                />
              </Field>
              <Field label="Paper reference prefix">
                <input
                  required
                  maxLength={20}
                  value={prefix}
                  onChange={(event) => setPrefix(event.target.value)}
                />
              </Field>
              <p className="field-note full">
                The interval applies to newly registered or newly verified
                assets.
              </p>
            </div>
            <div className="form-actions">
              <button className="button primary">Save settings</button>
            </div>
          </form>
        </Panel>
        <Panel
          title="Paper document workflow"
          action={<FolderOpen size={19} className="muted" />}
        >
          <div className="settings-copy">
            <p>
              Print handover forms, asset records, reports, and QR labels from
              their record screens.
            </p>
            <p>
              Record the paper form number, cabinet or file location, and
              whether the signed form has been received.
            </p>
            <div className="info-note">
              Documents are filed physically by IT. These records store the
              reference and filing location.
            </div>
          </div>
        </Panel>
      </div>
      <Panel
        title="IT access"
        description="Account and role design for the database integration step."
        action={
          <button
            className="button secondary small"
            onClick={() => {
              setMember({ id: uid(), name: "", email: "", role: "IT Officer" });
              setError("");
            }}
          >
            <Plus size={16} />
            Add access draft
          </button>
        }
      >
        <div className="info-note inset">
          <ShieldCheck size={20} />
          <span>
            This frontend uses sample accounts. IT login, authenticator MFA,
            account disabling, and enforced permissions will connect with the
            backend.
          </span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>IT member</th>
                <th>Planned role</th>
                <th>Scope</th>
              </tr>
            </thead>
            <tbody>
              {state.members.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.name}</strong>
                    <small className="cell-secondary">{item.email}</small>
                  </td>
                  <td>{item.role}</td>
                  <td>
                    {item.role === "IT Admin"
                      ? "Inventory, verification, IT accounts, and settings"
                      : "Inventory, custody, verification, and reports"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel
        title="Preview backup & recovery"
        description="Export and restore the data saved in this browser."
        action={<DatabaseBackup size={20} className="muted" />}
      >
        <div className="settings-copy">
          <p>
            Download a complete JSON snapshot of the sample workspace. CSV
            reports are available for individual modules.
          </p>
          <div className="row-actions wrap">
            <button
              className="button secondary"
              onClick={() =>
                download(
                  `eimts-preview-${today()}.json`,
                  JSON.stringify(state, null, 2),
                  "application/json",
                )
              }
            >
              <ArrowDownToLine size={17} />
              Export preview backup
            </button>
            <label className="button secondary file-button">
              <DatabaseBackup size={17} />
              Choose backup to restore
              <input
                type="file"
                accept="application/json,.json"
                onChange={(event) => {
                  void readBackup(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
            </label>
            <button
              className="button secondary"
              onClick={() => {
                setResetting(true);
                setConfirmation("");
              }}
            >
              <RotateCcw size={16} />
              Reset sample data
            </button>
          </div>
          <p className="field-note">
            Scheduled encrypted database backups and restore verification belong
            to the backend step.
          </p>
          <ErrorMessage error={error} />
        </div>
      </Panel>
      {member && (
        <Modal
          title="Draft an IT account"
          description="This saves the planned account locally for review."
          onClose={() => setMember(null)}
        >
          <form onSubmit={saveMember}>
            <div className="form-grid">
              <Field label="Name" full>
                <input
                  required
                  maxLength={100}
                  value={member.name}
                  onChange={(event) =>
                    setMember({ ...member, name: event.target.value })
                  }
                />
              </Field>
              <Field label="Work email" full>
                <input
                  required
                  type="email"
                  value={member.email}
                  onChange={(event) =>
                    setMember({ ...member, email: event.target.value })
                  }
                />
              </Field>
              <Field label="IT role" full>
                <select
                  value={member.role}
                  onChange={(event) =>
                    setMember({
                      ...member,
                      role: event.target.value as Member["role"],
                    })
                  }
                >
                  <option>IT Officer</option>
                  <option>IT Admin</option>
                </select>
              </Field>
            </div>
            <ErrorMessage error={error} />
            <FormActions
              onClose={() => setMember(null)}
              label="Save access draft"
            />
          </form>
        </Modal>
      )}
      {restoring && (
        <Modal
          title="Restore this preview backup?"
          onClose={() => setRestoring(null)}
        >
          <div className="modal-body">
            <p>
              The chosen backup contains {restoring.assets.length} assets and{" "}
              {restoring.people.length} employee records. Restoring replaces the
              preview data currently in this browser.
            </p>
          </div>
          <div className="form-actions">
            <button
              className="button secondary"
              onClick={() => setRestoring(null)}
            >
              Cancel
            </button>
            <button
              className="button primary"
              onClick={() => {
                replace(restoring);
                setOrganisation(restoring.settings.organisation);
                setInterval(restoring.settings.verificationDays);
                setPrefix(restoring.settings.paperPrefix);
                setRestoring(null);
                notify("Preview backup restored");
              }}
            >
              Restore backup
            </button>
          </div>
        </Modal>
      )}
      {resetting && (
        <Modal
          title="Reset the sample workspace?"
          onClose={() => setResetting(false)}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (confirmation !== "RESET") return;
              replace(createSeed());
              setResetting(false);
              notify("Sample workspace reset");
            }}
          >
            <div className="modal-body">
              <p>
                This replaces your local preview changes with the original
                sample records. Export a preview backup first if you want to
                keep your changes.
              </p>
              <Field label="Type RESET to confirm">
                <input
                  required
                  pattern="RESET"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                />
              </Field>
            </div>
            <FormActions
              onClose={() => setResetting(false)}
              label="Reset sample data"
              disabled={confirmation !== "RESET"}
            />
          </form>
        </Modal>
      )}
    </>
  );
}
