// PropertyListing/Data/Properties.jsx
export const properties = [
  { 
    id: 1, 
    title: "Luxury Apartment in Accra", 
    location: "Accra", 
    price: "₵ 2,000 / month", 
    type: "Apartment", 
    image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80",
    beds: 3,
    baths: 2,
    size: 1200,
    guests: 3,
    amenities: ["Wi-Fi", "Air Conditioning", "Parking", "Kitchen"],
    detailedImages: [
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1600585154341-be6161a56a0d?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1600585154342-be6161a56a0e?auto=format&fit=crop&w=800&q=80"
    ],
    landlord: {
      name: "Mr Benjamin Ohene Asare",
      title: "WEB DEVELOPER || GRAPHIC DESIGNER || DATABASE ADMIN.", // Added
      phone: "0541254645 || 0554823175", // Added
      profileLink: "/landlord/1",
      photo: "https://randomuser.me/api/portraits/men/1.jpg",
      coverPhoto: "https://images.unsplash.com/photo-1557683316-973673baf926" // Added
    }
  },
  { 
    id: 2, 
    title: "Single Room near University", 
    location: "Kumasi", 
    price: "₵ 600 / month", 
    type: "Single Room", 
    beds: 1,
    baths: 1,
    size: 300,
    guests: 1,
    amenities: ["Wi-Fi", "Kitchen"],
    detailedImages: [
      "https://images.unsplash.com/photo-1598928506310-1c3b4a1f97c5?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1598928506311-1c3b4a1f97c6?auto=format&fit=crop&w=800&q=80"
    ],
    landlord: {
      name: "Ms Ama K. Mensah",
      title: "REAL ESTATE AGENT || PROPERTY MANAGER", // Added
      phone: "0244123456", // Added
      profileLink: "/landlord/2",
      photo: "https://randomuser.me/api/portraits/women/2.jpg",
      coverPhoto: "https://images.unsplash.com/photo-1448630360428-65456885c650" // Added
    }
  },
];