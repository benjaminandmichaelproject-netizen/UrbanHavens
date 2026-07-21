import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import Favcard from "../../components/FavCard/Favcard";
import {
  api,
  clearAuthStorage,
} from "../Owner/UploadDetails/api/api";

import "../Dashboard.css";

const Favorites = () => {
  const navigate = useNavigate();

  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Load the authenticated user's favorite properties.
  const fetchFavorites = useCallback(async () => {
    const token =
      localStorage.getItem("access") ||
      localStorage.getItem("token");

    if (!token) {
      setLoading(false);
      navigate("/login");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await api.get("/favorites/");
      const data = response.data;

      const results = Array.isArray(data)
        ? data
        : data.results || [];

      setFavorites(results);
    } catch (err) {
      console.error(
        "Failed to fetch favorites:",
        err.response?.data || err.message
      );

      if (err.response?.status === 401) {
        clearAuthStorage();
        navigate("/login");
        return;
      }

      setError(
        err.response?.data?.detail ||
          err.message ||
          "Failed to load favorites."
      );

      setFavorites([]);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  // Remove one property from the user's favorites.
  const handleRemoveFavorite = async (propertyId) => {
    try {
      await api.delete(`/favorites/remove/${propertyId}/`);

      setFavorites((previousFavorites) =>
        previousFavorites.filter(
          (item) => item.property?.id !== propertyId
        )
      );
    } catch (err) {
      console.error(
        "Failed to remove favorite:",
        err.response?.data || err.message
      );

      if (err.response?.status === 401) {
        clearAuthStorage();
        navigate("/login");
        return;
      }

      setError(
        err.response?.data?.detail ||
          err.message ||
          "Failed to remove favorite."
      );
    }
  };

  const handleViewProperty = (property) => {
    navigate(`/detail/${property.id}`, {
      state: { property },
    });
  };

  return (
    <div className="dashboard-page">
      <div className="dashboard-page-header">
        <h2>My Favorites</h2>
        <p>Properties you saved for later</p>
      </div>

      {loading && (
        <div className="dashboard-empty-state">
          <p>Loading favorite properties...</p>
        </div>
      )}

      {!loading && error && (
        <div className="dashboard-empty-state">
          <p>{error}</p>
        </div>
      )}

      {!loading && !error && favorites.length === 0 && (
        <div className="dashboard-empty-state">
          <p>No favorite properties yet.</p>
        </div>
      )}

      {!loading && !error && favorites.length > 0 && (
        <div className="favorite-grid">
          {favorites.map((item) => (
            <Favcard
              key={item.id}
              favorite={item}
              onRemove={() =>
                handleRemoveFavorite(item.property.id)
              }
              onView={() =>
                handleViewProperty(item.property)
              }
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default Favorites;