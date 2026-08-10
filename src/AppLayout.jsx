import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import { ChronoProvider } from "./ChronoContext";
import "./AppLayout.css";

export default function AppLayout() {
  return (
    <ChronoProvider>
      <div className="app-layout">
        <Sidebar />
        <main className="app-main">
          <Outlet />
        </main>
      </div>
    </ChronoProvider>
  );
}
