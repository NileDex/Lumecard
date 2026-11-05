import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "./index.css";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import CreateGift from "./pages/gift/CreateGift";
import TokenPage from "./pages/TokenPage";
import ClaimGift from "./pages/ClaimGift";
import { DepositProvider } from "./components/DepositModal";
import { WithdrawProvider } from "./components/WithdrawModal";
import { ConnectWalletProvider } from "./components/ConnectWallet";
import { AuthProvider } from "./auth/AuthProvider";
import { RequireAuth } from "./auth/RequireAuth";
import { BalanceProvider } from "./chain/Balances";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
       <BalanceProvider>
        <DepositProvider>
         <WithdrawProvider>
          <ConnectWalletProvider>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/app" element={<RequireAuth><Dashboard /></RequireAuth>} />
              <Route path="/app/token/:id" element={<RequireAuth><TokenPage /></RequireAuth>} />
              <Route path="/app/gifts/create" element={<RequireAuth><CreateGift /></RequireAuth>} />
              {/* Claim page stays public: recipients sign in from there */}
              <Route path="/g/:id" element={<ClaimGift />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </ConnectWalletProvider>
         </WithdrawProvider>
        </DepositProvider>
       </BalanceProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
