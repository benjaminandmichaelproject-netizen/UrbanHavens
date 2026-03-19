import React from 'react';
import { Link } from 'react-router-dom';
import './owner.css';
import { FaHome } from 'react-icons/fa';

const Upload = () => {
  return (
    <div className="upload-container">
      <div className="upload-header">
        <h1>Your properties</h1>
        <p>View details of your listed properties</p>
      </div>

      <div className="upload-card-wrapper">
        {/* Updated path to match your App.jsx Route exactly */}
        <Link to="/dashboard/owner/UploadDetails/uploadpage" className="submit-property-card">
          <div className="icon-circle">
            <FaHome className="home-icon" />
          </div>
          <p>Submit a property</p>
        </Link>
      </div>
    </div>
  );
};

export default Upload;