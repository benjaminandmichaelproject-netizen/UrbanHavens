import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import Favcard from "../../components/FavCard/Favcard";
import { api, clearAuthStorage } from "../../Dashboard/Owner/UploadDetails/api/api";

import "./FavoritePage.css";

const FavoritePage = () => {
  const navigate = useNavigate();

  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Fetch the authenticated user's saved properties.
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

  // Remove a property from the user's favorites.
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

  if (loading) {
    return (
      <div className="favorite-page">
        <div className="favorite-page-state">
          Loading favorites...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="favorite-page">
        <div className="favorite-page-state favorite-page-error">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="favorite-page">
      <div className="favorite-page-header">
        <h2>My Favorites</h2>
        <p>Saved properties you want to revisit</p>
      </div>

      {favorites.length === 0 ? (
        <div className="favorite-page-state">
          No favorite properties yet.
        </div>
      ) : (
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

export default FavoritePage;