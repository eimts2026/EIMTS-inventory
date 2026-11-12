import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Printer } from "lucide-react";
import type { Handover } from "../model";
import { currency, dateLabel, today } from "../model";
import { useInventory } from "../store";
import { Modal } from "./ui";
import type { AssetDialog } from "./AssetDialogs";

export function AssetQr({ tag }: { tag: string }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let active = true;
    void QRCode.toDataURL(tag, { margin: 1, width: 180 }).then((value) => {
      if (active) setUrl(value);
    });
    return () => {
      active = false;
    };
  }, [tag]);
  return url ? (
    <img src={url} width="106" height="106" alt={`QR code for ${tag}`} />
  ) : (
    <span className="qr-placeholder" />
  );
}

export function PaperPreview({
  dialog,
  onClose,
}: {
  dialog: Extract<AssetDialog, { kind: "paper" }>;
  onClose: () => void;
}) {
  const { state } = useInventory();
  const assets = state.assets.filter((asset) => dialog.ids.includes(asset.id));
  const handover: Handover | undefined = state.handovers.find(
    (item) => item.id === dialog.handoverId,
  );
  return (
    <Modal
      title={
        dialog.document === "labels"
          ? "Print asset labels"
          : dialog.document === "handover"
            ? "Print handover form"
            : "Print asset record"
      }
      description="Print and file the signed document with your department records."
      onClose={onClose}
      wide
    >
      <div className="print-sheet">
        <div className="paper-heading">
          <strong>{state.settings.organisation} Inventory</strong>
          <span>{dateLabel(today())}</span>
        </div>
        {dialog.document === "labels" ? (
          <div className="label-grid">
            {assets.map((asset) => (
              <div className="asset-label" key={asset.id}>
                <AssetQr tag={asset.tag} />
                <strong>{asset.tag}</strong>
                <small>{asset.name}</small>
              </div>
            ))}
          </div>
        ) : (
          assets.map((asset) => (
            <div key={asset.id}>
              <h2>
                {dialog.document === "handover"
                  ? "Asset handover acknowledgement"
                  : "Asset record"}
              </h2>
              <div className="paper-asset">
                <div>
                  <h3>{asset.name}</h3>
                  <p>{asset.tag}</p>
                </div>
                <AssetQr tag={asset.tag} />
              </div>
              <dl className="detail-grid">
                {[
                  ["Serial number", asset.serial],
                  ["Condition", handover?.condition || asset.condition],
                  [
                    "Employee",
                    state.people.find(
                      (person) =>
                        person.id ===
                        (handover ? handover.personId : asset.personId),
                    )?.name || "IT stock",
                  ],
                  [
                    "Location",
                    state.locations.find(
                      (location) =>
                        location.id ===
                        (handover?.locationId || asset.locationId),
                    )?.branch || "",
                  ],
                  ...(handover
                    ? [
                        ["Form reference", handover.reference],
                        [
                          "Filing location",
                          handover.filing || "________________",
                        ],
                        ["Issued on", dateLabel(handover.issuedAt)],
                        ["Expected return", dateLabel(handover.dueAt)],
                        [
                          "Accessories",
                          handover.accessories || "________________",
                        ],
                      ]
                    : [
                        ["Status", asset.status],
                        ["Category", asset.category],
                        ["Purchased", dateLabel(asset.purchased)],
                        ["Purchase cost", currency(asset.cost)],
                        ["Warranty expires", dateLabel(asset.warranty)],
                        ["Last verified", dateLabel(asset.lastVerified)],
                        [
                          "Next verification",
                          dateLabel(asset.nextVerification),
                        ],
                      ]),
                ].map(([key, value]) => (
                  <div key={key}>
                    <dt>{key}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              {dialog.document === "handover" && (
                <>
                  <p className="paper-statement">
                    I acknowledge receipt of the asset and accessories listed
                    above in the recorded condition.
                  </p>
                  <div className="signature-lines">
                    <span>Recipient signature / date</span>
                    <span>IT officer signature / date</span>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
      <div className="form-actions">
        <button className="button secondary" onClick={onClose}>
          Close
        </button>
        <button className="button primary" onClick={() => window.print()}>
          <Printer size={16} />
          Print
        </button>
      </div>
    </Modal>
  );
}
