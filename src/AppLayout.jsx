import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import { ChronoProvider } from "./ChronoContext";
import "./AppLayout.css";

export default function AppLayout() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    async function checkUpdate() {
      try {
        const { check } = await import("@tauri-apps/plugin-updater");
        const update = await check();
        if (update?.available) setUpdateAvailable(true);
      } catch {
        // En dev ou si le serveur est inaccessible, on ignore silencieusement
      }
    }
    checkUpdate();
  }, []);

  async function installUpdate() {
    try {
      setUpdating(true);
      const { check } = await import("@tauri-apps/plugin-updater");
      const { relaunch } = await import("@tauri-apps/plugin-process");
      const update = await check();
      if (update?.available) {
        await update.downloadAndInstall();
        await relaunch();
      }
    } catch (e) {
      console.error(e);
      setUpdating(false);
    }
  }

  return (
    <ChronoProvider>
      <div className="app-layout">
        <Sidebar />
        <main className="app-main">
          {updateAvailable && (
            <div className="app-update-banner">
              <span>Nouvelle version disponible !</span>
              <button onClick={installUpdate} disabled={updating}>
                {updating ? "Mise à jour…" : "Mettre à jour"}
              </button>
            </div>
          )}
          <Outlet />
        </main>
      </div>
    </ChronoProvider>
  );
}
