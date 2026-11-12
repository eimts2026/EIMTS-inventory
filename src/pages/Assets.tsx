import { useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Plus,
  QrCode,
  Upload,
} from "lucide-react";
import type { Asset, AssetStatus } from "../model";
import { dateLabel, verificationDue } from "../model";
import { useInventory } from "../store";
import type { AssetDialog } from "../components/AssetDialogs";
import { categories } from "../components/AssetDialogs";
import {
  Badge,
  Empty,
  IconForAsset,
  PageHeading,
  SearchField,
} from "../components/ui";
import { exportCsv } from "../lib/files";

export function AssetTable({
  assets,
  onOpen,
  compact = false,
}: {
  assets: Asset[];
  onOpen: (dialog: AssetDialog) => void;
  compact?: boolean;
}) {
  const { state } = useInventory();
  if (!assets.length)
    return (
      <Empty
        title="No matching assets"
        description="Try a different search or register a new asset."
      />
    );
  return (
    <div className="table-scroll">
      <table className="asset-table">
        <thead>
          <tr>
            <th>Asset</th>
            <th>Status</th>
            <th>Custodian</th>
            {!compact && <th>Location</th>}
            <th>Verification</th>
            <th>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {assets.map((asset) => {
            const person = state.people.find(
              (item) => item.id === asset.personId,
            );
            const location = state.locations.find(
              (item) => item.id === asset.locationId,
            );
            return (
              <tr key={asset.id}>
                <td>
                  <button
                    className="asset-cell"
                    onClick={() => onOpen({ kind: "details", id: asset.id })}
                  >
                    <span
                      className={`device-icon ${asset.category.toLowerCase()}`}
                    >
                      <IconForAsset category={asset.category} />
                    </span>
                    <span>
                      <strong>{asset.name}</strong>
                      <small>{asset.tag}</small>
                    </span>
                  </button>
                </td>
                <td>
                  <Badge>{asset.status}</Badge>
                </td>
                <td>
                  {person ? (
                    <div className="person-cell">
                      <span className="avatar tiny">
                        {person.name
                          .split(" ")
                          .map((word) => word[0])
                          .slice(0, 2)
                          .join("")}
                      </span>
                      <span>{person.name}</span>
                    </div>
                  ) : (
                    <span className="muted">IT stock</span>
                  )}
                </td>
                {!compact && (
                  <td>
                    {location?.branch}
                    <small className="cell-secondary">{location?.name}</small>
                  </td>
                )}
                <td>
                  {asset.status === "Retired" ? (
                    <span className="muted">Archived</span>
                  ) : verificationDue(asset) ? (
                    <span className="due-text">
                      <i />
                      Overdue
                    </span>
                  ) : (
                    <span className="muted">
                      {dateLabel(asset.nextVerification)}
                    </span>
                  )}
                </td>
                <td>
                  <button
                    className="icon-button"
                    aria-label={`View ${asset.tag}`}
                    onClick={() => onOpen({ kind: "details", id: asset.id })}
                  >
                    <ArrowUpRight size={17} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function Assets({
  onOpen,
  initialSearch = "",
  initialStatus = "All assets",
}: {
  onOpen: (dialog: AssetDialog) => void;
  initialSearch?: string;
  initialStatus?: string;
}) {
  const { state } = useInventory();
  const [search, setSearch] = useState(initialSearch);
  const [status, setStatus] = useState(
    [
      "All assets",
      "Assigned",
      "Available",
      "Needs service",
      "In repair",
      "Retired",
      "Verification due",
    ].includes(initialStatus)
      ? initialStatus
      : "All assets",
  );
  const [category, setCategory] = useState("All categories");
  const [locationId, setLocationId] = useState("");
  const [page, setPage] = useState(1);
  const filtered = state.assets.filter(
    (asset) =>
      `${asset.name} ${asset.tag} ${asset.serial} ${state.people.find((person) => person.id === asset.personId)?.name || ""}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (status === "All assets" ||
        asset.status === status ||
        (status === "Verification due" && verificationDue(asset))) &&
      (category === "All categories" || asset.category === category) &&
      (!locationId || asset.locationId === locationId),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 8));
  const currentPage = Math.min(page, pages);
  function exportAssets() {
    exportCsv(
      "eimts-assets.csv",
      filtered.map((asset) => ({
        tag: asset.tag,
        name: asset.name,
        serial: asset.serial,
        category: asset.category,
        status: asset.status,
        custodian:
          state.people.find((person) => person.id === asset.personId)?.name ||
          "",
        branch:
          state.locations.find((location) => location.id === asset.locationId)
            ?.branch || "",
        condition: asset.condition,
        purchased: asset.purchased,
        warranty: asset.warranty,
        cost_lkr: asset.cost,
        next_verification: asset.nextVerification,
      })),
    );
  }
  const statuses: ("All assets" | AssetStatus | "Verification due")[] = [
    "All assets",
    "Assigned",
    "Available",
    "Needs service",
    "In repair",
    "Retired",
    "Verification due",
  ];
  return (
    <>
      <PageHeading
        title="Asset register"
        description="Every device, its custodian, and its complete history."
      >
        <button
          className="button secondary"
          onClick={() => onOpen({ kind: "import" })}
        >
          <Upload size={16} />
          Import CSV
        </button>
        <button
          className="button primary"
          onClick={() => onOpen({ kind: "asset" })}
        >
          <Plus size={17} />
          Add asset
        </button>
      </PageHeading>
      <section className="panel">
        <div className="tabs register-tabs">
          {statuses.map((value) => (
            <button
              className={status === value ? "active" : ""}
              key={value}
              onClick={() => {
                setStatus(value);
                setPage(1);
              }}
            >
              {value}
              <span>
                {
                  state.assets.filter(
                    (asset) =>
                      value === "All assets" ||
                      asset.status === value ||
                      (value === "Verification due" && verificationDue(asset)),
                  ).length
                }
              </span>
            </button>
          ))}
        </div>
        <div className="table-toolbar">
          <SearchField
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            placeholder="Search name, tag, serial, or custodian…"
          />
          <select
            aria-label="Filter by category"
            value={category}
            onChange={(event) => {
              setCategory(event.target.value);
              setPage(1);
            }}
          >
            <option>All categories</option>
            {categories.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
          <select
            aria-label="Filter by location"
            value={locationId}
            onChange={(event) => {
              setLocationId(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All locations</option>
            {state.locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.branch} / {location.name}
              </option>
            ))}
          </select>
          <button
            className="icon-button outlined"
            aria-label="Export filtered assets"
            onClick={exportAssets}
          >
            <ArrowDownToLine size={17} />
          </button>
          <button
            className="icon-button outlined"
            disabled={!filtered.length}
            aria-label="Print labels for filtered assets"
            onClick={() =>
              onOpen({
                kind: "paper",
                document: "labels",
                ids: filtered.map((asset) => asset.id),
              })
            }
          >
            <QrCode size={17} />
          </button>
        </div>
        <AssetTable
          assets={filtered.slice((currentPage - 1) * 8, currentPage * 8)}
          onOpen={onOpen}
        />
        <div className="table-footer">
          <span>
            {filtered.length
              ? `${(currentPage - 1) * 8 + 1}–${Math.min(currentPage * 8, filtered.length)}`
              : "0"}{" "}
            of {filtered.length} assets
          </span>
          <div>
            <button
              className="icon-button outlined"
              aria-label="Previous page"
              disabled={currentPage <= 1}
              onClick={() => setPage(currentPage - 1)}
            >
              <ChevronLeft size={17} />
            </button>
            <span>
              Page {currentPage} of {pages}
            </span>
            <button
              className="icon-button outlined"
              aria-label="Next page"
              disabled={currentPage >= pages}
              onClick={() => setPage(currentPage + 1)}
            >
              <ChevronRight size={17} />
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
