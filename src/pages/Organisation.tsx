import { Select } from "../components/Select";
import { useState } from "react";
import type { FormEvent } from "react";
import { Building2, MapPin, Pencil, Plus, Users } from "lucide-react";
import type { Location, Person } from "../model";
import { uid } from "../model";
import { useInventory } from "../store";
import {
  Empty,
  ErrorMessage,
  Field,
  FormActions,
  Modal,
  PageHeading,
  Panel,
  SearchField,
} from "../components/ui";

export function Organisation() {
  const { state, commit } = useInventory();
  const [tab, setTab] = useState("People");
  const [search, setSearch] = useState("");
  const [person, setPerson] = useState<Person | null>(null);
  const [location, setLocation] = useState<Location | null>(null);
  const [error, setError] = useState("");
  const people = state.people.filter((item) =>
    `${item.name} ${item.employeeId} ${item.department}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  function savePerson(event: FormEvent) {
    event.preventDefault();
    if (
      !person ||
      !person.name.trim() ||
      !person.employeeId.trim() ||
      !person.department.trim()
    )
      return setError("Enter a name, employee ID, and department.");
    if (
      state.people.some(
        (item) =>
          item.id !== person.id &&
          item.employeeId.toLowerCase() ===
            person.employeeId.trim().toLowerCase(),
      )
    )
      return setError("This employee ID is already registered.");
    const clean = {
      ...person,
      name: person.name.trim(),
      employeeId: person.employeeId.trim(),
      department: person.department.trim(),
    };
    commit("Employee record saved", clean.name, (draft) => {
      const index = draft.people.findIndex((item) => item.id === clean.id);
      if (index < 0) draft.people.push(clean);
      else draft.people[index] = clean;
    });
    setPerson(null);
  }
  function saveLocation(event: FormEvent) {
    event.preventDefault();
    if (!location || !location.name.trim() || !location.branch.trim())
      return setError("Enter the branch and room or office name.");
    if (
      state.locations.some(
        (item) =>
          item.id !== location.id &&
          `${item.branch}/${item.name}`.toLowerCase() ===
            `${location.branch.trim()}/${location.name.trim()}`.toLowerCase(),
      )
    )
      return setError("This branch and location already exist.");
    const clean = {
      ...location,
      name: location.name.trim(),
      branch: location.branch.trim(),
    };
    commit("Location saved", `${clean.branch} / ${clean.name}`, (draft) => {
      const index = draft.locations.findIndex((item) => item.id === clean.id);
      if (index < 0) draft.locations.push(clean);
      else draft.locations[index] = clean;
    });
    setLocation(null);
  }
  return (
    <>
      <PageHeading
        title="People & locations"
        description="Keep custodian and location records ready for every assignment."
      >
        <button
          className="button primary"
          onClick={() => {
            setError("");
            if (tab === "People")
              setPerson({
                id: uid(),
                name: "",
                employeeId: "",
                department: "",
                locationId: state.locations[0]?.id || "",
              });
            else setLocation({ id: uid(), name: "", branch: "" });
          }}
        >
          <Plus size={17} />
          {tab === "People" ? "Add employee" : "Add location"}
        </button>
      </PageHeading>
      <div className="info-note">
        <Users size={19} />
        <span>
          Employees are recorded as custodians. System access is managed
          separately for the IT department.
        </span>
      </div>
      <section className="panel">
        <div className="tabs">
          {["People", "Locations"].map((value) => (
            <button
              key={value}
              className={tab === value ? "active" : ""}
              onClick={() => {
                setTab(value);
                setSearch("");
              }}
            >
              {value}
              <span>
                {value === "People"
                  ? state.people.length
                  : state.locations.length}
              </span>
            </button>
          ))}
        </div>
        {tab === "People" ? (
          <>
            <div className="table-toolbar">
              <SearchField
                value={search}
                onChange={setSearch}
                placeholder="Search name, employee ID, or department…"
              />
            </div>
            {people.length ? (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Department</th>
                      <th>Office</th>
                      <th>Assigned assets</th>
                      <th>
                        <span className="sr-only">Edit</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {people.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <div className="person-cell">
                            <span className="avatar">
                              {item.name
                                .split(" ")
                                .map((word) => word[0])
                                .slice(0, 2)
                                .join("")}
                            </span>
                            <span>
                              <strong>{item.name}</strong>
                              <small className="cell-secondary">
                                {item.employeeId}
                              </small>
                            </span>
                          </div>
                        </td>
                        <td>{item.department}</td>
                        <td>
                          {
                            state.locations.find(
                              (location) => location.id === item.locationId,
                            )?.branch
                          }
                        </td>
                        <td>
                          {
                            state.assets.filter(
                              (asset) => asset.personId === item.id,
                            ).length
                          }
                        </td>
                        <td>
                          <button
                            className="icon-button"
                            aria-label={`Edit ${item.name}`}
                            onClick={() => {
                              setPerson(item);
                              setError("");
                            }}
                          >
                            <Pencil size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty
                title="No employees found"
                description="Add a custodian or adjust the search."
              />
            )}
          </>
        ) : (
          <div className="location-grid">
            {state.locations.map((item) => (
              <Panel
                key={item.id}
                title={item.branch}
                description={item.name}
                action={
                  <button
                    className="icon-button"
                    aria-label={`Edit ${item.branch} ${item.name}`}
                    onClick={() => {
                      setLocation(item);
                      setError("");
                    }}
                  >
                    <Pencil size={16} />
                  </button>
                }
              >
                <div className="location-stat">
                  <span>
                    <Building2 size={18} />
                    {
                      state.assets.filter(
                        (asset) => asset.locationId === item.id,
                      ).length
                    }{" "}
                    assets
                  </span>
                  <span>
                    <MapPin size={18} />
                    {
                      state.people.filter(
                        (person) => person.locationId === item.id,
                      ).length
                    }{" "}
                    people
                  </span>
                </div>
              </Panel>
            ))}
          </div>
        )}
      </section>
      {person && (
        <Modal title="Employee record" onClose={() => setPerson(null)}>
          <form onSubmit={savePerson}>
            <div className="form-grid">
              <Field label="Full name" full>
                <input
                  required
                  maxLength={100}
                  value={person.name}
                  onChange={(event) =>
                    setPerson({ ...person, name: event.target.value })
                  }
                />
              </Field>
              <Field label="Employee ID">
                <input
                  required
                  maxLength={40}
                  value={person.employeeId}
                  onChange={(event) =>
                    setPerson({ ...person, employeeId: event.target.value })
                  }
                />
              </Field>
              <Field label="Department">
                <input
                  required
                  maxLength={80}
                  value={person.department}
                  onChange={(event) =>
                    setPerson({ ...person, department: event.target.value })
                  }
                />
              </Field>
              <Field label="Office" full>
                <Select
                  required
                  value={person.locationId}
                  onValueChange={(event) =>
                    setPerson({ ...person, locationId: event })
                  }
                >
                  {state.locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.branch} / {location.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <ErrorMessage error={error} />
            <FormActions
              onClose={() => setPerson(null)}
              label="Save employee"
            />
          </form>
        </Modal>
      )}
      {location && (
        <Modal title="Location record" onClose={() => setLocation(null)}>
          <form onSubmit={saveLocation}>
            <div className="form-grid">
              <Field label="Branch" full>
                <input
                  required
                  maxLength={80}
                  value={location.branch}
                  onChange={(event) =>
                    setLocation({ ...location, branch: event.target.value })
                  }
                  placeholder="e.g. Colombo"
                />
              </Field>
              <Field label="Room or office" full>
                <input
                  required
                  maxLength={80}
                  value={location.name}
                  onChange={(event) =>
                    setLocation({ ...location, name: event.target.value })
                  }
                  placeholder="e.g. First floor / IT room"
                />
              </Field>
            </div>
            <ErrorMessage error={error} />
            <FormActions
              onClose={() => setLocation(null)}
              label="Save location"
            />
          </form>
        </Modal>
      )}
    </>
  );
}
