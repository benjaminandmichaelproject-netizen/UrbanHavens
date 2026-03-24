import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Favcard from "../../components/FavCard/Favcard";
import "../Dashboard.css";
import { refreshAccessToken, clearAuth } from "../../utils/auth";

const Favorites = () => {
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchFavorites = useCallback(async () => {
    let token = localStorage.getItem("access");

    if (!token) {
      setLoading(false);
      navigate("/login");
      return;
    }

    try {
      setLoading(true);
      setError("");

      let res = await fetch("/api/favorites/", {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Token expired — try to refresh
      if (res.status === 401) {
        token = await refreshAccessToken();

        if (!token) {
          clearAuth();
          navigate("/login");
          return;
        }

        // Retry with new token
        res = await fetch("/api/favorites/", {
          headers: { Authorization: `Bearer ${token}` },
        });
      }

      if (!res.ok) throw new Error("Failed to fetch favorites.");

      const data = await res.json();
      setFavorites(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Failed to load favorites.");
      setFavorites([]);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  const handleRemoveFavorite = async (propertyId) => {
    let token = localStorage.getItem("access");

    if (!token) {
      navigate("/login");
      return;
    }

    try {
      let res = await fetch(`/api/favorites/remove/${propertyId}/`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      // Token expired — try to refresh
      if (res.status === 401) {
        token = await refreshAccessToken();

        if (!token) {
          clearAuth();
          navigate("/login");
          return;
        }

        // Retry with new token
        res = await fetch(`/api/favorites/remove/${propertyId}/`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
      }

      if (!res.ok) throw new Error("Failed to remove favorite.");

      setFavorites((prev) =>
        prev.filter((item) => item.property?.id !== propertyId)
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleViewProperty = (property) => {
    navigate(`/detail/${property.id}`, { state: { property } });
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
              onRemove={() => handleRemoveFavorite(item.property.id)}
              onView={() => handleViewProperty(item.property)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default Favorites;