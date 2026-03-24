import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Favcard from "../../components/FavCard/Favcard";
import "./FavoritePage.css";

const FavoritePage = () => {
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchFavorites = useCallback(async () => {
    const token = localStorage.getItem("access");

    if (!token) {
      setLoading(false);
      navigate("/login");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const res = await fetch("/api/favorites/", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.status === 401) {
        localStorage.removeItem("access");
        localStorage.removeItem("refresh");
        navigate("/login");
        return;
      }

      if (!res.ok) {
        throw new Error("Failed to fetch favorites.");
      }

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
    const token = localStorage.getItem("access");

    if (!token) {
      navigate("/login");
      return;
    }

    try {
      const res = await fetch(`/api/favorites/remove/${propertyId}/`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.status === 401) {
        localStorage.removeItem("access");
        localStorage.removeItem("refresh");
        navigate("/login");
        return;
      }

      if (!res.ok) {
        throw new Error("Failed to remove favorite.");
      }

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

  if (loading) {
    return (
      <div className="favorite-page">
        <div className="favorite-page-state">Loading favorites...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="favorite-page">
        <div className="favorite-page-state favorite-page-error">{error}</div>
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
        <div className="favorite-page-state">No favorite properties yet.</div>
      ) : (
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

export default FavoritePage;