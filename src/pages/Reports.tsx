import { useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpRight,
  ClipboardCheck,
  FileClock,
  FileText,
  Printer,
  ShieldCheck,
  Users,
  Wrench,
} from "lucide-react";
import { useInventory } from "../store";
import { dateLabel, relativeDay, today, verificationDue } from "../model";
import { Empty, Modal, PageHeading, Panel } from "../components/ui";
import { exportCsv } from "../lib/files";

export function Reports({
  initialReport = "custody",
}: {
  initialReport?: string;
}) {
  const { state } = useInventory();
  const [selected, setSelected] = useState(
    [
      "custody",
      "verification",
      "issues",
      "warranty",
      "paper",
      "repairs",
    ].includes(initialReport)
      ? initialReport
      : "custody",
  );
  const [printing, setPrinting] = useState(false);
  const reports = [
    {
      id: "custody",
      title: "Assets by employee",
      description: "Current custody across departments.",
      icon: Users,
    },
    {
      id: "verification",
      title: "Overdue verifications",
      description: "Devices waiting for a physical check.",
      icon: ClipboardCheck,
    },
    {
      id: "issues",
      title: "Unresolved discrepancies",
      description: "Open cases, owners, and due dates.",
      icon: FileClock,
    },
    {
      id: "warranty",
      title: "Warranty register",
      description: "Expired and upcoming warranty dates.",
      icon: ShieldCheck,
    },
    {
      id: "paper",
      title: "Handover paperwork",
      description: "Paper references and signed-form status.",
      icon: FileText,
    },
    {
      id: "repairs",
      title: "Maintenance history",
      description: "Service outcomes and recorded costs.",
      icon: Wrench,
    },
  ];
  const report = reports.find((item) => item.id === selected)!;
  const personName = (id: string) =>
    state.people.find((item) => item.id === id)?.name || "IT stock";
  const tag = (id: string) =>
    state.assets.find((item) => item.id === id)?.tag || "";
  let rows: Record<string, string | number>[] = [];
  if (selected === "custody")
    rows = state.assets
      .filter((asset) => asset.status === "Assigned")
      .map((asset) => ({
        Employee: personName(asset.personId),
        "Asset tag": asset.tag,
        Device: asset.name,
        Branch:
          state.locations.find((location) => location.id === asset.locationId)
            ?.branch || "",
      }));
  if (selected === "verification")
    rows = state.assets.filter(verificationDue).map((asset) => ({
      "Asset tag": asset.tag,
      Device: asset.name,
      Custodian: personName(asset.personId),
      "Last verified": dateLabel(asset.lastVerified),
      "Due date": dateLabel(asset.nextVerification),
    }));
  if (selected === "issues")
    rows = state.issues
      .filter((issue) => issue.status === "Open")
      .map((issue) => ({
        Asset: tag(issue.assetId),
        Discrepancy: issue.title,
        Owner: issue.owner,
        Due: dateLabel(issue.dueAt),
        Notes: issue.note,
      }));
  if (selected === "warranty")
    rows = state.assets
      .filter((asset) => asset.warranty && asset.status !== "Retired")
      .sort((a, b) => a.warranty.localeCompare(b.warranty))
      .map((asset) => ({
        Asset: asset.tag,
        Device: asset.name,
        "Warranty expiry": dateLabel(asset.warranty),
        Status:
          asset.warranty < today()
            ? "Expired"
            : asset.warranty <= relativeDay(60)
              ? "Expires within 60 days"
              : "Covered",
      }));
  if (selected === "paper")
    rows = state.handovers.map((item) => ({
      Reference: item.reference,
      Asset: tag(item.assetId),
      Employee: personName(item.personId),
      "Signed form": item.received ? "Filed" : "Pending",
      "Filing location": item.filing,
      Returned: dateLabel(item.returnedAt),
    }));
  if (selected === "repairs")
    rows = state.repairs.map((item) => ({
      Asset: tag(item.assetId),
      Fault: item.problem,
      Provider: item.vendor,
      Status: item.closedAt ? "Completed" : "In progress",
      "Cost (LKR)": item.cost,
      Reference: item.reference,
      Outcome: item.resolution,
    }));
  const headers = Object.keys(rows[0] || {});
  const table = (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {headers.map((header) => (
                <td key={header}>{row[header] || "—"}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  return (
    <>
      <PageHeading
        title="Inventory reports"
        description="A useful record for each review, follow-up, and filing."
      />
      <div className="report-grid">
        {reports.map((item) => (
          <button
            key={item.id}
            className={`report-card ${item.id === selected ? "selected" : ""}`}
            onClick={() => setSelected(item.id)}
          >
            <item.icon size={23} strokeWidth={1.5} />
            <ArrowUpRight className="report-arrow" size={17} />
            <h3>{item.title}</h3>
            <p>{item.description}</p>
          </button>
        ))}
      </div>
      <Panel
        title={report.title}
        description={`${rows.length} records / Generated ${dateLabel(today())}`}
        action={
          <div className="row-actions">
            <button
              className="button secondary small"
              disabled={!rows.length}
              onClick={() => setPrinting(true)}
            >
              <Printer size={16} />
              Print
            </button>
            <button
              className="button primary small"
              disabled={!rows.length}
              onClick={() =>
                exportCsv(`eimts-${selected}-${today()}.csv`, rows)
              }
            >
              <ArrowDownToLine size={16} />
              Export CSV
            </button>
          </div>
        }
      >
        {rows.length ? (
          table
        ) : (
          <Empty
            title="No records for this report"
            description="Records appear as you use the inventory workflows."
          />
        )}
      </Panel>
      {printing && (
        <Modal title="Print report" onClose={() => setPrinting(false)} wide>
          <div className="print-sheet">
            <div className="paper-heading">
              <strong>{state.settings.organisation} Inventory</strong>
              <span>{dateLabel(today())}</span>
            </div>
            <h2>{report.title}</h2>
            {table}
          </div>
          <div className="form-actions">
            <button
              className="button secondary"
              onClick={() => setPrinting(false)}
            >
              Close
            </button>
            <button className="button primary" onClick={() => window.print()}>
              <Printer size={16} />
              Print report
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
