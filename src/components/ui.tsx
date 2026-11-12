import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import {
  ArrowUpRight,
  Box,
  Check,
  Laptop,
  Monitor,
  Network,
  Printer,
  Search,
  X,
} from "lucide-react";
import type { Category } from "../model";
import { useInventory } from "../store";

export function IconForAsset({
  category,
  size = 21,
}: {
  category: Category;
  size?: number;
}) {
  const Icon = {
    Laptop,
    Desktop: Monitor,
    Monitor,
    Printer,
    Network,
    Other: Box,
  }[category];
  return <Icon size={size} strokeWidth={1.7} />;
}
export function Badge({
  children,
  tone = "",
}: {
  children: ReactNode;
  tone?: string;
}) {
  const label = typeof children === "string" ? children : "";
  const derived = [
    "Assigned",
    "Good",
    "Resolved",
    "Completed",
    "Recorded",
  ].includes(label)
    ? "green"
    : ["Available", "In progress"].includes(label)
      ? "blue"
      : [
            "In repair",
            "Needs service",
            "Fair",
            "Pending",
            "Open",
            "Low stock",
          ].includes(label)
        ? "amber"
        : ["Damaged", "Overdue", "Missing"].includes(label)
          ? "red"
          : "gray";
  return (
    <span className={`badge ${tone || derived}`}>
      <i />
      {children}
    </span>
  );
}
export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <Box size={32} strokeWidth={1.3} />
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function PageHeading({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <h1 tabIndex={-1}>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="heading-actions">{children}</div>
    </div>
  );
}
export function Panel({
  title,
  description,
  action,
  children,
  className = "",
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <header className="panel-header">
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}
export function SearchField({
  value,
  onChange,
  placeholder = "Search assets…",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="search-field">
      <Search size={17} />
      <input
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {value && (
        <button aria-label="Clear search" onClick={() => onChange("")}>
          <X size={15} />
        </button>
      )}
    </div>
  );
}
export function TextLink({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button className="text-link" onClick={onClick}>
      {children}
      <ArrowUpRight size={15} />
    </button>
  );
}
export function Modal({
  title,
  description,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    dialog?.showModal();
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = before;
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      className={`modal ${wide ? "wide" : ""}`}
      ref={ref}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      aria-labelledby="modal-title"
      aria-describedby={description ? "modal-description" : undefined}
    >
      <div className="modal-header">
        <div>
          <h2 id="modal-title">{title}</h2>
          {description && <p id="modal-description">{description}</p>}
        </div>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function FormActions({
  onClose,
  label = "Save changes",
  disabled = false,
}: {
  onClose: () => void;
  label?: string;
  disabled?: boolean;
}) {
  const { saving } = useInventory();
  return (
    <div className="form-actions">
      <button type="button" className="button secondary" onClick={onClose}>
        Cancel
      </button>
      <button
        className="button primary"
        type="submit"
        disabled={disabled || saving}
      >
        <Check size={16} />
        {label}
      </button>
    </div>
  );
}
export function Field({
  label,
  children,
  full = false,
}: {
  label: string;
  children: ReactNode;
  full?: boolean;
}) {
  return (
    <label className={`field ${full ? "full" : ""}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}
export function ErrorMessage({ error }: { error: string }) {
  const { storageError } = useInventory();
  const message = error || storageError;
  return message ? (
    <p className="form-error" role="alert">
      {message}
    </p>
  ) : null;
}
