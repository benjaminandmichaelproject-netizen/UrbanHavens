# UrbanHavens


# 🏠 UrbanHavens

UrbanHavens is a modern property rental web application built with **React**.
The platform allows users to browse rental properties, review tenancy agreements, and proceed through a structured booking flow.

---

## 🚀 Features

### 🧭 Dynamic Routing

* Built using **React Router DOM**
* Supports dynamic property routes:

  * `/`
  * `/terms/:id`
  * `/details/:id`
* Enables property-specific agreement and detail pages

---

### 🖼️ Hero Section with Image Slider

* Fullscreen responsive hero section
* Automatic fade transition slider
* Gradient overlay for readability
* Call-to-action button
* Fully responsive layout

---

### 🏘️ Featured Rentals Section

* Dynamic rental data rendering
* Reusable `RentalCard` component
* Responsive grid layout
* Property preview including:

  * Image
  * Title
  * Beds & Bath
  * Monthly price
  * Book Now button

---

### 📜 Tenancy Agreement System

#### Agreement Modal

* Opens when user clicks **Book Now**
* Displays summary of key terms & conditions
* Shows selected property name
* Includes:

  * Decline button (closes modal)
  * Accept & Continue button
  * Link to detailed agreement page

#### Detailed Terms Page (`/terms/:id`)

* Displays property-specific agreement
* Structured legal-style format
* Continue to Book button
* Navigates to property details page

---

### 🏡 Property Details Page

* Dynamic page based on property ID
* Prepares system for backend/API integration
* Final stage before booking process

---

### 📱 Responsive Design

* Fully responsive across devices
* Mobile-friendly modal behavior
* Responsive hero section
* Adaptive rental grid layout

---

## 🛠️ Tech Stack

* **React**
* **React Router DOM**
* **Vite**
* **CSS3**
* **JavaScript (ES6+)**

---

## 📁 Project Structure

```text
src/
│
├── Components/
│   ├── Navbar/
│   ├── Hero/
│   ├── AboutSection/
│   ├── FeaturedRentals/
│   ├── RentalCard/
│   └── AgreementModal/
│
├── Pages/
│   ├── Home.jsx
│   ├── TermsPage.jsx
│   ├── DetailsPage.jsx
│   ├── Login.jsx
│   └── Register.jsx
│
├── assets/
│   └── images/
│
├── App.jsx
├── main.jsx
└── App.css
```

---

## 🔁 Application Flow

1. User visits Home page.
2. User browses featured rentals.
3. User clicks **Book Now**.
4. Agreement Modal appears.
5. User can:

   * Decline → Close modal
   * View detailed agreement → `/terms/:id`
6. User clicks **Continue to Book**.
7. User is redirected to property details page.

---

## 🧠 Architectural Approach

* Component-based architecture
* Reusable UI components
* Separation of concerns (Components vs Pages)
* URL-driven dynamic content
* Scalable structure for future backend integration

---

## 🔮 Future Enhancements

* Backend integration (API-driven property data)
* Authentication & protected routes
* Booking management system
* Payment integration
* Property search & filtering
* Admin dashboard
* State management with Context API or Redux

---

## 📌 Installation

Clone the repository:

```bash
git clone https://github.com/your-username/urbanhavens.git
```

Install dependencies:

```bash
npm install
```

Run development server:

```bash
npm run dev
```

---

