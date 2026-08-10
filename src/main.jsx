import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "./AppLayout";
import Clients from "./pages/Clients";
import Chrono from "./pages/Chrono";
import Saisie from "./pages/Saisie";
import Rapports from "./pages/Rapports";
import Factures from "./pages/Factures";
import Parametres from "./pages/Parametres";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<AppLayout />}>
        <Route index element={<Navigate to="/chrono" replace />} />
        <Route path="chrono" element={<Chrono />} />
        <Route path="saisie" element={<Saisie />} />
        <Route path="clients" element={<Clients />} />
        <Route path="rapports" element={<Rapports />} />
        <Route path="factures" element={<Factures />} />
        <Route path="parametres" element={<Parametres />} />
      </Route>
    </Routes>
  </BrowserRouter>
);
