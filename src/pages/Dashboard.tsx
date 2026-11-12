import { Select } from "../components/Select";
import { useState } from "react";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Box,
  CalendarDays,
  Check,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  Clock3,
  Laptop,
  Plus,
  ScanLine,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { useInventory } from "../store";
import { dateLabel, relativeDay, today, verificationDue } from "../model";
import { Badge, PageHeading, Panel, TextLink } from "../components/ui";
import type { AssetDialog } from "../components/AssetDialogs";
import { AssetTable } from "./Assets";

export function Dashboard({
  onOpen,
  navigate,
}: {
  onOpen: (dialog: AssetDialog) => void;
  navigate: (page: string) => void;
}) {
  const { state } = useInventory();
  const [branch, setBranch] = useState("");
  const [assetTab, setAssetTab] = useState("All assets");
  const assets = state.assets.filter(
    (asset) =>
      !branch ||
      state.locations.find((location) => location.id === asset.locationId)
        ?.branch === branch,
  );
  const assetIds = new Set(assets.map((asset) => asset.id));
  const due = assets.filter(verificationDue).length;
  const issues = state.issues.filter(
    (issue) => issue.status === "Open" && assetIds.has(issue.assetId),
  ).length;
  const repairs = assets.filter(
    (asset) => asset.status === "In repair" || asset.status === "Needs service",
  ).length;
  const audit = state.audits.find(
    (item) =>
      !item.closedAt &&
      (!branch ||
        state.locations.find((location) => location.id === item.locationId)
          ?.branch === branch),
  );
  const verified =
    audit?.observations.filter((item) => item.verifiedAt).length || 0;
  const total = audit?.observations.length || 0;
  const percent = total ? Math.round((verified / total) * 100) : 0;
  const categories = [
    "Laptop",
    "Desktop",
    "Monitor",
    "Printer",
    "Network",
    "Other",
  ]
    .map((name) => ({
      name,
      count: assets.filter((asset) => asset.category === name).length,
    }))
    .filter((item) => item.count);
  const colors = [
    "#24785f",
    "#7fae9c",
    "#c5d9c8",
    "#d8c896",
    "#94acb5",
    "#dce5e3",
  ];
  let start = 0;
  const segments = categories.map((item, index) => {
    const end = start + (item.count / (assets.length || 1)) * 100;
    const segment = `${colors[index]} ${start}% ${end}%`;
    start = end;
    return segment;
  });
  return (
    <>
      <PageHeading
        title="Inventory overview"
        description="Track custody, verification, and follow-ups across your branches."
      >
        <div className="date-display">
          <CalendarDays size={16} />
          {dateLabel(today())}
        </div>
        <button
          className="button primary"
          onClick={() => onOpen({ kind: "asset" })}
        >
          <Plus size={17} />
          Add asset
        </button>
      </PageHeading>
      <div className="overview-scope">
        <span>
          <span className="live-dot" />
          IT department workspace
        </span>
        <Select
          aria-label="Dashboard branch"
          value={branch}
          onValueChange={(event) => setBranch(event)}
        >
          <option value="">All branches</option>
          {[...new Set(state.locations.map((location) => location.branch))].map(
            (value) => (
              <option key={value}>{value}</option>
            ),
          )}
        </Select>
      </div>
      <div className="metric-grid">
        {[
          {
            name: "Total assets",
            value: assets.length,
            detail: `${new Set(assets.map((asset) => asset.locationId)).size} locations in your register`,
            icon: Box,
            color: "green",
            page: "assets",
          },
          {
            name: "Assigned to people",
            value: assets.filter((asset) => asset.status === "Assigned").length,
            detail: `${assets.length ? Math.round((assets.filter((asset) => asset.status === "Assigned").length / assets.length) * 100) : 0}% of your total inventory`,
            icon: Laptop,
            color: "blue",
            page: "custody",
          },
          {
            name: "Ready to deploy",
            value: assets.filter((asset) => asset.status === "Available")
              .length,
            detail: "Available in IT stock",
            icon: ArrowDownLeft,
            color: "sage",
            page: "assets?status=Available",
          },
          {
            name: "Verification due",
            value: due,
            detail: "Physical checks need attention",
            icon: ClipboardCheck,
            color: "amber",
            page: "assets?status=Verification%20due",
          },
        ].map((metric) => (
          <button
            className="metric-card"
            key={metric.name}
            onClick={() => navigate(metric.page)}
          >
            <div>
              <span>{metric.name}</span>
              <span className={`metric-icon ${metric.color}`}>
                <metric.icon size={19} strokeWidth={1.6} />
              </span>
            </div>
            <strong>{metric.value.toString().padStart(2, "0")}</strong>
            <p>{metric.detail}</p>
            <ArrowUpRight className="metric-arrow" size={17} />
          </button>
        ))}
      </div>
      <div className="dashboard-top">
        <section className="verification-feature">
          <div className="feature-heading">
            <span className="feature-icon">
              <ScanLine size={22} />
            </span>
            <span>Physical verification</span>
            <Badge tone="light">
              {audit ? "In progress" : "Ready to start"}
            </Badge>
          </div>
          <h2>{audit ? audit.name : "Start a physical verification"}</h2>
          <p>
            {audit
              ? `${total - verified} assets still to check at ${state.locations.find((location) => location.id === audit.locationId)?.branch}`
              : "Choose a location and account for its devices."}
          </p>
          <div className="feature-progress">
            <div>
              <strong>
                {verified}
                <span> / {total} assets verified</span>
              </strong>
              <span>{percent}%</span>
            </div>
            <div className="progress-track">
              <span style={{ width: `${percent}%` }} />
            </div>
          </div>
          <div className="feature-bottom">
            <span>
              {audit ? (
                <>
                  <Clock3 size={14} />
                  Due {dateLabel(audit.dueAt)}
                </>
              ) : (
                <>
                  <ShieldCheck size={15} />
                  Record who checked each asset
                </>
              )}
            </span>
            <button onClick={() => navigate("verification")}>
              {audit ? "Continue verification" : "Start verification"}
              <ArrowRight size={17} />
            </button>
          </div>
        </section>
        <Panel
          title="Needs attention"
          description="A short list to stay on top of."
          action={<span className="count-pill">{due + issues + repairs}</span>}
        >
          <div className="attention-list">
            {[
              {
                label: "Verification overdue",
                count: due,
                sub: "Devices awaiting a physical check",
                icon: ClipboardCheck,
                color: "amber",
                page: "assets?status=Verification%20due",
              },
              {
                label: "Open discrepancies",
                count: issues,
                sub: "Resolve a location or custody mismatch",
                icon: CircleAlert,
                color: "red",
                page: "issues",
              },
              {
                label: "Service follow-up",
                count: repairs,
                sub: "Devices awaiting or receiving service",
                icon: Wrench,
                color: "blue",
                page: "maintenance",
              },
            ].map((item) => (
              <button key={item.label} onClick={() => navigate(item.page)}>
                <span className={`attention-icon ${item.color}`}>
                  <item.icon size={19} />
                </span>
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.sub}</small>
                </span>
                <b>{String(item.count).padStart(2, "0")}</b>
                <ChevronRight size={15} />
              </button>
            ))}
          </div>
          <button
            className="attention-footer"
            onClick={() => navigate("reports")}
          >
            View inventory reports
            <ArrowUpRight size={16} />
          </button>
        </Panel>
      </div>
      <div className="dashboard-bottom">
        <Panel
          title="Your asset register"
          description="Open a device to review custody and verification."
          action={
            <TextLink onClick={() => navigate("assets")}>
              View all assets
            </TextLink>
          }
        >
          <div className="tabs dashboard-tabs">
            {["All assets", "Assigned", "Available"].map((value) => (
              <button
                key={value}
                className={assetTab === value ? "active" : ""}
                onClick={() => setAssetTab(value)}
              >
                {value}
              </button>
            ))}
          </div>
          <AssetTable
            assets={assets
              .filter(
                (asset) =>
                  assetTab === "All assets" || asset.status === assetTab,
              )
              .slice(0, 5)}
            onOpen={onOpen}
            compact
          />
        </Panel>
        <div className="dashboard-side">
          <Panel title="Asset mix" action={<Box size={18} className="muted" />}>
            <div className="mix-chart">
              <div
                className="donut"
                role="img"
                aria-label={categories
                  .map((item) => `${item.name}: ${item.count}`)
                  .join(", ")}
                style={{
                  background: `conic-gradient(${segments.join(", ") || "#e7eeea 0% 100%"})`,
                }}
              >
                <div>
                  <strong>{assets.length}</strong>
                  <span>total assets</span>
                </div>
              </div>
            </div>
            <div className="chart-legend">
              {categories.map((item, index) => (
                <div key={item.name}>
                  <span>
                    <i style={{ background: colors[index] }} />
                    {item.name === "Other"
                      ? "Other equipment"
                      : `${item.name}s`}
                  </span>
                  <strong>{item.count}</strong>
                </div>
              ))}
            </div>
          </Panel>
          <div className="warranty-note">
            <span className="warranty-icon">
              <ShieldCheck size={21} />
            </span>
            <div>
              <strong>Warranty watch</strong>
              <p>
                {
                  assets.filter(
                    (asset) =>
                      asset.warranty &&
                      asset.warranty >= today() &&
                      asset.warranty <= relativeDay(60),
                  ).length
                }{" "}
                warranties expire in the next 60 days.
              </p>
              <button
                className="text-link"
                onClick={() => navigate("reports?report=warranty")}
              >
                Review warranties
                <ArrowUpRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
      <Panel
        title="Recent activity"
        action={
          <TextLink onClick={() => navigate("activity")}>All activity</TextLink>
        }
      >
        <div className="activity-strip">
          {state.activity.slice(0, 3).map((entry) => (
            <div key={entry.id}>
              <span className="activity-icon">
                <Check size={16} />
              </span>
              <div>
                <strong>{entry.action}</strong>
                <p>{entry.subject}</p>
                <small>
                  {dateLabel(entry.date)} / {entry.officer}
                </small>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </>
  );
}
