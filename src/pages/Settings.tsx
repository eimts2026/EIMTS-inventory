import { useState } from "react";
import type { FormEvent } from "react";
import { ArrowDownToLine, FolderOpen } from "lucide-react";
import { useInventory } from "../store";
import { useAuth } from "../auth";
import { download } from "../lib/files";
import { today } from "../model";
import { ErrorMessage, Field, PageHeading, Panel } from "../components/ui";

export function Settings() {
  const { state, command, saving } = useInventory();
  const { member } = useAuth();
  const admin = member?.role === "IT Admin";
  const [organisation, setOrganisation] = useState(state.settings.organisation);
  const [interval, setInterval] = useState(state.settings.verificationDays);
  const [prefix, setPrefix] = useState(state.settings.paperPrefix);
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
  return (
    <>
      <PageHeading
        title="Workspace settings"
        description="Organisation defaults and paper records."
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
    </>
  );
}
