import { useEffect, useState } from "react";
import {
  Activity as ActivityIcon,
  ArrowRight,
  Bell,
  Box,
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  HelpCircle,
  LayoutDashboard,
  Menu,
  PackageOpen,
  Search,
  Settings as SettingsIcon,
  ShieldCheck,
  Users,
  UsersRound,
  Wrench,
  X,
} from "lucide-react";
import { useInventory } from "./store";
import { verificationDue } from "./model";
import { AssetDialogs } from "./components/AssetDialogs";
import type { AssetDialog } from "./components/AssetDialogs";
import { Modal } from "./components/ui";
import { Dashboard } from "./pages/Dashboard";
import { Assets } from "./pages/Assets";
import { Custody } from "./pages/Custody";
import { Verification } from "./pages/Verification";
import { Issues, Maintenance } from "./pages/Operations";
import { Consumables } from "./pages/Consumables";
import { Organisation } from "./pages/Organisation";
import { Reports } from "./pages/Reports";
import { Settings } from "./pages/Settings";
import { Activity } from "./pages/Activity";

const navigation = [
  {
    group: "Workspace",
    links: [
      { id: "overview", name: "Overview", icon: LayoutDashboard },
      { id: "assets", name: "Asset register", icon: Box },
      { id: "custody", name: "Custody & handovers", icon: UsersRound },
      { id: "verification", name: "Verification", icon: ClipboardCheck },
    ],
  },
  {
    group: "Operations",
    links: [
      { id: "issues", name: "Discrepancies", icon: CircleAlert },
      { id: "maintenance", name: "Maintenance", icon: Wrench },
      { id: "consumables", name: "Consumables", icon: PackageOpen },
    ],
  },
  {
    group: "Organisation",
    links: [
      { id: "organisation", name: "People & locations", icon: Users },
      { id: "reports", name: "Reports", icon: ActivityIcon },
      { id: "activity", name: "Activity log", icon: ActivityIcon },
    ],
  },
];
const titles = Object.fromEntries(
  navigation.flatMap((group) =>
    group.links.map((link) => [link.id, link.name]),
  ),
);
titles.settings = "Settings";
function getRoute() {
  const route = window.location.hash.slice(1);
  return route.split("?")[0] in titles ? route : "overview";
}

