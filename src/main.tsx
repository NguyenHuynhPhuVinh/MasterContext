import React, { Suspense } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./i18n"; // Import the i18n configuration

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {/* Wrap with Suspense for async language loading */}
    <Suspense fallback="Loading...">
      <App />
    </Suspense>
  </React.StrictMode>
);
