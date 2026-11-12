import { useState } from "react";
import type { FormEvent } from "react";
import { ArrowDownLeft, ArrowUpRight, Box, History, Plus } from "lucide-react";
import type { Stock } from "../model";
import { dateLabel, now, uid } from "../model";
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

export function Consumables() {
  const { state, commit } = useInventory();
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [moving, setMoving] = useState<Stock | null>(null);
  const [history, setHistory] = useState<Stock | null>(null);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("item");
  const [quantity, setQuantity] = useState(0);
  const [minimum, setMinimum] = useState(5);
  const [direction, setDirection] = useState("Receive");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  function create(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || !unit.trim())
      return setError("Enter an item name and unit.");
    if (
      state.stock.some(
        (item) => item.name.toLowerCase() === name.trim().toLowerCase(),
      )
    )
      return setError(
        "This item is already tracked. Receive stock against its existing record.",
      );
    const item: Stock = {
      id: uid(),
      name: name.trim(),
      unit: unit.trim(),
      quantity,
      minimum,
      movements: quantity
        ? [{ id: uid(), date: now(), quantity, note: "Opening stock" }]
        : [],
    };
    commit("Consumable added", item.name, (draft) => {
      draft.stock.push(item);
    });
    setCreating(false);
    setName("");
  }
  function move(event: FormEvent) {
    event.preventDefault();
    if (!moving || !note.trim())
      return setError("Record the recipient or receipt reference.");
    if (!Number.isInteger(quantity) || quantity <= 0)
      return setError("Enter a whole quantity above zero.");
    if (direction === "Issue" && quantity > moving.quantity)
      return setError("The issue quantity exceeds stock on hand.");
    const movement = {
      id: uid(),
      date: now(),
      quantity: direction === "Issue" ? -quantity : quantity,
      note: note.trim(),
    };
    commit(
      direction === "Issue" ? "Consumable issued" : "Consumable received",
      `${moving.name} · ${quantity} ${moving.unit} · ${note.trim()}`,
      (draft) => {
        const item = draft.stock.find((item) => item.id === moving.id)!;
        item.quantity += movement.quantity;
        item.movements.unshift(movement);
      },
    );
    setMoving(null);
  }
  const filtered = state.stock.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        title="Consumables"
        description="Know what is on the shelf and when to replenish it."
      >
        <button
          className="button primary"
          onClick={() => {
            setCreating(true);
            setQuantity(0);
            setError("");
          }}
        >
          <Plus size={17} />
          Add item
        </button>
      </PageHeading>
      <div className="summary-strip">
        <div>
          <strong>{state.stock.length}</strong>
          <span>Stock items</span>
        </div>
        <div>
          <strong>
            {state.stock.filter((item) => item.quantity <= item.minimum).length}
          </strong>
          <span>At or below reorder level</span>
        </div>
        <div>
          <strong>
            {state.stock.reduce((sum, item) => sum + item.movements.length, 0)}
          </strong>
          <span>Recorded stock movements</span>
        </div>
      </div>
      <section className="panel">
        <div className="table-toolbar">
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder="Search consumables…"
          />
        </div>
        {filtered.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>On hand</th>
                  <th>Reorder level</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="asset-cell">
                        <span className="device-icon">
                          <Box size={20} />
                        </span>
                        <strong>{item.name}</strong>
                      </div>
                    </td>
                    <td>
                      <strong>{item.quantity}</strong>
                      <small className="cell-secondary">
                        {item.unit}
                        {item.quantity !== 1 ? "s" : ""}
                      </small>
                    </td>
                    <td>{item.minimum}</td>
                    <td>
                      <Badge>
                        {item.quantity <= item.minimum
                          ? "Low stock"
                          : "Available"}
                      </Badge>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="button secondary small"
                          onClick={() => {
                            setMoving(item);
                            setDirection("Receive");
                            setQuantity(1);
                            setNote("");
                            setError("");
                          }}
                        >
                          <ArrowDownLeft size={15} />
                          Receive
                        </button>
                        <button
                          className="button secondary small"
                          disabled={!item.quantity}
                          onClick={() => {
                            setMoving(item);
                            setDirection("Issue");
                            setQuantity(1);
                            setNote("");
                            setError("");
                          }}
                        >
                          <ArrowUpRight size={15} />
                          Issue
                        </button>
                        <button
                          className="icon-button"
                          aria-label={`View history for ${item.name}`}
                          onClick={() => setHistory(item)}
                        >
                          <History size={17} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="No stock items found"
            description="Add an item or adjust your search."
          />
        )}
      </section>
      {creating && (
        <Modal title="Add a consumable" onClose={() => setCreating(false)}>
          <form onSubmit={create}>
            <div className="form-grid">
              <Field label="Item name" full>
                <input
                  required
                  maxLength={100}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </Field>
              <Field label="Unit">
                <input
                  required
                  maxLength={30}
                  value={unit}
                  onChange={(event) => setUnit(event.target.value)}
                />
              </Field>
              <Field label="Opening quantity">
                <input
                  required
                  type="number"
                  min="0"
                  step="1"
                  value={quantity}
                  onChange={(event) => setQuantity(Number(event.target.value))}
                />
              </Field>
              <Field label="Reorder level">
                <input
                  required
                  type="number"
                  min="0"
                  step="1"
                  value={minimum}
                  onChange={(event) => setMinimum(Number(event.target.value))}
                />
              </Field>
            </div>
            <ErrorMessage error={error} />
            <FormActions
              onClose={() => setCreating(false)}
              label="Add consumable"
            />
          </form>
        </Modal>
      )}
      {moving && (
        <Modal
          title={`${direction} stock`}
          description={`${moving.name} · ${moving.quantity} ${moving.unit}s on hand`}
          onClose={() => setMoving(null)}
        >
          <form onSubmit={move}>
            <div className="form-grid">
              <Field label="Quantity" full>
                <input
                  required
                  type="number"
                  min="1"
                  step="1"
                  max={direction === "Issue" ? moving.quantity : undefined}
                  value={quantity}
                  onChange={(event) => setQuantity(Number(event.target.value))}
                />
              </Field>
              <Field
                label={
                  direction === "Issue"
                    ? "Recipient / department / paper reference"
                    : "Supplier / receipt reference"
                }
                full
              >
                <input
                  required
                  maxLength={200}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
              </Field>
            </div>
            <ErrorMessage error={error} />
            <FormActions
              onClose={() => setMoving(null)}
              label={`${direction} stock`}
            />
          </form>
        </Modal>
      )}
      {history && (
        <Modal
          title="Stock movement history"
          description={history.name}
          onClose={() => setHistory(null)}
        >
          <div className="modal-body">
            {history.movements.length ? (
              <div className="timeline">
                {history.movements.map((item) => (
                  <div key={item.id}>
                    <span className="timeline-dot" />
                    <strong>
                      {item.quantity > 0 ? "+" : ""}
                      {item.quantity} {history.unit}s
                    </strong>
                    <p>{item.note}</p>
                    <small>{dateLabel(item.date)}</small>
                  </div>
                ))}
              </div>
            ) : (
              <Empty
                title="Opening balance only"
                description="Future receipts and issues will appear here."
              />
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
