import axios from "axios";

const API_BASE = `${import.meta.env.VITE_API_BASE_URL}/api`;

const api = axios.create({
  baseURL: API_BASE,
});

api.interceptors.request.use((config) => {
  const token =
    localStorage.getItem("access") ||
    localStorage.getItem("token");

  const invalidToken =
    !token ||
    token === "undefined" ||
    token === "null" ||
    token === "[object Object]";

  if (!invalidToken) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refresh = localStorage.getItem("refresh");

      if (!refresh || refresh === "undefined" || refresh === "null") {
        localStorage.removeItem("access");
        localStorage.removeItem("token");
        localStorage.removeItem("refresh");
        localStorage.removeItem("username");
        localStorage.removeItem("role");
        window.location.href = "/login";
        return Promise.reject(error);
      }

      try {
        const res = await axios.post(
          `${import.meta.env.VITE_API_BASE_URL}/api/users/token/refresh/`,
          { refresh }
        );

        const newAccess = res.data.access;
        localStorage.setItem("access", newAccess);
        localStorage.setItem("token", newAccess);
        originalRequest.headers.Authorization = `Bearer ${newAccess}`;
        return api(originalRequest);
      } catch (refreshError) {
        localStorage.removeItem("access");
        localStorage.removeItem("token");
        localStorage.removeItem("refresh");
        localStorage.removeItem("username");
        localStorage.removeItem("role");
        window.location.href = "/login";
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// ─── Exported helper ────────────────────────────────────────────────────────
// Use this before opening a WebSocket so you always connect with a fresh token
export const refreshAccessToken = async () => {
  const refresh = localStorage.getItem("refresh");

  if (!refresh || refresh === "undefined" || refresh === "null") {
    return null;
  }

  try {
    const res = await axios.post(
      `${import.meta.env.VITE_API_BASE_URL}/api/users/token/refresh/`,
      { refresh }
    );
    const newAccess = res.data.access;
    localStorage.setItem("access", newAccess);
    localStorage.setItem("token", newAccess);
    return newAccess;
  } catch {
    return null;
  }
};

// ─── Property APIs ───────────────────────────────────────────────────────────
export const uploadProperty = async (formData) => {
  try {
    const res = await api.post("/properties/", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  } catch (err) {
    console.error("Upload error:", err.response?.data || err.message);
    throw err.response?.data || err;
  }
};

export const getProperties = async () => {
  try {
    const res = await api.get("/properties/");
    return res.data;
  } catch (err) {
    console.error("Fetch properties error:", err.response?.data || err.message);
    throw err.response?.data || err;
  }
};

export const getMyProperties = async () => {
  try {
    const res = await api.get("/properties/my-properties/");
    const data = res.data;
    return Array.isArray(data) ? data : data.results ?? [];
  } catch (err) {
    console.error("Fetch my properties error:", err.response?.data || err.message);
    throw err.response?.data || err;
  }
};

export const getPropertyById = async (id) => {
  try {
    const res = await api.get(`/properties/${id}/`);
    return res.data;
  } catch (err) {
    console.error("Fetch property error:", err.response?.data || err.message);
    throw err.response?.data || err;
  }
};

export const updateProperty = async (id, formData) => {
  try {
    const res = await api.patch(`/properties/${id}/`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  } catch (err) {
    console.error("Update property error:", err.response?.data || err.message);
    throw err.response?.data || err;
  }
};

export const deleteProperty = async (id) => {
  try {
    const res = await api.delete(`/properties/${id}/`);
    return res.data;
  } catch (err) {
    console.error("Delete property error:", err.response?.data || err.message);
    throw err.response?.data || err;
  }
};

// ─── Booking APIs ────────────────────────────────────────────────────────────
export const createBooking = async (bookingData) => {
  try {
    const res = await api.post("/bookings/", bookingData);
    return res.data;
  } catch (err) {
    console.error("Create booking error:", err.response?.data || err.message);
    throw err.response?.data || err;
  }
};

export const getOwnerBookings = async () => {
  try {
    const res = await api.get("/bookings/my_owner_bookings/");
    return res.data;
  } catch (err) {
    console.error("Fetch owner bookings error:", err.response?.data || err.message);
    throw err.response?.data || err;
  }
};

export const getTenantBookings = async () => {
  try {
    const res = await api.get("/bookings/my_tenant_bookings/");
    return res.data;
  } catch (err) {
    console.error("Fetch tenant bookings error:", err.response?.data || err.message);
    throw err.response?.data || err;
  }
};

// ─── Notification APIs ───────────────────────────────────────────────────────
export const getNotifications = async () => {
  try {
    const res = await api.get("/notifications/");
    return res.data;
  } catch (err) {
    console.error("Fetch notifications error:", err.response?.data || err.message);
    throw err.response?.data || err;
  }
};

export const getUnreadNotificationCount = async () => {
  try {
    const res = await api.get("/notifications/unread_count/");
    return res.data;
  } catch (err) {
    console.error("Fetch unread count error:", err.response?.data || err.message);
    throw err.response?.data || err;
  }
};

export const markNotificationAsRead = async (id) => {
  try {
    const res = await api.post(`/notifications/${id}/mark_as_read/`);
    return res.data;
  } catch (err) {
    console.error("Mark notification as read error:", err.response?.data || err.message);
    throw err.response?.data || err;
  }
};

export const markAllNotificationsAsRead = async () => {
  try {
    const res = await api.post("/notifications/mark_all_as_read/");
    return res.data;
  } catch (err) {
    console.error("Mark all notifications as read error:", err.response?.data || err.message);
    throw err.response?.data || err;
  }
};

// ─── Lease APIs ──────────────────────────────────────────────────────────────
export const createTenantLease = async (leaseData) => {
  try {
    const res = await api.post("/leases/", leaseData);
    return res.data;
  } catch (err) {
    console.error("Create tenant lease error:", err.response?.data || err.message);
    throw err.response?.data || err;
  }
};

// ─── User APIs ───────────────────────────────────────────────────────────────
export const getOwners = async () => {
  try {
    const res = await api.get("/users/owners/");
    return res.data;
  } catch (err) {
    console.error("Fetch owners error:", err.response?.data || err.message);
    throw err.response?.data || err;
  }
};

export const toggleUserVerification = async (userId) => {
  const res = await api.post(`/users/${userId}/toggle-verification/`);
  return res.data;
};

export { api };