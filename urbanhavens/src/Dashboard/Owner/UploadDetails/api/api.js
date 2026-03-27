import axios from "axios";

const API_BASE = "http://127.0.0.1:8000/api";
const REFRESH_URL = `${API_BASE}/users/token/refresh/`;

export const clearAuthStorage = () => {
  localStorage.removeItem("access");
  localStorage.removeItem("token");
  localStorage.removeItem("refresh");
  localStorage.removeItem("username");
  localStorage.removeItem("role");
  localStorage.removeItem("userId");
  localStorage.removeItem("phone");
  window.dispatchEvent(new Event("auth-changed"));
};

const getStoredAccessToken = () => {
  const token = localStorage.getItem("access") || localStorage.getItem("token");

  if (
    !token ||
    token === "undefined" ||
    token === "null" ||
    token === "[object Object]"
  ) {
    return null;
  }

  return token;
};

const getStoredRefreshToken = () => {
  const refresh = localStorage.getItem("refresh");

  if (!refresh || refresh === "undefined" || refresh === "null") {
    return null;
  }

  return refresh;
};

const redirectToLogin = () => {
  window.location.href = "/login";
};

const api = axios.create({
  baseURL: API_BASE,
});

api.interceptors.request.use((config) => {
  const token = getStoredAccessToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;

      const refresh = getStoredRefreshToken();

      if (!refresh) {
        clearAuthStorage();
        redirectToLogin();
        return Promise.reject(error);
      }

      try {
        const res = await axios.post(REFRESH_URL, { refresh });
        const newAccess = res.data.access;

        localStorage.setItem("access", newAccess);
        localStorage.setItem("token", newAccess);

        originalRequest.headers.Authorization = `Bearer ${newAccess}`;
        return api(originalRequest);
      } catch (refreshError) {
        clearAuthStorage();
        redirectToLogin();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// ─── Exported auth helper ────────────────────────────────────────────────────
export const refreshAccessToken = async () => {
  const refresh = getStoredRefreshToken();

  if (!refresh) {
    return null;
  }

  try {
    const res = await axios.post(REFRESH_URL, { refresh });
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
export const createBooking = async (bookingData, idempotencyKey) => {
  try {
    const config = {
      headers: {
        "Idempotency-Key": idempotencyKey,
      },
    };

    console.log("BOOKING CONFIG:", config);

    const res = await api({
      method: "post",
      url: "/bookings/",
      data: bookingData,
      ...config,
    });

    return res.data;
  } catch (err) {
    console.error("Create booking error:", err.response?.data || err.message);
    throw err;
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

export const rejectBooking = async (bookingId) => {
  try {
    const res = await api.post(`/bookings/${bookingId}/reject/`);
    return res.data;
  } catch (err) {
    console.error("Reject booking error:", err.response?.data || err.message);
    throw err.response?.data || err;
  }
};;

export const clearBooking = async (bookingId) => {
  try {
    const res = await api.post(`/bookings/${bookingId}/clear/`);
    return res.data;
  } catch (err) {
    console.error("Clear booking error:", err.response?.data || err.message);
    throw err.response?.data || err;
  }
};

export const clearTenantBooking = async (bookingId) => {
  try {
    const res = await api.post(`/bookings/${bookingId}/clear-for-tenant/`);
    return res.data;
  } catch (err) {
    console.error("Clear tenant booking error:", err.response?.data || err.message);
    throw err.response?.data || err;
  }
};

// ─── Meeting APIs ────────────────────────────────────────────────────────────
export const cancelMeeting = async (meetingId) => {
  try {
    const res = await api.post(`/meetings/${meetingId}/cancel/`);
    return res.data;
  } catch (err) {
    console.error("Cancel meeting error:", err.response?.data || err.message);
    throw err.response?.data || err;
  }
};

export const completeMeeting = async (meetingId) => {
  try {
    const res = await api.post(`/meetings/${meetingId}/complete/`);
    return res.data;
  } catch (err) {
    console.error("Complete meeting error:", err.response?.data || err.message);
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

export const getLeases = async () => {
  try {
    const res = await api.get("/leases/");
    const data = res.data;
    return Array.isArray(data) ? data : data.results ?? [];
  } catch (err) {
    console.error("Fetch leases error:", err.response?.data || err.message);
    throw err.response?.data || err;
  }
};

export const terminateTenantLease = async (leaseId, payload = {}) => {
  try {
    const res = await api.post(`/leases/${leaseId}/terminate/`, payload);
    return res.data;
  } catch (err) {
    console.error("Terminate lease error:", err.response?.data || err.message);
    throw err.response?.data || err;
  }
};

export const renewTenantLease = async (leaseId, payload) => {
  try {
    const res = await api.post(`/leases/${leaseId}/renew/`, payload);
    return res.data;
  } catch (err) {
    console.error("Renew lease error:", err.response?.data || err.message);
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

export const forgotPassword = async (email) => {
  try {
    const res = await api.post("/users/forgot-password/", { email });
    return res.data;
  } catch (err) {
    console.error("Forgot password error:", err.response?.data || err.message);
    throw err;
  }
};
export const confirmResetCode = async (email, code) => {
  try {
    const res = await api.post("/users/confirm-code/", { email, code });
    return res.data;
  } catch (err) {
    console.error("Confirm reset code error:", err.response?.data || err.message);
    throw err;
  }
};
export const resetPassword = async (email, code, password, confirmPassword) => {
  try {
    const res = await api.post("/users/reset-password/", {
      email,
      code,
      new_password: password,
      confirm_password: confirmPassword,
    });
    return res.data;
  } catch (err) {
    console.error("Reset password error:", err.response?.data || err.message);
    throw err;
  }
};

export { api };