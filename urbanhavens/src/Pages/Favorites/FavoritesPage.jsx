import { useFavorites } from "../../components/Context/FavoritesContext";
import RentalCard from "../../components/FeaturedRentals/RentalCard";
import "./FavoritesPage.css";


const FavoritesPage = () => {
  const { favorites } = useFavorites();

  return (
    <div className="favorites-page">
      <h2>Your Favorite Properties</h2>

      {favorites.length === 0 ? (
        <div className="empty-state">
          <p>No favorite properties yet.</p>
        </div>
      ) : (
        <div className="favorites-grid">
          {favorites.map((rental) => (
            <RentalCard key={rental.id} rental={rental} />
          ))}
        </div>
      )}
    </div>
  );
};

export default FavoritesPage;