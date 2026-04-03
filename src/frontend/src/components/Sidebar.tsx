import {
  LayoutDashboard,
  Package,
  Settings,
  UserCog,
  Users,
  X,
} from "lucide-react";
import type { NavTab, Screen } from "../App";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  navigate: (s: Screen) => void;
  activeTab: NavTab;
}

const NAV_ITEMS: {
  label: string;
  tab: NavTab;
  icon: React.ReactNode;
  screen: Screen;
}[] = [
  {
    label: "Dashboard",
    tab: "dashboard",
    icon: <LayoutDashboard size={20} />,
    screen: { id: "dashboard" },
  },
  {
    label: "Udhar",
    tab: "udhar",
    icon: <Users size={20} />,
    screen: { id: "udhar" },
  },
  {
    label: "Products",
    tab: "products",
    icon: <Package size={20} />,
    screen: { id: "products" },
  },
  {
    label: "Customers",
    tab: "customers",
    icon: <UserCog size={20} />,
    screen: { id: "customers" },
  },
  {
    label: "Settings",
    tab: "settings",
    icon: <Settings size={20} />,
    screen: { id: "settings" },
  },
];

export function Sidebar({
  isOpen,
  onClose,
  navigate,
  activeTab,
}: SidebarProps) {
  const handleNav = (screen: Screen) => {
    navigate(screen);
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <button
        type="button"
        className="fixed inset-0 z-50 bg-black/50 transition-opacity duration-300 cursor-default"
        style={{
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? "auto" : "none",
        }}
        onClick={onClose}
        aria-label="Close menu"
        tabIndex={isOpen ? 0 : -1}
      />

      {/* Drawer */}
      <div
        data-ocid="sidebar.panel"
        className="fixed top-0 left-0 h-full w-72 z-[60] flex flex-col shadow-2xl bg-background"
        style={{
          transform: isOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 300ms cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        {/* Sidebar header */}
        <div className="app-header px-5 pt-12 pb-5 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-white text-lg font-bold tracking-tight">
              Credit Shop
            </h2>
            <p className="text-white/50 text-xs mt-0.5">Shop management</p>
          </div>
          <button
            type="button"
            data-ocid="sidebar.close_button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20"
            aria-label="Close menu"
          >
            <X size={16} />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.label}
              type="button"
              data-ocid={`sidebar.${item.label.toLowerCase()}.link`}
              onClick={() => handleNav(item.screen)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors min-h-[48px] ${
                activeTab === item.tab
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">
            © {new Date().getFullYear()}{" "}
            <a
              href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground"
            >
              caffeine.ai
            </a>
          </p>
        </div>
      </div>
    </>
  );
}