export default function Workspace({ onLogout }: { onLogout: () => void }) {
  const { state, notice, storageError } = useInventory();
  const [route, setRoute] = useState(getRoute);
  const page = route.split("?")[0];
  const parameters = new URLSearchParams(route.split("?")[1] || "");
  const [dialog, setDialog] = useState<AssetDialog | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(
    () => window.matchMedia("(max-width: 850px)").matches,
  );
  const [notifications, setNotifications] = useState(false);
  const [profile, setProfile] = useState(false);
  const [help, setHelp] = useState(false);
  const [search, setSearch] = useState("");
  const due = state.assets.filter(verificationDue).length;
  const openIssues = state.issues.filter(
    (item) => item.status === "Open",
  ).length;
  const activeAudit = state.audits.find((item) => !item.closedAt);
  const verified =
    activeAudit?.observations.filter((item) => item.verifiedAt).length || 0;
  const auditTotal = activeAudit?.observations.length || 0;
  useEffect(() => {
    const query = window.matchMedia("(max-width: 850px)");
    const update = () => {
      setIsMobile(query.matches);
      setMobileOpen(false);
    };
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    const update = () => {
      setRoute(getRoute());
      setDialog(null);
    };
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  useEffect(() => {
    document.title = `${titles[page]} · EIMTS Inventory`;
    setMobileOpen(false);
    setNotifications(false);
    setProfile(false);
    window.scrollTo(0, 0);
    document
      .querySelector<HTMLElement>("main h1")
      ?.focus({ preventScroll: true });
  }, [page]);
  function navigate(target: string) {
    window.location.hash = target;
    setRoute(target);
    setMobileOpen(false);
    setNotifications(false);
    setProfile(false);
  }
  const onOpen = (value: AssetDialog) => setDialog(value);
  return (
    <>
      <div className="app-shell">
        {mobileOpen && (
          <button
            className="sidebar-backdrop"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
          />
        )}
        <aside
          className={`sidebar ${mobileOpen ? "open" : ""}`}
          aria-label="Main navigation"
          aria-hidden={isMobile && !mobileOpen}
          inert={isMobile && !mobileOpen}
          onKeyDown={(event) => {
            if (event.key === "Escape") setMobileOpen(false);
          }}
        >
          <a
            className="brand"
            href="#overview"
            onClick={() => setMobileOpen(false)}
          >
            <span className="brand-mark">
              <Box size={26} strokeWidth={1.5} />
            </span>
            <span>
              <strong>
                EIMTS<span>Inventory</span>
              </strong>
              <small>IT asset management</small>
            </span>
          </a>
          <button
            className="mobile-close icon-button"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
          >
            <X size={21} />
          </button>
          <div className="workspace-switch">
            <span className="workspace-symbol">
              <ShieldCheck size={17} />
            </span>
            <span>
              IT department<small>Internal workspace</small>
            </span>
            <ChevronDown size={14} />
          </div>
          <nav>
            {navigation.map((group) => (
              <div className="nav-group" key={group.group}>
                <span className="nav-group-title">{group.group}</span>
                {group.links.map((link) => (
                  <a
                    key={link.id}
                    className={page === link.id ? "active" : ""}
                    href={`#${link.id}`}
                    onClick={() => setMobileOpen(false)}
                    aria-current={page === link.id ? "page" : undefined}
                  >
                    <link.icon size={18} strokeWidth={1.7} />
                    <span>{link.name}</span>
                    {link.id === "verification" && due > 0 && (
                      <b className="nav-count">{due}</b>
                    )}
                    {link.id === "issues" && openIssues > 0 && (
                      <b className="nav-count warning">{openIssues}</b>
                    )}
                  </a>
                ))}
              </div>
            ))}
          </nav>
          <div className="sidebar-bottom">
            {activeAudit && (
              <button
                className="sidebar-audit"
                onClick={() => navigate("verification")}
              >
                <div>
                  <span className="live-dot" />
                  Verification in progress
                  <ChevronRight size={14} />
                </div>
                <strong>
                  {verified} of {auditTotal} assets checked
                </strong>
                <div className="progress-track">
                  <span
                    style={{
                      width: `${(verified / (auditTotal || 1)) * 100}%`,
                    }}
                  />
                </div>
              </button>
            )}
            <a
              className={`settings-link ${page === "settings" ? "active" : ""}`}
              href="#settings"
            >
              <SettingsIcon size={18} />
              Settings
            </a>
            <div className="sidebar-profile">
              <span className="avatar profile">IT</span>
              <span>
                <strong>IT Administrator</strong>
                <small>Workspace admin</small>
              </span>
              <ShieldCheck size={16} />
            </div>
          </div>
        </aside>
        <div className="workspace-main" inert={isMobile && mobileOpen}>
          <header className="topbar">
            <div className="breadcrumb">
              <button
                className="icon-button mobile-menu"
                aria-label="Open navigation"
                aria-expanded={mobileOpen}
                onClick={() => setMobileOpen(true)}
              >
                <Menu size={22} />
              </button>
              <span>Workspace</span>
              <ChevronRight size={13} />
              <strong>{titles[page]}</strong>
            </div>
            <div className="topbar-actions">
              <form
                className="global-search"
                onSubmit={(event) => {
                  event.preventDefault();
                  navigate(
                    `assets?search=${encodeURIComponent(search.trim())}`,
                  );
                }}
              >
                <Search size={17} />
                <input
                  aria-label="Search all assets"
                  placeholder="Find an asset…"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
                <kbd>↵</kbd>
              </form>
              <button
                className="icon-button help-button"
                aria-label="About this preview"
                onClick={() => setHelp(true)}
              >
                <HelpCircle size={19} />
              </button>
              <div className="popover-anchor">
                <button
                  className="icon-button notification-button"
                  aria-label="View attention items"
                  aria-expanded={notifications}
                  onClick={() => {
                    setNotifications((value) => !value);
                    setProfile(false);
                  }}
                >
                  <Bell size={20} />
                  {due + openIssues > 0 && <i />}
                </button>
                {notifications && (
                  <div className="popover">
                    <strong>Needs your attention</strong>
                    <button onClick={() => navigate("verification")}>
                      <ClipboardCheck size={18} />
                      <span>{due} verifications due</span>
                      <ChevronRight size={15} />
                    </button>
                    <button onClick={() => navigate("issues")}>
                      <CircleAlert size={18} />
                      <span>{openIssues} open discrepancies</span>
                      <ChevronRight size={15} />
                    </button>
                  </div>
                )}
              </div>
              <div className="topbar-divider" />
              <div className="popover-anchor">
                <button
                  className="avatar topbar-avatar"
                  aria-label="IT administrator profile"
                  aria-expanded={profile}
                  onClick={() => {
                    setProfile((value) => !value);
                    setNotifications(false);
                  }}
                >
                  IT
                </button>
                {profile && (
                  <div className="popover">
                    <strong>IT Administrator</strong>
                    <p>Sample IT Admin account</p>
                    <button onClick={onLogout}>Sign out</button>
                    <button onClick={() => navigate("settings")}>
                      <SettingsIcon size={17} />
                      Workspace settings
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>
          <div className="preview-banner">
            <span>
              <i />
              Frontend preview
              <span className="preview-detail">
                Records saved in this browser
              </span>
            </span>
            <button onClick={() => setHelp(true)}>
              About this workspace
              <ChevronRight size={13} />
            </button>
          </div>
          {storageError && (
            <p className="storage-error" role="alert">
              {storageError}
            </p>
          )}
          <main id="main-content" key={route}>
            {page === "overview" && (
              <Dashboard onOpen={onOpen} navigate={navigate} />
            )}
            {page === "assets" && (
              <Assets
                onOpen={onOpen}
                initialSearch={parameters.get("search") || ""}
                initialStatus={parameters.get("status") || "All assets"}
              />
            )}
            {page === "custody" && <Custody onOpen={onOpen} />}
            {page === "verification" && <Verification onOpen={onOpen} />}
            {page === "issues" && <Issues onOpen={onOpen} />}
            {page === "maintenance" && <Maintenance onOpen={onOpen} />}
            {page === "consumables" && <Consumables />}
            {page === "organisation" && <Organisation />}
            {page === "reports" && (
              <Reports initialReport={parameters.get("report") || "custody"} />
            )}
            {page === "activity" && <Activity />}
            {page === "settings" && <Settings />}
          </main>
        </div>
      </div>
      {dialog && (
        <AssetDialogs
          key={`${dialog.kind}-${"id" in dialog ? dialog.id : ""}`}
          dialog={dialog}
          onClose={() => setDialog(null)}
          onOpen={onOpen}
        />
      )}
      {help && (
        <Modal title="Your frontend workspace" onClose={() => setHelp(false)}>
          <div className="modal-body">
            <p>
              This workspace starts empty. Add branches, locations, and people
              before registering assets. Changes are saved on this device.
            </p>
            <div className="help-steps">
              <p>
                <Box size={19} />
                <span>
                  Register an asset, assign it, and print its handover.
                </span>
              </p>
              <p>
                <ClipboardCheck size={19} />
                <span>
                  Start verification, enter a tag, and check its physical
                  serial.
                </span>
              </p>
              <p>
                <CircleAlert size={19} />
                <span>
                  Resolve discrepancies and follow maintenance and stock.
                </span>
              </p>
            </div>
            <div className="info-note">
              Shared records, IT authentication, MFA, enforced permissions, and
              scheduled backups are part of the database integration step.
            </div>
            <p>
              Paper forms are tracked by reference number and filing location.
              Vercel is the intended deployment target.
            </p>
          </div>
          <div className="form-actions">
            <button className="button primary" onClick={() => setHelp(false)}>
              Explore workspace
              <ArrowRight size={16} />
            </button>
          </div>
        </Modal>
      )}
      {notice && (
        <div className="toast" role="status">
          <span>
            <Check size={16} />
          </span>
          {notice}
        </div>
      )}
    </>
  );
}
