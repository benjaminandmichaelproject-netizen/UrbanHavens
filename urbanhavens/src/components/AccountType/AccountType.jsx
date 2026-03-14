// AccountTypeCard.jsx
import "./AccountType.css";

const AccountTypeCard = ({ title, description, selected, onSelect }) => {
  return (
    <div
      className={`account-type account-card ${selected ? "active" : ""}`} // added account-type class
      onClick={onSelect}
    >
      <input type="radio" checked={selected} readOnly />
      <h3>{title}</h3>
      <div className="account-box">
        <p>{description}</p>
      </div>
    </div>
  );
};

export default AccountTypeCard;