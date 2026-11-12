import { useState } from "react";
import { ArrowDownToLine, Check } from "lucide-react";
import { useInventory } from "../store";
import { dateLabel } from "../model";
import { exportCsv } from "../lib/files";
import { Empty, PageHeading, SearchField } from "../components/ui";

export function Activity() {
  const { state } = useInventory();
  const [search, setSearch] = useState("");
  const filtered = state.activity.filter((item) =>
    `${item.action} ${item.subject} ${item.officer}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        title="Activity log"
        description="A chronological record of changes in this workspace."
      >
        <button
          className="button secondary"
          onClick={() =>
            exportCsv(
              "eimts-activity.csv",
              filtered.map((item) => ({
                Timestamp: item.date,
                Action: item.action,
                Details: item.subject,
                Officer: item.officer,
              })),
            )
          }
        >
          <ArrowDownToLine size={17} />
          Export activity
        </button>
      </PageHeading>
      <section className="panel">
        <div className="table-toolbar">
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder="Search action, asset tag, or officer…"
          />
        </div>
        {filtered.length ? (
          <div className="activity-list">
            {filtered.map((item) => (
              <article key={item.id}>
                <span className="activity-icon">
                  <Check size={16} />
                </span>
                <div>
                  <strong>{item.action}</strong>
                  <p>{item.subject}</p>
                  <small>
                    {item.officer} / {dateLabel(item.date)}
                    {item.date.includes("T")
                      ? `, ${new Date(item.date).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Colombo" })}`
                      : ""}
                  </small>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <Empty
            title="No matching activity"
            description="Try an asset tag or another search term."
          />
        )}
      </section>
    </>
  );
}
