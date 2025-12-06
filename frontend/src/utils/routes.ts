import { createBrowserRouter } from "react-router";
import { Layout } from "../components/Layout";
import { Overview } from "../components/pages/Overview";
import { Payments } from "../components/pages/Payments";
import { Balances } from "../components/pages/Balances";
import { Analytics } from "../components/pages/Analytics";
import { Devices } from "../components/pages/Devices";
import { Settings } from "../components/pages/Settings";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: Overview },
      { path: "payments", Component: Payments },
      { path: "balances", Component: Balances },
      { path: "analytics", Component: Analytics },
      { path: "devices", Component: Devices },
      { path: "settings", Component: Settings },
    ],
  },
]);
