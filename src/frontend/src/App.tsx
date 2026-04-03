import { Toaster } from "@/components/ui/sonner";
import { useState } from "react";
import type { CustomerBalance } from "./backend.d";
import { BatchUdhaarScreen } from "./components/BatchUdhaarScreen";
import { CustomerProfile } from "./components/CustomerProfile";
import { CustomersScreen } from "./components/CustomersScreen";
import { DashboardScreen } from "./components/DashboardScreen";
import { HomeScreen } from "./components/HomeScreen";
import { ProductsScreen } from "./components/ProductsScreen";
import { SettingsScreen } from "./components/SettingsScreen";
import { Sidebar } from "./components/Sidebar";
import { TransactionHistory } from "./components/TransactionHistory";

export type Screen =
  | { id: "dashboard" }
  | { id: "udhar" }
  | { id: "home" } // legacy alias -> udhar
  | { id: "customers" }
  | { id: "customerProfile"; customer: CustomerBalance }
  | { id: "transactionHistory"; customer: CustomerBalance }
  | { id: "batchUdhaar"; customer: CustomerBalance }
  | { id: "products" }
  | { id: "settings" };

export type NavTab =
  | "dashboard"
  | "udhar"
  | "customers"
  | "products"
  | "settings";

export default function App() {
  const [screen, setScreen] = useState<Screen>({ id: "dashboard" });
  const [activeTab, setActiveTab] = useState<NavTab>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navigate = (s: Screen) => {
    if (s.id === "dashboard") setActiveTab("dashboard");
    else if (s.id === "udhar" || s.id === "home") setActiveTab("udhar");
    else if (s.id === "customers") setActiveTab("customers");
    else if (s.id === "products") setActiveTab("products");
    else if (s.id === "settings") setActiveTab("settings");
    setScreen(s);
  };

  const goHome = () => navigate({ id: "udhar" });

  const isUdhar = screen.id === "udhar" || screen.id === "home";

  return (
    <div
      className="flex flex-col h-full max-w-[480px] mx-auto bg-background"
      style={{ position: "relative", overflow: "hidden" }}
    >
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        navigate={navigate}
        activeTab={activeTab}
      />

      <main className="flex-1 overflow-hidden flex flex-col">
        {screen.id === "dashboard" && (
          <DashboardScreen
            navigate={navigate}
            onOpenSidebar={() => setSidebarOpen(true)}
          />
        )}
        {isUdhar && (
          <HomeScreen
            navigate={navigate}
            onOpenSidebar={() => setSidebarOpen(true)}
          />
        )}
        {screen.id === "customers" && (
          <CustomersScreen
            navigate={navigate}
            onOpenSidebar={() => setSidebarOpen(true)}
          />
        )}
        {screen.id === "customerProfile" && (
          <CustomerProfile
            customerBalance={screen.customer}
            navigate={navigate}
            onBack={goHome}
          />
        )}
        {screen.id === "transactionHistory" && (
          <TransactionHistory
            customerBalance={screen.customer}
            onBack={() =>
              navigate({ id: "customerProfile", customer: screen.customer })
            }
          />
        )}
        {screen.id === "batchUdhaar" && (
          <BatchUdhaarScreen
            customerId={screen.customer.customer.id}
            customerName={screen.customer.customer.name}
            customerMobile={screen.customer.customer.mobile}
            onClose={() =>
              navigate({ id: "customerProfile", customer: screen.customer })
            }
            onSaved={() =>
              navigate({ id: "customerProfile", customer: screen.customer })
            }
          />
        )}
        {screen.id === "products" && (
          <ProductsScreen
            navigate={navigate}
            onOpenSidebar={() => setSidebarOpen(true)}
          />
        )}
        {screen.id === "settings" && (
          <SettingsScreen
            navigate={navigate}
            onOpenSidebar={() => setSidebarOpen(true)}
          />
        )}
      </main>

      <Toaster position="bottom-center" />
    </div>
  );
}
