import { useState } from "react";
import type { FormEvent } from "react";
import type { Handover } from "../model";
import { ArrowDownLeft, FileText, Plus } from "lucide-react";
import { useInventory } from "../store";
import { dateLabel, today } from "../model";
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

export function Custody({ onOpen }: { onOpen: (dialog: AssetDialog) => void }) {
  const { state, command } = useInventory();
  const [tab, setTab] = useState("Current assignments");
  const [search, setSearch] = useState("");
  const [paper, setPaper] = useState<Handover | null>(null);
  const [error, setError] = useState("");
  async function savePaper(event: FormEvent) {
    event.preventDefault();
    if (!paper) return;
    if (paper.received && !paper.filing.trim())
      return setError("Record the signed form filing location.");
    if (
      await command(
        "record_signed_form",
        {
          handover_id: paper.id,
          version: paper.version || 1,
          signed_received: paper.received,
          paper_reference: paper.reference.trim(),
          filing_location: paper.filing.trim(),
        },
        "Paper record updated",
      )
    )
      setPaper(null);
  }
  const filtered = state.handovers.filter(
    (item) =>
      (tab === "History" || !item.returnedAt) &&
      (tab !== "Paperwork pending" || !item.received) &&
      `${state.assets.find((asset) => asset.id === item.assetId)?.name} ${state.people.find((person) => person.id === item.personId)?.name} ${item.reference}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        title="Custody & handovers"
        description="Track every issue, transfer, return, and signed paper form."
      >
        <button
          className="button primary"
          onClick={() => onOpen({ kind: "issue" })}
        >
          <Plus size={17} />
          Issue asset
        </button>
      </PageHeading>
      <div className="summary-strip">
        <div>
          <strong>
            {state.handovers.filter((item) => !item.returnedAt).length}
          </strong>
          <span>Current assignments</span>
        </div>
        <div>
          <strong>
            {
              state.handovers.filter(
                (item) => !item.returnedAt && !item.received,
              ).length
            }
          </strong>
          <span>Signed forms pending</span>
        </div>
        <div>
          <strong>
            {
              state.handovers.filter(
                (item) =>
                  !item.returnedAt && item.dueAt && item.dueAt < today(),
              ).length
            }
          </strong>
          <span>Returns overdue</span>
        </div>
      </div>
      <section className="panel">
        <div className="tabs">
          {["Current assignments", "Paperwork pending", "History"].map(
            (value) => (
              <button
                key={value}
                className={value === tab ? "active" : ""}
                onClick={() => setTab(value)}
              >
                {value}
              </button>
            ),
          )}
        </div>
        <div className="table-toolbar">
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder="Search employee, device, or form reference…"
          />
        </div>
        {!filtered.length ? (
          <Empty
            title="No handovers here"
            description="Issue an available asset or adjust your search."
          />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Asset / employee</th>
                  <th>Handover</th>
                  <th>Paper record</th>
                  <th>Return date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const asset = state.assets.find(
                    (asset) => asset.id === item.assetId,
                  )!;
                  const person = state.people.find(
                    (person) => person.id === item.personId,
                  );
                  return (
                    <tr key={item.id}>
                      <td>
                        <button
                          className="table-link"
                          onClick={() =>
                            onOpen({ kind: "details", id: asset.id })
                          }
                        >
                          {asset.name}
                        </button>
                        <small className="cell-secondary">
                          {person?.name} / {asset.tag}
                        </small>
                      </td>
                      <td>
                        {dateLabel(item.issuedAt)}
                        <small className="cell-secondary">
                          {item.reference}
                        </small>
                      </td>
                      <td>
                        <Badge>{item.received ? "Recorded" : "Pending"}</Badge>
                        <small className="cell-secondary">
                          {item.filing || "Filing location pending"}
                        </small>
                        {
                          <button
                            className="text-link small"
                            onClick={() => {
                              setPaper(item);
                              setError("");
                            }}
                          >
                            Update paper record
                          </button>
                        }
                      </td>
                      <td>
                        {item.returnedAt ? (
                          <Badge>Completed</Badge>
                        ) : item.dueAt && item.dueAt < today() ? (
                          <>
                            <Badge>Overdue</Badge>
                            <small className="cell-secondary">
                              {dateLabel(item.dueAt)}
                            </small>
                          </>
                        ) : (
                          dateLabel(item.dueAt)
                        )}
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            className="icon-button outlined"
                            aria-label={`Print ${item.reference}`}
                            onClick={() =>
                              onOpen({
                                kind: "paper",
                                document: "handover",
                                ids: [asset.id],
                                handoverId: item.id,
                              })
                            }
                          >
                            <FileText size={17} />
                          </button>
                          {!item.returnedAt && asset.status === "Assigned" && (
                            <button
                              className="button secondary small"
                              onClick={() =>
                                onOpen({ kind: "return", id: item.id })
                              }
                            >
                              <ArrowDownLeft size={15} />
                              Return
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {paper && (
        <Modal
          title="Update paper record"
          description={paper.reference}
          onClose={() => setPaper(null)}
        >
          <form onSubmit={savePaper}>
            <div className="form-grid">
              <Field label="Paper form reference" full>
                <input
                  required
                  maxLength={80}
                  value={paper.reference}
                  onChange={(event) =>
                    setPaper({ ...paper, reference: event.target.value })
                  }
                />
              </Field>
              <Field label="Physical filing location" full>
                <input
                  maxLength={150}
                  value={paper.filing}
                  onChange={(event) =>
                    setPaper({ ...paper, filing: event.target.value })
                  }
                  placeholder="Cabinet A / Handovers / 2026"
                />
              </Field>
              <label className="checkbox-field full">
                <input
                  type="checkbox"
                  checked={paper.received}
                  onChange={(event) =>
                    setPaper({ ...paper, received: event.target.checked })
                  }
                />
                Signed paper form received and filed
              </label>
            </div>
            <ErrorMessage error={error} />
            <FormActions
              onClose={() => setPaper(null)}
              label="Save paper record"
            />
          </form>
        </Modal>
      )}
    </>
  );
}
