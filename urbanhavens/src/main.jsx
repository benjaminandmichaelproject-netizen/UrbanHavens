import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { FavoritesProvider } from "./components/Context/FavoritesContext";
import { NotificationProvider } from "./context/NotificationContext";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <FavoritesProvider>
        <NotificationProvider>
          <App />
        </NotificationProvider>
      </FavoritesProvider>
    </BrowserRouter>
  </React.StrictMode>
);