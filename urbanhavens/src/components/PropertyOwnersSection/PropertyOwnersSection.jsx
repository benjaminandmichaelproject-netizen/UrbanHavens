import React from "react";
import "./PropertyOwnersSection.css";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBuilding, faChartLine, faCheck } from "@fortawesome/free-solid-svg-icons";

const PropertyOwnersSection = () => {
  return (
    <div className="PropertyOwnersSection">
      <div className="heading">
        <h2>For Property Owners</h2>
        <p>List and manage your properties with our comprehensive platform</p>
      </div>

      <div className="listproperties">

        {/* card 1 */}
        <div className="prop">
          <h3>
            <FontAwesomeIcon icon={faBuilding} /> List Your Properties
          </h3>

          <p className="text-prop">
            Reach thousands of potential tenants by listing your properties
            on our premium platform.
          </p>

          <ul className="prop-list">
            <li><FontAwesomeIcon icon={faCheck} /> Professional listing presentation</li>
            <li><FontAwesomeIcon icon={faCheck} /> Advanced tenant screening tools</li>
            <li><FontAwesomeIcon icon={faCheck} /> Automated lease management</li>
          </ul>

          <button className="list-btn">List Your Property</button>
        </div>

        {/* card 2 */}
        <div className="prop">
          <h3>
            <FontAwesomeIcon icon={faChartLine} /> Maximize Your Property's Value
          </h3>

          <p className="text-prop">
            Our platform helps you showcase your properties in the best light,
            attracting more tenants and increasing your rental income.
          </p>

          <ul className="prop-list">
            <li><FontAwesomeIcon icon={faCheck} /> High-quality property photos</li>
            <li><FontAwesomeIcon icon={faCheck} /> Detailed property descriptions</li>
            <li><FontAwesomeIcon icon={faCheck} /> 24/7 customer support</li>
          </ul>
        </div>

      </div>
    </div>
  );
};

export default PropertyOwnersSection;