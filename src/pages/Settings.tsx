import { useState } from "react";
import type { FormEvent } from "react";
import { ArrowDownToLine, FolderOpen, Plus } from "lucide-react";
import { useInventory } from "../store";
import { useAuth } from "../auth";
import { download } from "../lib/files";
import { today } from "../model";
import { Select } from "../components/Select";
import {
  ErrorMessage,
  Field,
  FormActions,
  Modal,
  PageHeading,
  Panel,
} from "../components/ui";

export function Settings() {
  const { state, command, saving } = useInventory();
  const { member } = useAuth();
  const admin = member?.role === "IT Admin";
  const [organisation, setOrganisation] = useState(state.settings.organisation);
  const [interval, setInterval] = useState(state.settings.verificationDays);
  const [prefix, setPrefix] = useState(state.settings.paperPrefix);
  const [adding, setAdding] = useState(false);
  const [userId, setUserId] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("IT Officer");
  const [error, setError] = useState("");
  async function save(event: FormEvent) {
    event.preventDefault();
    await command(
      "save_settings",
      {
        version: state.settings.version || 1,
        organisation: organisation.trim(),
        verification_days: interval,
        paper_prefix: prefix.trim(),
      },
      "Workspace settings saved",
    );
  }
  async function addMember(event: FormEvent) {
    event.preventDefault();
    if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(userId.trim()))
      return setError("Enter the existing Auth user UUID.");
    if (
      await command(
        "save_it_member",
        {
          user_id: userId.trim(),
          display_name: name.trim(),
          role,
          active: true,
        },
        "IT access granted",
      )
    ) {
      setAdding(false);
      setUserId("");
      setName("");
    }
  }
  return (
    <>
      <PageHeading
        title="Workspace settings"
        description="Organisation defaults, IT access, and paper records."
      />
      <div className="settings-layout">
        <Panel title="General" description="Defaults for new records.">
          <form onSubmit={save}>
            <fieldset
              disabled={!admin || saving}
              style={{ border: 0, padding: 0, margin: 0 }}
            >
              <div className="form-grid">
                <Field label="Organisation name" full>
                  <input
                    required
                    maxLength={80}
                    value={organisation}
                    onChange={(e) => setOrganisation(e.target.value)}
                  />
                </Field>
                <Field label="Verification interval (days)">
                  <input
                    required
                    type="number"
                    min={1}
                    max={365}
                    value={interval}
                    onChange={(e) => setInterval(Number(e.target.value))}
                  />
                </Field>
                <Field label="Paper reference prefix">
                  <input
                    required
                    maxLength={20}
                    value={prefix}
                    onChange={(e) => setPrefix(e.target.value)}
                  />
                </Field>
              </div>
              <div className="form-actions">
                <button className="button primary">Save settings</button>
              </div>
            </fieldset>
            <ErrorMessage error="" />
          </form>
        </Panel>
        <Panel
          title="Paper document workflow"
          action={<FolderOpen size={19} />}
        >
          <div className="settings-copy">
            <p>
              Print handover forms, asset records, reports, and QR labels from
              their record screens.
            </p>
            <p>
              Record the paper reference, filing location, and receipt of the
              signed form.
            </p>
          </div>
        </Panel>
      </div>
      <Panel
        title="IT access"
        description="Only active IT members can open this workspace."
        action={
          admin ? (
            <button
              className="button secondary small"
              onClick={() => {
                setAdding(true);
                setError("");
              }}
            >
              <Plus size={16} />
              Grant IT access
            </button>
          ) : undefined
        }
      >
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>IT member</th>
                <th>Role</th>
                <th>Status</th>
                {admin && <th>Access</th>}
              </tr>
            </thead>
            <tbody>
              {state.members.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.name}</strong>
                    {item.email && (
                      <small className="cell-secondary">{item.email}</small>
                    )}
                  </td>
                  <td>{item.role}</td>
                  <td>{item.active ? "Active" : "Disabled"}</td>
                  {admin && (
                    <td>
                      <button
                        className="button secondary small"
                        disabled={saving}
                        onClick={() =>
                          void command(
                            "save_it_member",
                            {
                              user_id: item.id,
                              display_name: item.name,
                              role: item.role,
                              active: !item.active,
                              version: item.version || 1,
                            },
                            item.active
                              ? "IT access disabled"
                              : "IT access enabled",
                          )
                        }
                      >
                        {item.active ? "Disable" : "Enable"}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel
        title="Data export"
        description="Download a JSON copy of the currently loaded inventory."
      >
        <div className="settings-copy">
          <button
            className="button secondary"
            onClick={() =>
              download(
                `eimts-inventory-${today()}.json`,
                JSON.stringify(state, null, 2),
                "application/json",
              )
            }
          >
            <ArrowDownToLine size={17} />
            Export inventory
          </button>
        </div>
      </Panel>
      {adding && (
        <Modal
          title="Grant IT access"
          description="Create the account in Supabase Authentication first, then use its user ID here."
          onClose={() => setAdding(false)}
        >
          <form onSubmit={addMember}>
            <div className="form-grid">
              <Field label="Auth user ID" full>
                <input
                  required
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                />
              </Field>
              <Field label="Display name" full>
                <input
                  required
                  maxLength={100}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
              <Field label="IT role" full>
                <Select value={role} onValueChange={setRole}>
                  <option>IT Officer</option>
                  <option>IT Admin</option>
                </Select>
              </Field>
            </div>
            <ErrorMessage error={error} />
            <FormActions
              onClose={() => setAdding(false)}
              label="Grant access"
            />
          </form>
        </Modal>
      )}
    </>
  );
}
