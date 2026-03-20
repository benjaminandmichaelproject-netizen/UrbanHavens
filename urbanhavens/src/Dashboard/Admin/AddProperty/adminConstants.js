// Admin default form data

export const ADMIN_DEFAULT_FORM_DATA = {
  // 👇 NEW STEP (VERY IMPORTANT)
  owner_source: {
    owner_mode: "existing", // "existing" or "external"

    // existing owner
    owner_user_id: "",

    // external landlord
    external_full_name: "",
    external_phone: "",
    external_email: "",
    external_business_name: "",
    external_document_type: "",
    external_id_number: "",
  },

  // 👇 reuse your existing structure
  property: {
    property_name: "",
    category: "",
    property_type: "",
    bedrooms: "",
    bathrooms: "",
    price: "",
    description: "",
    amenities: [],
    is_available: true,
  },

  property_location: {
    region: "",
    city: "",
    school: "",
    lat: "",
    lng: "",
  },
};


// Admin default files
export const ADMIN_DEFAULT_FILES = {
  owner_source: {
    external_document_file: null, // 👈 ID document
  },

  property_images: {
    property_images: [],
  },
};