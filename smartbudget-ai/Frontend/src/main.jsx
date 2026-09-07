import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App";
import AuthContextProvider from "./context/AuthContext";

import "./styles/variables.css";
import "./styles/reset.css";
import "./styles/typography.css";
import "./styles/globals.css";


createRoot(document.getElementById("root")).render(

  <StrictMode>

    <BrowserRouter>

      <AuthContextProvider>

        <App />

      </AuthContextProvider>

    </BrowserRouter>

  </StrictMode>

);