import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import PublicQuotePage from "./quote/PublicQuotePage.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <PublicQuotePage />
  </StrictMode>,
);
