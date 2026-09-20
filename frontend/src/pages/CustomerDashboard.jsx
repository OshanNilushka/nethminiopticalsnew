import { useState, useRef, useEffect } from "react";
import TryOnCanvas3D from "../components/TryOnCanvas3D";
import Catalog from "../components/Catalog";
import FeedbackSubmissionPanel from "../components/customer/FeedbackSubmissionPanel";
import { jsPDF } from "jspdf";
import CheckoutCustomizerModal from "../components/CheckoutCustomizerModal";
import { API_BASE_URL } from "../config/api";
import { WORLD_OPTICAL_RULES } from "../constants/opticalRules";

// Mock Data for the Dashboard
const MOCK_PROFILE = {
  name: "John Doe",
  email: "john.doe@example.com",
  phone: "+1 (555) 019-2834",
  dob: "1994-08-12",
  preferredStore: "Nethmini Opticals - Giriulla Branch",
  glassesPrescription: {
    od: { sphere: "-2.50", cyl: "-0.75", axis: "90" },
    os: { sphere: "-2.25", cyl: "-1.00", axis: "95" },
    pd: "63",
    date: "2025-11-10",
    doctor: "Dr. Sarah Perera",
    status: "VALIDATED"
  }
};

const MOCK_ORDERS = [
  {
    id: "ORD-8942",
    date: "2026-06-12",
    frame: "Classic Aviator (Gold)",
    lens: "Premium Polycarbonate - Blue Cut & Anti-Glare",
    price: "$149.00",
    status: "Processing",
    timeline: [
      { label: "Order Placed", date: "June 12, 10:30 AM", status: "completed" },
      { label: "Prescription OCR Verified", date: "June 12, 11:15 AM", status: "completed" },
      { label: "Lab Customization", date: "June 14, 09:00 AM", status: "active" },
      { label: "Quality Control", date: "Pending", status: "upcoming" },
      { label: "Shipped / Ready for Pickup", date: "Pending", status: "upcoming" }
    ]
  },
  {
    id: "ORD-7821",
    date: "2026-02-18",
    frame: "Retro Round (Tortoise)",
    lens: "Standard Single Vision",
    price: "$95.00",
    status: "Completed",
    timeline: [
      { label: "Order Placed", date: "Feb 18, 02:15 PM", status: "completed" },
      { label: "Prescription OCR Verified", date: "Feb 18, 03:00 PM", status: "completed" },
      { label: "Lab Customization", date: "Feb 19, 10:00 AM", status: "completed" },
      { label: "Quality Control", date: "Feb 20, 08:30 AM", status: "completed" },
      { label: "Delivered", date: "Feb 21, 04:00 PM", status: "completed" }
    ]
  }
];

const MOCK_FRAMES = [
  { id: "frame1", name: "Urban Tech Square", color: "Matte Black", price: "$120", type: "Square", svgPath: "M5 10h5v4H5zm9 0h5v4h-5z M10 12h4", glbUrl: "/src/assets/models/oakley_glasses.glb" },
  { id: "frame2", name: "Classic Aviator", color: "Polished Gold", price: "$145", type: "Aviator", svgPath: "M4 9c0-1.5 1.5-3 3.5-3s3.5 1.5 3.5 3c0 2-2.5 3.5-3.5 3.5S4 11 4 9zm13 0c0-1.5 1.5-3 3.5-3S24 7.5 24 9c0 2-2.5 3.5-3.5 3.5S17 11 17 9z M11 9.5h5", glbUrl: "/src/assets/models/ray_ban_glasses.glb" },
  { id: "frame3", name: "Retro Round", color: "Classic Tortoise", price: "$110", type: "Round", svgPath: "M5 11c0-2.2 1.8-4 4-4s4 1.8 4 4-1.8 4-4 4-4-1.8-4-4zm11 0c0-2.2 1.8-4 4-4s4 1.8 4 4-1.8 4-4 4-4-1.8-4-4z M13 11h3", glbUrl: "/src/assets/models/metal_round_glasses.glb" },
  { id: "frame4", name: "Geometric Hex", color: "Rose Gold", price: "$130", type: "Geometric", svgPath: "M4.5 9.5l2-2.5h4l2 2.5v3l-2 2.5h-4l-2-2.5zm11.5 0l2-2.5h4l2 2.5v3l-2 2.5h-4l-2-2.5z M12.5 11h3", glbUrl: "/src/assets/models/cartoon_glasses.glb" }
];

export default function CustomerDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [profile, setProfile] = useState(MOCK_PROFILE);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Forced First-Time Password Change for Walk-In / Staff-Created Patients
  const [showForcePasswordModal, setShowForcePasswordModal] = useState(() => {
    return localStorage.getItem("mustChangePassword") === "true";
  });
  const [forcePwdForm, setForcePwdForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [forceShowCurrent, setForceShowCurrent] = useState(false);
  const [forceShowNew, setForceShowNew] = useState(false);
  const [forceShowConfirm, setForceShowConfirm] = useState(false);
  const [forcePwdLoading, setForcePwdLoading] = useState(false);
  const [forcePwdError, setForcePwdError] = useState("");
  const [forcePwdSuccess, setForcePwdSuccess] = useState("");

  const handleForcePasswordSubmit = async (e) => {
    e.preventDefault();
    setForcePwdError("");
    setForcePwdSuccess("");

    if (!forcePwdForm.newPassword || forcePwdForm.newPassword.length < 6) {
      setForcePwdError("New password must be at least 6 characters long.");
      return;
    }

    if (forcePwdForm.newPassword !== forcePwdForm.confirmPassword) {
      setForcePwdError("New password and confirmation password do not match.");
      return;
    }

    setForcePwdLoading(true);

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE_URL}/api/auth/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword: forcePwdForm.currentPassword ? forcePwdForm.currentPassword.trim() : undefined,
          newPassword: forcePwdForm.newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to set new password.");
      }

      setForcePwdSuccess("Your new password is set! Opening your patient dashboard...");
      localStorage.setItem("mustChangePassword", "false");
      setTimeout(() => {
        setShowForcePasswordModal(false);
        setForcePwdSuccess("");
      }, 1200);
    } catch (err) {
      setForcePwdError(err.message || "An unexpected error occurred.");
    } finally {
      setForcePwdLoading(false);
    }
  };

  const fetchNotifications = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/notifications`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setNotifications(data);
        setUnreadCount(data.filter(n => !n.isRead).length);
      }
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    }
  };

  const markAsRead = async (id, type) => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/notifications/${id}/read`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (response.ok) {
        fetchNotifications();
        // Redirect to corresponding tab
        if (type === "PRESCRIPTION_VALIDATED" || type === "PRESCRIPTION_REJECTED") {
          setActiveTab("ocr");
        } else if (type === "APPOINTMENT_CONFIRMED" || type === "APPOINTMENT_CANCELLED") {
          setActiveTab("appointments");
        }
        setShowNotifDropdown(false);
      }
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
  };

  const markAllAsRead = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/notifications/read-all`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (response.ok) {
        fetchNotifications();
      }
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    }
  };

  // Tabs structure
  const tabs = [
    { id: "overview", name: "Overview", icon: "dashboard" },
    { id: "tryon", name: "Virtual Try-On", icon: "camera" },
    { id: "catalog", name: "Shop / View Catalog", icon: "shopping-cart" },
    { id: "ocr", name: "Prescription OCR", icon: "document" },
    { id: "appointments", name: "Appointments", icon: "calendar" },
    { id: "orders", name: "My Orders", icon: "shopping-bag" },
    { id: "feedback", name: "Feedback & Reviews", icon: "star" },
    { id: "chat", name: "Contact Optician", icon: "chat" },
    { id: "settings", name: "Settings", icon: "cog" }
  ];

  const fetchProfile = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      window.location.hash = "#/login";
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/users/profile`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem("token");
          window.location.hash = "#/login";
          return;
        }
        throw new Error("Failed to load profile details.");
      }

      const data = await response.json();
      console.log("DEBUG: Raw user profile data fetched:", data);

      // Map database fields to the UI profile structure
      const mappedProfile = {
        name: data.fullName,
        email: data.email,
        phone: data.phoneNumber || "None provided",
        dob: data.dob ? data.dob.split('T')[0] : "",
        preferredStore: "Nethmini Opticals - Giriulla Branch",
        glassesPrescription: data.prescriptionsAsPatient && data.prescriptionsAsPatient.length > 0
          ? {
            od: {
              sphere: data.prescriptionsAsPatient[0].odSph !== null && data.prescriptionsAsPatient[0].odSph !== undefined ? data.prescriptionsAsPatient[0].odSph.toFixed(2) : "-",
              cyl: data.prescriptionsAsPatient[0].odCyl !== null && data.prescriptionsAsPatient[0].odCyl !== undefined ? data.prescriptionsAsPatient[0].odCyl.toFixed(2) : "-",
              axis: data.prescriptionsAsPatient[0].odAxis !== null && data.prescriptionsAsPatient[0].odAxis !== undefined ? data.prescriptionsAsPatient[0].odAxis.toString() : "-"
            },
            os: {
              sphere: data.prescriptionsAsPatient[0].osSph !== null && data.prescriptionsAsPatient[0].osSph !== undefined ? data.prescriptionsAsPatient[0].osSph.toFixed(2) : "-",
              cyl: data.prescriptionsAsPatient[0].osCyl !== null && data.prescriptionsAsPatient[0].osCyl !== undefined ? data.prescriptionsAsPatient[0].osCyl.toFixed(2) : "-",
              axis: data.prescriptionsAsPatient[0].osAxis !== null && data.prescriptionsAsPatient[0].osAxis !== undefined ? data.prescriptionsAsPatient[0].osAxis.toString() : "-"
            },
            pd: data.prescriptionsAsPatient[0].pd !== null && data.prescriptionsAsPatient[0].pd !== undefined ? data.prescriptionsAsPatient[0].pd.toString() : "-",
            date: data.prescriptionsAsPatient[0].createdAt.split('T')[0],
            doctor: (() => {
              const raw = data.prescriptionsAsPatient[0].rawOcrResult || "";
              const match = raw.match(/(?:doctor(?:\s+name)?|dr\.?)\s*[:\-]?\s*(?:dr\.?\s*)?([a-z\s.]+)/i);
              if (match && match[1] && match[1].trim() && match[1].trim().toLowerCase() !== "name" && match[1].trim().toLowerCase() !== "unknown") {
                const name = match[1].trim().replace(/\b[a-z]/g, (l) => l.toUpperCase());
                return name.toLowerCase().startsWith("dr") ? name : `Dr. ${name}`;
              }
              return "Dr. Nayanagama";
            })(),
            status: data.prescriptionsAsPatient[0].status || "PENDING",
            rejectionReason: data.prescriptionsAsPatient[0].rejectionReason || null
          }
          : null,
        mustChangePassword: Boolean(data.mustChangePassword),
      };

      if (data.mustChangePassword) {
        setShowForcePasswordModal(true);
        localStorage.setItem("mustChangePassword", "true");
      }

      setProfile(mappedProfile);

      // Map DB orders or use fallback empty list if user has none yet
      if (data.orders && data.orders.length > 0) {
        const mappedOrders = data.orders.map(o => {
          const dateStr = o.createdAt.split('T')[0];
          const statusUpper = o.status?.toUpperCase();
          let timeline = [];

          if (statusUpper === "PENDING") {
            timeline = [
              { label: "Order Placed", date: dateStr, status: "completed" },
              { label: "Prescription OCR Verified", date: dateStr, status: "completed" },
              { label: "Lab Customization", date: "Pending", status: "upcoming" },
              { label: "Quality Control", date: "Pending", status: "upcoming" },
              { label: "Shipped / Ready for Pickup", date: "Pending", status: "upcoming" }
            ];
          } else if (statusUpper === "PROCESSING") {
            timeline = [
              { label: "Order Placed", date: dateStr, status: "completed" },
              { label: "Prescription OCR Verified", date: dateStr, status: "completed" },
              { label: "Lab Customization", date: "In Progress", status: "active" },
              { label: "Quality Control", date: "Pending", status: "upcoming" },
              { label: "Shipped / Ready for Pickup", date: "Pending", status: "upcoming" }
            ];
          } else if (statusUpper === "ON_HOLD" || statusUpper === "HOLD") {
            timeline = [
              { label: "Order Placed", date: dateStr, status: "completed" },
              { label: "Prescription OCR Verified", date: dateStr, status: "completed" },
              { label: "On Hold (Awaiting Action)", date: "Action Required", status: "active", isHold: true },
              { label: "Lab Customization", date: "Paused", status: "upcoming" },
              { label: "Delivery / Pickup", date: "Pending", status: "upcoming" }
            ];
          } else if (statusUpper === "READY_FOR_PICKUP") {
            timeline = [
              { label: "Order Placed", date: dateStr, status: "completed" },
              { label: "Prescription OCR Verified", date: dateStr, status: "completed" },
              { label: "Lab Customization", date: "Completed", status: "completed" },
              { label: "Quality Control", date: "Completed", status: "completed" },
              { label: "Shipped / Ready for Pickup", date: "Ready for Pickup", status: "active" }
            ];
          } else if (statusUpper === "SHIPPED") {
            timeline = [
              { label: "Order Placed", date: dateStr, status: "completed" },
              { label: "Prescription OCR Verified", date: dateStr, status: "completed" },
              { label: "Lab Customization", date: "Completed", status: "completed" },
              { label: "Quality Control", date: "Completed", status: "completed" },
              { label: "Shipped (Courier)", date: o.courierName || "In Transit", status: "active" }
            ];
          } else if (statusUpper === "DELIVERED") {
            timeline = [
              { label: "Order Placed", date: dateStr, status: "completed" },
              { label: "Prescription OCR Verified", date: dateStr, status: "completed" },
              { label: "Lab Customization", date: "Completed", status: "completed" },
              { label: "Quality Control", date: "Completed", status: "completed" },
              { label: "Shipped & Delivered", date: "Delivered", status: "completed" }
            ];
          } else if (statusUpper === "COMPLETED") {
            timeline = [
              { label: "Order Placed", date: dateStr, status: "completed" },
              { label: "Prescription OCR Verified", date: dateStr, status: "completed" },
              { label: "Lab Customization", date: "Completed", status: "completed" },
              { label: "Quality Control", date: "Completed", status: "completed" },
              { label: "Shipped / Ready for Pickup", date: "Completed", status: "completed" }
            ];
          } else {
            timeline = [
              { label: "Order Placed", date: dateStr, status: "completed" },
              { label: "Prescription OCR Verified", date: dateStr, status: "completed" },
              { label: "Lab Customization", date: "Cancelled", status: "upcoming" },
              { label: "Quality Control", date: "Cancelled", status: "upcoming" },
              { label: "Shipped / Ready for Pickup", date: "Cancelled", status: "upcoming" }
            ];
          }

          return {
            id: o.id.substring(0, 8).toUpperCase(),
            rawId: o.id,
            date: dateStr,
            items: o.items, // Keep all items in order mapping
            price: `LKR ${o.totalAmount.toLocaleString()}`,
            status: o.status === "ON_HOLD" ? "On Hold" : o.status,
            holdReason: o.holdReason || null,
            cancelReason: o.cancelReason || null,
            timeline,
            shippingAddress: o.shippingAddress,
            recipientName: o.recipientName,
            recipientPhone: o.recipientPhone,
            shippingCost: o.shippingCost,
            courierName: o.courierName,
            trackingNumber: o.trackingNumber,
            paymentMethod: o.paymentMethod,
            paymentStatus: o.paymentStatus
          };
        });
        setOrders(mappedOrders);
      } else {
        setOrders([]);
      }

      setLoading(false);
    } catch (err) {
      console.error(err);
      setError(err.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10000); // Poll every 10 seconds
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-slate-100 font-sans">
        <div className="w-12 h-12 rounded-full border-4 border-slate-700 border-t-cyan-400 animate-spin mb-4"></div>
        <p className="text-sm font-semibold tracking-wider animate-pulse">Loading visual health records...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans">
      {/* Sidebar Layout */}
      <aside className="w-full md:w-64 bg-slate-900 text-slate-100 flex flex-col border-r border-slate-800">
        {/* Brand logo */}
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-tr from-blue-600 to-cyan-400 rounded-lg flex items-center justify-center text-white font-bold shadow-md shadow-blue-500/20">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </div>
          <span className="text-xl font-bold tracking-tight">
            Nethmini<span className="text-cyan-400">Opticals</span>
          </span>
        </div>

        {/* User Card */}
        <div className="p-4 mx-4 my-4 bg-slate-800/50 rounded-xl flex items-center gap-3 border border-slate-800">
          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-lg shadow">
            {profile.name.charAt(0)}
          </div>
          <div className="overflow-hidden">
            <h4 className="font-semibold text-sm truncate text-slate-100">{profile.name}</h4>
            <span className="text-xs text-slate-400">Patient Dashboard</span>
          </div>
        </div>

        {/* Nav tabs */}
        <nav className="flex-1 px-4 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer ${activeTab === tab.id
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/10"
                : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/40"
                }`}
            >
              <TabIcon type={tab.icon} />
              {tab.name}
            </button>
          ))}
          {/* Shop Catalog is now integrated directly in tabs above */}
        </nav>

        {/* Logout / Exit */}
        <div className="p-4 border-t border-slate-800">
          <button
            onClick={() => setShowLogoutModal(true)}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-950/20 transition-all cursor-pointer border-none bg-transparent"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-y-auto max-h-screen">
        {/* Top Header */}
        <header className="bg-white border-b border-slate-200/80 px-6 py-4 flex justify-between items-center shrink-0">
          <div>
            <h1 className="text-xl font-bold text-slate-800 capitalize">
              {activeTab === "overview" ? `Welcome back, ${profile.name.split(' ')[0]}!` : `${activeTab.replace(/([A-Z])/g, " $1")} Dashboard`}
            </h1>
            <p className="text-xs text-slate-500">
              {new Date().toLocaleDateString("en-US", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>

          <div className="flex items-center gap-4">
            {/* Quick Prescr status */}
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              Active Prescription Verified
            </span>

            {/* Refresh Button */}
            <button
              onClick={() => {
                fetchProfile();
                fetchNotifications();
              }}
              title="Refresh Data"
              className="p-2 text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200/70 rounded-full transition-all cursor-pointer mr-1"
            >
              <svg className="w-5 h-5 active:rotate-180 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
            </button>

            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setShowNotifDropdown(!showNotifDropdown)}
                className="p-2 text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200/70 rounded-full transition-all cursor-pointer relative"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-blue-600 rounded-full"></span>
                )}
              </button>

              {/* Notification Dropdown */}
              {showNotifDropdown && (
                <div className="absolute right-0 mt-2.5 w-80 bg-white rounded-2xl border border-slate-200 shadow-xl z-50 flex flex-col overflow-hidden max-h-[400px]">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-150 flex justify-between items-center text-slate-800">
                    <span className="font-extrabold text-sm">Notifications ({unreadCount})</span>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllAsRead}
                        className="text-[10px] text-blue-600 font-bold hover:underline"
                      >
                        Mark all as read
                      </button>
                    )}
                  </div>
                  <div className="flex-1 overflow-y-auto divide-y divide-slate-100 text-slate-700">
                    {notifications.length === 0 ? (
                      <div className="px-4 py-8 text-center text-slate-400 text-xs">
                        No notifications yet
                      </div>
                    ) : (
                      notifications.map(notif => (
                        <div
                          key={notif.id}
                          onClick={() => markAsRead(notif.id, notif.type)}
                          className={`px-4 py-3 cursor-pointer transition-colors text-left flex gap-2.5 items-start ${notif.isRead ? "hover:bg-slate-50" : "bg-blue-50/20 hover:bg-blue-50/40"
                            }`}
                        >
                          <div className="mt-1 shrink-0">
                            {!notif.isRead ? (
                              <span className="block w-1.5 h-1.5 rounded-full bg-blue-600" />
                            ) : (
                              <span className="block w-1.5 h-1.5 rounded-full bg-transparent" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-xs text-slate-800 truncate">{notif.title}</p>
                            <p className="text-[11px] text-slate-500 mt-0.5 leading-normal">{notif.message}</p>
                            <span className="text-[9px] text-slate-400 mt-1 block">
                              {new Date(notif.createdAt).toLocaleDateString()} at {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Dashboard Pages */}
        <div className="p-6 flex-1 max-w-[1400px] w-full mx-auto">
          {activeTab === "overview" && <OverviewPanel setActiveTab={setActiveTab} profile={profile} orders={orders} />}
          {activeTab === "tryon" && <TryOnPanel onOrderPlaced={fetchProfile} profile={profile} setActiveTab={setActiveTab} />}
          {activeTab === "catalog" && (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden p-6">
              <Catalog isDashboardView={true} onCheckoutSuccess={fetchProfile} />
            </div>
          )}
          {activeTab === "ocr" && <OCRPanel profile={profile} setProfile={setProfile} onPrescriptionUploaded={fetchProfile} />}
          {activeTab === "appointments" && <AppointmentPanel />}
          {activeTab === "orders" && <OrdersPanel orders={orders} profile={profile} onOrderCancelled={fetchProfile} />}
          {activeTab === "feedback" && <FeedbackSubmissionPanel profile={profile} />}
          {activeTab === "chat" && <ChatPanel profile={profile} />}
          {activeTab === "settings" && <SettingsPanel profile={profile} setProfile={setProfile} />}
        </div>
      </main>

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl border border-slate-100 text-center animate-in fade-in zoom-in duration-200">
            <div className="w-14 h-14 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-rose-100 shadow-sm">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </div>
            <h3 className="text-xl font-extrabold text-slate-900 mb-2">Confirm Sign Out</h3>
            <p className="text-slate-500 text-sm mb-6 leading-relaxed font-medium">
              Are you sure you want to sign out of your account? You will need to log back in to access your patient dashboard.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLogoutModal(false)}
                className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all cursor-pointer border-none text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  localStorage.removeItem("token");
                  localStorage.removeItem("user_email");
                  window.location.hash = "#/login";
                }}
                className="flex-1 py-3 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-lg shadow-rose-600/30 transition-all cursor-pointer border-none text-sm"
              >
                Yes, Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Forced Password Change Modal for Walk-in / Staff-Created Patients */}
      {showForcePasswordModal && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            {/* Header Badge & Icon */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#1b5e85] to-[#2980b9] text-white flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div>
                <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
                  Initial Setup Required
                </span>
                <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight leading-tight">
                  Set Your Permanent Password
                </h3>
              </div>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed mb-5">
              Welcome to <strong className="text-slate-700">Nethmini Opticals</strong>! Your account was registered at our clinic with a temporary access key. For your personal privacy and order security, please establish your confidential password below to unlock your patient portal.
            </p>

            {forcePwdError && (
              <div className="mb-4 p-3 bg-rose-50 border-l-4 border-rose-500 rounded-r-xl text-rose-800 text-xs font-medium leading-relaxed">
                {forcePwdError}
              </div>
            )}

            {forcePwdSuccess && (
              <div className="mb-4 p-3 bg-emerald-50 border-l-4 border-emerald-500 rounded-r-xl text-emerald-800 text-xs font-medium leading-relaxed">
                {forcePwdSuccess}
              </div>
            )}

            <form onSubmit={handleForcePasswordSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Temporary Password <span className="text-slate-400 font-normal">(Sent via clinic email)</span>
                </label>
                <div className="relative">
                  <input
                    type={forceShowCurrent ? "text" : "password"}
                    placeholder="Enter temporary password from email"
                    value={forcePwdForm.currentPassword}
                    onChange={(e) => setForcePwdForm({ ...forcePwdForm, currentPassword: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-3.5 pr-10 py-2.5 text-slate-800 text-xs font-medium outline-none focus:bg-white focus:border-[#1b5e85] focus:ring-1 focus:ring-[#1b5e85] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setForceShowCurrent(!forceShowCurrent)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {forceShowCurrent ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" /></svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Create Permanent Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={forceShowNew ? "text" : "password"}
                    placeholder="Min 6 characters (e.g. letters, numbers)"
                    value={forcePwdForm.newPassword}
                    onChange={(e) => setForcePwdForm({ ...forcePwdForm, newPassword: e.target.value })}
                    required
                    minLength={6}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-3.5 pr-10 py-2.5 text-slate-800 text-xs font-medium outline-none focus:bg-white focus:border-[#1b5e85] focus:ring-1 focus:ring-[#1b5e85] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setForceShowNew(!forceShowNew)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {forceShowNew ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" /></svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Confirm Permanent Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={forceShowConfirm ? "text" : "password"}
                    placeholder="Repeat your new permanent password"
                    value={forcePwdForm.confirmPassword}
                    onChange={(e) => setForcePwdForm({ ...forcePwdForm, confirmPassword: e.target.value })}
                    required
                    minLength={6}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-3.5 pr-10 py-2.5 text-slate-800 text-xs font-medium outline-none focus:bg-white focus:border-[#1b5e85] focus:ring-1 focus:ring-[#1b5e85] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setForceShowConfirm(!forceShowConfirm)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {forceShowConfirm ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" /></svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="pt-3 flex flex-col sm:flex-row items-center gap-3">
                <button
                  type="submit"
                  disabled={forcePwdLoading}
                  className="w-full sm:flex-1 bg-[#1b5e85] hover:bg-[#154d70] text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-blue-900/20 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {forcePwdLoading ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Securing Account...
                    </>
                  ) : (
                    "Save & Access Dashboard"
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem("token");
                    localStorage.removeItem("user_email");
                    localStorage.removeItem("mustChangePassword");
                    window.location.hash = "#/login";
                  }}
                  className="w-full sm:w-auto px-4 py-3 text-slate-500 hover:text-slate-800 font-semibold rounded-xl hover:bg-slate-100 transition-colors cursor-pointer text-center text-xs"
                >
                  Sign Out
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Subcomponents helper for Sidebar icons
function TabIcon({ type }) {
  const base = "w-5 h-5";
  switch (type) {
    case "dashboard":
      return (
        <svg className={base} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zM14 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2v-4z" />
        </svg>
      );
    case "camera":
      return (
        <svg className={base} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      );
    case "eye":
      return (
        <svg className={base} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      );
    case "document":
      return (
        <svg className={base} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
    case "calendar":
      return (
        <svg className={base} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
    case "shopping-bag":
      return (
        <svg className={base} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
      );
    case "chat":
      return (
        <svg className={base} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      );
    case "star":
      return (
        <svg className={base} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
      );
    case "cog":
      return (
        <svg className={base} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      );
    case "shopping-cart":
      return (
        <svg className={base} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      );
    default:
      return null;
  }
}

// ----------------------------------------------------
// 1. OVERVIEW PANEL
// ----------------------------------------------------
function OverviewPanel({ setActiveTab, profile, orders }) {
  const activeOrder = orders.find(o => {
    const s = o.status?.toUpperCase();
    return s === "PENDING" || s === "PROCESSING" || s === "READY_FOR_PICKUP";
  }) || orders[0];
  const savedFaceShape = localStorage.getItem(`face_shape_${profile.email}`) || "Not Scanned";

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 rounded-3xl p-6 md:p-8 text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-2">
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">Your Smart Optical Care, Simplified.</h2>
          <p className="text-blue-100 max-w-lg text-sm md:text-base">
            Try on frames in our AR Virtual Mirror, digitize paper prescriptions in seconds, or view your eyewear order tracking.
          </p>
        </div>
        <button
          onClick={() => setActiveTab("tryon")}
          className="shrink-0 bg-white hover:bg-slate-100 text-blue-700 px-6 py-3 rounded-xl font-bold text-sm shadow-md transition-all active:scale-95 cursor-pointer hover:shadow-lg"
        >
          Open Virtual Try-On
        </button>
      </div>

      {/* Grid of Key Info */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-semibold text-lg">
            {orders.length}
          </div>
          <div>
            <h5 className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Total Orders</h5>
            <p className="text-lg font-bold text-slate-800">{orders.length} {orders.length === 1 ? "Item" : "Items"}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h5 className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Prescriptions</h5>
            <p className="text-lg font-bold text-slate-800">{profile.glassesPrescription ? "1 Active" : "0 Active"}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h5 className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Next Appointment</h5>
            <p className="text-sm font-bold text-slate-800 truncate">Tomorrow, 10:00 AM</p>
          </div>
        </div>

        <div
          onClick={() => setActiveTab("tryon")}
          className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4 cursor-pointer hover:border-blue-400 transition-all hover:shadow-md"
        >
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-lg">
            ✨
          </div>
          <div>
            <h5 className="text-slate-400 text-xs font-semibold uppercase tracking-wider">AI Face Shape</h5>
            <p className="text-lg font-bold text-slate-800 capitalize">{savedFaceShape}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Order Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-slate-100">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></span>
              Active Order Tracking
            </h3>
            {activeOrder && <span className="text-xs text-slate-400">ID: {activeOrder.id}</span>}
          </div>

          {activeOrder ? (
            <>
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-bold text-slate-800">{activeOrder.frame}</p>
                  <p className="text-xs text-slate-500">{activeOrder.lens}</p>
                </div>
                <span className="px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 rounded-full border border-blue-200">
                  {activeOrder.status}
                </span>
              </div>

              {/* Miniature Timeline */}
              <div className="pt-2 space-y-4">
                {activeOrder.timeline.map((step, idx) => (
                  <div key={idx} className="flex gap-4 items-start relative">
                    {idx < activeOrder.timeline.length - 1 && (
                      <div
                        className={`absolute left-3.5 top-7 bottom-0 w-0.5 -ml-px ${step.status === "completed" ? "bg-blue-500" : "bg-slate-200"
                          }`}
                      ></div>
                    )}
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 border-2 font-bold text-xs ${step.status === "completed"
                        ? "bg-blue-50 border-blue-500 text-blue-600"
                        : step.status === "active"
                          ? "bg-amber-50 border-amber-500 text-amber-600 ring-4 ring-amber-100"
                          : "bg-slate-50 border-slate-200 text-slate-400"
                        }`}
                    >
                      {step.status === "completed" ? "✓" : idx + 1}
                    </div>
                    <div className="pt-0.5">
                      <p className="text-sm font-semibold text-slate-800">{step.label}</p>
                      <p className="text-xs text-slate-400">{step.date}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
              <svg className="w-16 h-16 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              <div>
                <p className="text-sm font-bold text-slate-700">No active orders</p>
                <p className="text-xs text-slate-400 max-w-xs mx-auto mt-1">
                  You haven't placed any orders yet. Visit our Virtual Try-On catalog to find the perfect frame!
                </p>
              </div>
              <button
                onClick={() => setActiveTab("tryon")}
                className="mt-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition-all active:scale-95 cursor-pointer"
              >
                Browse Frames
              </button>
            </div>
          )}
        </div>

        {/* Quick Actions & Prescription overview */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-800 border-b border-slate-100 pb-3">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setActiveTab("tryon")}
                className="flex flex-col items-center justify-center p-4 rounded-xl bg-slate-50 border border-slate-200 hover:border-blue-400 hover:bg-blue-50/20 text-center transition-all cursor-pointer group"
              >
                <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <span className="text-xs font-bold text-slate-700">AR Try-on</span>
              </button>

              <button
                onClick={() => setActiveTab("ocr")}
                className="flex flex-col items-center justify-center p-4 rounded-xl bg-slate-50 border border-slate-200 hover:border-blue-400 hover:bg-blue-50/20 text-center transition-all cursor-pointer group"
              >
                <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                </div>
                <span className="text-xs font-bold text-slate-700">Prescr OCR</span>
              </button>

              <button
                onClick={() => setActiveTab("appointments")}
                className="flex flex-col items-center justify-center p-4 rounded-xl bg-slate-50 border border-slate-200 hover:border-blue-400 hover:bg-blue-50/20 text-center transition-all cursor-pointer group"
              >
                <div className="w-10 h-10 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <span className="text-xs font-bold text-slate-700">Book Exam</span>
              </button>

              <button
                onClick={() => setActiveTab("chat")}
                className="flex flex-col items-center justify-center p-4 rounded-xl bg-slate-50 border border-slate-200 hover:border-blue-400 hover:bg-blue-50/20 text-center transition-all cursor-pointer group"
              >
                <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <span className="text-xs font-bold text-slate-700">Chat Optician</span>
              </button>
            </div>
          </div>

          {/* Digital Rx Details */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-800">Digital Prescription</h3>
              <button
                onClick={() => setActiveTab("ocr")}
                className="text-xs text-blue-600 font-bold hover:underline cursor-pointer"
              >
                Details
              </button>
            </div>
            {profile.glassesPrescription ? (
              <div className="space-y-3 bg-slate-50 p-4 rounded-xl text-xs animate-[fadeIn_0.3s_ease]">
                <div className="flex justify-between items-center pb-2.5 border-b border-slate-200/60 mb-2">
                  <span className="text-slate-500 font-extrabold text-xs uppercase tracking-wider">Status:</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5 shadow-sm border ${profile.glassesPrescription.status === "PENDING" ? "bg-amber-50 text-amber-700 border-amber-200" :
                      profile.glassesPrescription.status === "REJECTED" ? "bg-rose-50 text-rose-700 border-rose-200" :
                        "bg-emerald-50 text-emerald-700 border-emerald-200"
                    }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${profile.glassesPrescription.status === "PENDING" ? "bg-amber-500 animate-pulse" :
                        profile.glassesPrescription.status === "REJECTED" ? "bg-rose-500" :
                          "bg-emerald-500"
                      }`} />
                    {profile.glassesPrescription.status === "PENDING" ? "Pending Review" :
                      profile.glassesPrescription.status === "REJECTED" ? "Rejected" : "Validated"}
                  </span>
                </div>
                {profile.glassesPrescription.status === "REJECTED" && profile.glassesPrescription.rejectionReason && (
                  <div className="bg-rose-50 border border-rose-200 rounded-lg p-2.5 text-rose-800 text-xs font-semibold leading-relaxed mb-2">
                    <span className="font-extrabold block text-rose-900 mb-0.5 uppercase tracking-wider text-[11px]">Rejection Reason:</span>
                    {profile.glassesPrescription.rejectionReason}
                  </div>
                )}
                <div className="grid grid-cols-4 gap-2 text-slate-400 font-extrabold text-xs uppercase tracking-wider pb-1 border-b border-slate-200/70">
                  <span className="text-left">Eye</span>
                  <span className="text-center">SPH</span>
                  <span className="text-center">CYL</span>
                  <span className="text-right">Axis</span>
                </div>
                <div className="grid grid-cols-4 gap-2 font-bold text-slate-900 text-sm md:text-base items-center py-1">
                  <span className="text-left text-xs md:text-sm font-bold text-slate-700">Right (OD)</span>
                  <span className="text-center font-mono font-bold text-slate-900">{profile.glassesPrescription.od.sphere}</span>
                  <span className="text-center font-mono font-bold text-slate-900">{profile.glassesPrescription.od.cyl}</span>
                  <span className="text-right font-mono font-bold text-slate-900">{profile.glassesPrescription.od.axis !== "-" ? `${profile.glassesPrescription.od.axis}°` : "-"}</span>
                </div>
                <div className="grid grid-cols-4 gap-2 font-bold text-slate-900 text-sm md:text-base items-center py-1 border-b border-slate-200 pb-2">
                  <span className="text-left text-xs md:text-sm font-bold text-slate-700">Left (OS)</span>
                  <span className="text-center font-mono font-bold text-slate-900">{profile.glassesPrescription.os.sphere}</span>
                  <span className="text-center font-mono font-bold text-slate-900">{profile.glassesPrescription.os.cyl}</span>
                  <span className="text-right font-mono font-bold text-slate-900">{profile.glassesPrescription.os.axis !== "-" ? `${profile.glassesPrescription.os.axis}°` : "-"}</span>
                </div>
                <div className="flex justify-between items-center pt-1.5">
                  <span className="text-slate-500 font-bold text-xs md:text-sm">PD (Pupillary Dist):</span>
                  <span className="font-extrabold text-slate-900 text-sm md:text-base font-mono">{profile.glassesPrescription.pd !== "-" ? `${profile.glassesPrescription.pd} mm` : "-"}</span>
                </div>
                <div className="flex justify-between items-center pt-1.5 border-t border-slate-100">
                  <span className="text-slate-500 font-bold text-xs md:text-sm">Doctor:</span>
                  <span className="font-extrabold text-slate-900 text-xs md:text-sm">{profile.glassesPrescription.doctor || "Dr. Nayanagama"}</span>
                </div>
              </div>
            ) : (
              <div className="text-center p-6 border border-dashed border-slate-200 rounded-xl space-y-2">
                <p className="text-xs text-slate-500 font-semibold">No prescription registered yet.</p>
                <button
                  onClick={() => setActiveTab("ocr")}
                  className="text-[11px] font-bold text-blue-650 hover:underline cursor-pointer"
                >
                  Digitize your prescription here →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// 2. VIRTUAL TRY-ON PANEL
// ----------------------------------------------------
function TryOnPanel({ onOrderPlaced, profile, setActiveTab }) {
  const [useCamera, setUseCamera] = useState(false);
  const [selectedFrame, setSelectedFrame] = useState(MOCK_FRAMES[0]);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [checkoutCart, setCheckoutCart] = useState([]);
  const [faceShape, setFaceShape] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isMeasured, setIsMeasured] = useState(false);
  const [glassesOffset, setGlassesOffset] = useState({ x: 0, y: 0, scale: 1.1, rotate: 0 });
  const [allFrames, setAllFrames] = useState(MOCK_FRAMES);
  const [recommendedFrames, setRecommendedFrames] = useState([]);
  const [catalogViewMode, setCatalogViewMode] = useState("recommended"); // "recommended" | "all"
  const [isModelsLoaded, setIsModelsLoaded] = useState(false);
  const [faceMetrics, setFaceMetrics] = useState(null);
  const [showReferenceTable, setShowReferenceTable] = useState(false);
  const [metricData, setMetricData] = useState({
    isCalibrated: false,
    pdMm: 63.0,
    irisMm: 11.7,
    frameMm: 138
  });
  const [enableMetricFit, setEnableMetricFit] = useState(true);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const landmarksRef = useRef(null);
  const cameraRef = useRef(null);
  const faceMeshRef = useRef(null);
  const isMeasuredRef = useRef(isMeasured);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const mirrorContainerRef = useRef(null);

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      if (mirrorContainerRef.current?.requestFullscreen) {
        mirrorContainerRef.current.requestFullscreen().catch(() => setIsFullscreen(true));
      } else {
        setIsFullscreen(true);
      }
    } else {
      if (document.exitFullscreen && document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    isMeasuredRef.current = isMeasured;
  }, [isMeasured]);

  // Sync face shape and metrics to localStorage under user's email
  useEffect(() => {
    if (faceShape && profile?.email) {
      localStorage.setItem(`face_shape_${profile.email}`, faceShape);
      if (faceMetrics) {
        localStorage.setItem(`face_metrics_${profile.email}`, JSON.stringify(faceMetrics));
      }
    }
  }, [faceShape, faceMetrics, profile?.email]);

  // Load saved face shape and calculate recommendations on initial load or when allFrames loads
  useEffect(() => {
    const email = profile?.email || localStorage.getItem("user_email");
    if (!email) return;
    const savedShape = localStorage.getItem(`face_shape_${email}`);
    const savedMetrics = localStorage.getItem(`face_metrics_${email}`);

    if (savedShape && !faceShape) {
      setFaceShape(savedShape);
      setIsMeasured(true);
      if (savedMetrics && !faceMetrics) {
        try {
          setFaceMetrics(JSON.parse(savedMetrics));
        } catch (err) {
          console.error("Failed to parse saved face metrics", err);
        }
      }
      if (allFrames && allFrames.length > 0) {
        loadLocalRecommendations(savedShape, allFrames);
      }
    } else if (faceShape && allFrames && allFrames.length > 0) {
      loadLocalRecommendations(faceShape, allFrames);
    }
  }, [profile?.email, allFrames]);

  useEffect(() => {
    const checkInterval = setInterval(() => {
      if (window.FaceMesh && window.Camera && window.drawConnectors) {
        setIsModelsLoaded(true);
        clearInterval(checkInterval);
      }
    }, 200);
    return () => clearInterval(checkInterval);
  }, []);

  useEffect(() => {
    const fetchAllProducts = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/products`);
        if (response.ok) {
          const data = await response.json();
          if (data && data.length > 0) {
            // Filter out lenses so Virtual Try-On only shows frames
            const isLensItem = (item) => {
              const shapeStr = (item.shape || '').toLowerCase();
              const nameStr = (item.name || '').toLowerCase();
              const imgStr = (item.imageUrl || '').toLowerCase();
              return shapeStr.includes('lens') || shapeStr.includes('contact') || 
                     imgStr.includes('/lenses/') || imgStr.includes('contact') || 
                     nameStr.includes('contact') || nameStr.includes('lens 1') ||
                     nameStr.includes('bluecut');
            };

            const framesData = data.filter(item => !isLensItem(item));

            const mapped = framesData.map((item, idx) => {
              let glbUrl = MOCK_FRAMES[idx % MOCK_FRAMES.length].glbUrl;

              // Resolve 3D model path from db if available
              let dbModelUrl = null;
              if (item.modelUrl && (item.modelUrl.toLowerCase().endsWith('.glb') || item.modelUrl.includes('/models/'))) {
                dbModelUrl = item.modelUrl;
              } else if (item.imageUrl && (item.imageUrl.toLowerCase().endsWith('.glb') || item.imageUrl.includes('/models/'))) {
                dbModelUrl = item.imageUrl;
              }

              if (dbModelUrl) {
                if (dbModelUrl.startsWith('/uploads/')) {
                  glbUrl = `${API_BASE_URL}${dbModelUrl}`;
                } else if (dbModelUrl.includes('/models/')) {
                  glbUrl = dbModelUrl;
                } else {
                  glbUrl = dbModelUrl.replace('/src/assets/', '/src/assets/models/');
                }
              }

              return {
                id: item.id,
                name: item.name,
                color: item.material,
                price: `LKR ${item.price.toLocaleString()}`,
                type: item.shape,
                svgPath: MOCK_FRAMES[idx % MOCK_FRAMES.length].svgPath,
                glbUrl: glbUrl,
                scaleMultiplier: item.scaleMultiplier,
                xOffset: item.xOffset,
                yOffset: item.yOffset,
                zOffset: item.zOffset,
                rotationX: item.rotationX,
                rotationY: item.rotationY,
                rotationZ: item.rotationZ
              };
            });
            setAllFrames(mapped);
            // Apply recommendations immediately on freshly fetched catalog
            const activeShape = faceShape || (profile?.email ? localStorage.getItem(`face_shape_${profile.email}`) : "");
            if (activeShape) {
              loadLocalRecommendations(activeShape, mapped);
            } else if (mapped.length > 0) {
              setSelectedFrame(mapped[0]);
            }
          }
        }
      } catch (err) {
        console.error("Failed to load frames catalog:", err);
      }
    };
    fetchAllProducts();
  }, []);

  const classifyFaceShape = (length_to_width, jaw_to_cheek, forehead_to_cheek) => {
    const forehead_to_jaw = forehead_to_cheek / (jaw_to_cheek || 1);

    let bestShape = "Oval";

    // 1. Long face -> Oblong (Length distinctly dominates width)
    if (length_to_width >= 1.48) {
      if (jaw_to_cheek < 0.74 && forehead_to_cheek < 0.80) {
        bestShape = "Diamond";
      } else {
        bestShape = "Oblong";
      }
    }
    // 2. Short / Broad face (aspect ratio < 1.33)
    else if (length_to_width < 1.33) {
      // Strong, wide, boxy jawline -> Square
      if (jaw_to_cheek >= 0.83 && forehead_to_jaw <= 1.08) {
        bestShape = "Square";
      } else {
        // Curved, soft, rounded contours -> Round
        bestShape = "Round";
      }
    }
    // 3. Balanced aspect ratio (1.33 to 1.48)
    else {
      // Heart: Inverted triangle with wide forehead tapering sharply to a narrow chin
      if (forehead_to_jaw >= 1.12 || (forehead_to_cheek >= 0.86 && jaw_to_cheek <= 0.75)) {
        bestShape = "Heart";
      }
      // Diamond: Prominent high cheekbones with tapered forehead AND tapered jaw
      else if (forehead_to_cheek <= 0.80 && jaw_to_cheek <= 0.76) {
        bestShape = "Diamond";
      }
      // Square variant: Slightly longer face but with broad, angular, boxy jawline
      else if (jaw_to_cheek >= 0.87 && forehead_to_jaw <= 1.04) {
        bestShape = "Square";
      }
      // Balanced natural symmetry with gentle jaw taper -> Oval
      else {
        bestShape = "Oval";
      }
    }

    return {
      shape: bestShape,
      metrics: { length_to_width, jaw_to_cheek, forehead_to_cheek }
    };
  };

  const calculateFaceShapeFromLandmarks = (landmarks) => {
    const get_pt = (idx) => ({ x: landmarks[idx].x, y: landmarks[idx].y });
    const dist = (p1, p2) => Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);

    const chin = get_pt(152);
    const forehead_top = get_pt(10);
    const cheek_left = get_pt(234);
    const cheek_right = get_pt(454);
    const forehead_left = get_pt(103);
    const forehead_right = get_pt(332);
    // Landmark 172 & 397 represent the true mandibular angle (jaw corners)
    const jaw_left = get_pt(172);
    const jaw_right = get_pt(397);

    const face_length = dist(forehead_top, chin);
    const cheekbone_width = dist(cheek_left, cheek_right);
    const forehead_width = dist(forehead_left, forehead_right);
    const jaw_width = dist(jaw_left, jaw_right);

    if (cheekbone_width === 0) return { shape: "Oval", metrics: { lengthToWidth: 0, jawToCheek: 0, foreheadToCheek: 0 } };

    const length_to_width = face_length / cheekbone_width;
    const jaw_to_cheek = jaw_width / cheekbone_width;
    const forehead_to_cheek = forehead_width / cheekbone_width;

    const res = classifyFaceShape(length_to_width, jaw_to_cheek, forehead_to_cheek);
    return {
      shape: res.shape,
      metrics: {
        lengthToWidth: res.metrics.length_to_width,
        jawToCheek: res.metrics.jaw_to_cheek,
        foreheadToCheek: res.metrics.forehead_to_cheek
      }
    };
  };

  const loadLocalRecommendations = (shape, framesList = allFrames) => {
    const shapeKey = (shape || "").toLowerCase();
    const opticalRule = WORLD_OPTICAL_RULES[shapeKey];

    // Normalize recommended shapes list
    const allowed = opticalRule
      ? opticalRule.recommendedShapes.map(s => s.toLowerCase().trim())
      : ["rectangle", "square", "round", "oval", "aviator", "geometric"];

    const avoid = opticalRule?.avoidShapes
      ? opticalRule.avoidShapes.map(s => s.toLowerCase().trim())
      : [];

    const targetFrames = Array.isArray(framesList) && framesList.length > 0 ? framesList : allFrames;

    const recommended = targetFrames.filter(frame => {
      const frameType = (frame.type || frame.shape || "").toLowerCase().trim();
      const frameName = (frame.name || "").toLowerCase().trim();

      // Check if this shape is in avoid list
      const isAvoid = avoid.some(a => {
        const cleanA = a.replace(/[^a-z]/g, "");
        const cleanType = frameType.replace(/[^a-z]/g, "");
        return cleanType === cleanA || frameType.includes(a);
      });

      // Match against recommended shapes
      const isRecommended = allowed.some(allowedShape => {
        const cleanAllowed = allowedShape.replace(/[^a-z]/g, "");
        const cleanType = frameType.replace(/[^a-z]/g, "");

        // 1. Direct or substring match on shape (e.g., "round", "round / oval", "oval", "aviator")
        if (frameType === allowedShape || frameType.includes(allowedShape) || allowedShape.includes(frameType)) {
          return true;
        }

        // 2. Normalized alphanumeric match (e.g., "cateye" vs "cat-eye")
        if (cleanType && cleanAllowed && (cleanType.includes(cleanAllowed) || cleanAllowed.includes(cleanType))) {
          return true;
        }

        // 3. Match from product name if shape is generic or includes shape keyword (e.g., "Retro Round", "Luna Round")
        if (frameName.includes(allowedShape) || (cleanAllowed.length >= 4 && frameName.includes(cleanAllowed))) {
          return true;
        }

        return false;
      });

      // If it matches a recommended shape and is not purely an avoided shape
      return isRecommended && (!isAvoid || isRecommended);
    });

    setRecommendedFrames(recommended);
    setCatalogViewMode("recommended");
    if (recommended.length > 0) {
      setSelectedFrame(recommended[0]);
    }
  };

  useEffect(() => {
    if (!isModelsLoaded || !useCamera) {
      if (cameraRef.current) {
        cameraRef.current.stop();
        cameraRef.current = null;
      }
      if (faceMeshRef.current) {
        faceMeshRef.current.close();
        faceMeshRef.current = null;
      }
      return;
    }

    const faceMesh = new window.FaceMesh({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
    });

    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    faceMesh.onResults((results) => {
      if (!canvasRef.current || !videoRef.current) return;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");

      if (canvas.width !== results.image.width || canvas.height !== results.image.height) {
        canvas.width = results.image.width;
        canvas.height = results.image.height;
      }

      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

      if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        const landmarks = results.multiFaceLandmarks[0];
        landmarksRef.current = landmarks;

        if (!isMeasuredRef.current && window.drawConnectors) {
          window.drawConnectors(ctx, landmarks, window.FACEMESH_TESSELATION, {
            color: 'rgba(16, 185, 129, 0.4)',
            lineWidth: 0.5
          });
          window.drawConnectors(ctx, landmarks, window.FACEMESH_FACE_OVAL, {
            color: '#10b981',
            lineWidth: 1.2
          });
          window.drawConnectors(ctx, landmarks, window.FACEMESH_LEFT_EYEBROW, { color: '#10b981', lineWidth: 1 });
          window.drawConnectors(ctx, landmarks, window.FACEMESH_RIGHT_EYEBROW, { color: '#10b981', lineWidth: 1 });
          window.drawConnectors(ctx, landmarks, window.FACEMESH_LIPS, { color: '#10b981', lineWidth: 1 });
        }
        ctx.restore();

        const leftEye = landmarks[33];
        const rightEye = landmarks[263];
        const bridge = landmarks[168];

        const bridgeX = (1 - bridge.x) * canvas.offsetWidth;
        const bridgeY = bridge.y * canvas.offsetHeight;
        const dx = (rightEye.x - leftEye.x) * canvas.offsetWidth;
        const dy = (rightEye.y - leftEye.y) * canvas.offsetHeight;
        const eyeDistance = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);

        setGlassesOffset({
          x: bridgeX,
          y: bridgeY,
          scale: eyeDistance / 115,
          rotate: -angle
        });
      } else {
        landmarksRef.current = null;
        ctx.restore();
      }
    });

    const camera = new window.Camera(videoRef.current, {
      onFrame: async () => {
        if (videoRef.current && useCamera) {
          await faceMesh.send({ image: videoRef.current });
        }
      },
      width: 640,
      height: 480,
      facingMode: "user"
    });

    faceMeshRef.current = faceMesh;
    cameraRef.current = camera;
    camera.start();

    return () => {
      if (cameraRef.current) {
        cameraRef.current.stop();
        cameraRef.current = null;
      }
      if (faceMeshRef.current) {
        faceMeshRef.current.close();
        faceMeshRef.current = null;
      }
    };
  }, [useCamera, isModelsLoaded]);

  const handleMeasure = () => {
    if (!landmarksRef.current) {
      alert("No face detected yet. Please ensure your face is fully visible to the webcam.");
      return;
    }
    const result = calculateFaceShapeFromLandmarks(landmarksRef.current);
    setFaceShape(result.shape);
    setFaceMetrics(result.metrics);
    setIsMeasured(true);
    if (profile?.email) {
      localStorage.setItem(`face_shape_${profile.email}`, result.shape);
      localStorage.setItem(`face_metrics_${profile.email}`, JSON.stringify(result.metrics));
    }
    loadLocalRecommendations(result.shape, allFrames);
  };

  const handleClearFilter = () => {
    setCatalogViewMode("all");
    setRecommendedFrames([]);
    setFaceShape("");
    setFaceMetrics(null);
    setIsMeasured(false);
    const email = profile?.email || localStorage.getItem("user_email");
    if (email) {
      localStorage.removeItem(`face_shape_${email}`);
      localStorage.removeItem(`face_metrics_${email}`);
    }
  };

  const handlePlaceOrder = async () => {
    if (!selectedFrame) {
      alert("Please select a frame first.");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      const confirmLogin = window.confirm(
        "You need to log in to place an order. We will save this frame to your cart and complete checkout automatically after login. Redirect to login page?"
      );
      if (confirmLogin) {
        localStorage.setItem("guest_order", JSON.stringify({
          frameId: selectedFrame.id,
          lensId: null,
          quantity: 1,
          prescriptionId: null
        }));
        window.location.hash = "#/login";
      }
      return;
    }

    // Retrieve active user cart to merge this item
    const userEmail = profile?.email || localStorage.getItem("user_email");
    const cartKey = userEmail ? `cart_${userEmail}` : "cart";

    let currentCart = [];
    try {
      currentCart = JSON.parse(localStorage.getItem(cartKey) || "[]");
    } catch (e) {
      console.error("Error parsing cart:", e);
    }

    // Map selectedFrame to the schema expected by CheckoutCustomizerModal
    const cleanPrice = typeof selectedFrame.price === 'string'
      ? parseFloat(selectedFrame.price.replace('$', '').replace('LKR', '').replace(/,/g, '').trim())
      : (selectedFrame.price || 0);

    const cartItem = {
      id: selectedFrame.id,
      name: selectedFrame.name,
      price: cleanPrice,
      quantity: 1,
      shape: selectedFrame.type || selectedFrame.shape || "Square",
      material: selectedFrame.color || selectedFrame.material || "Plastic",
      glbUrl: selectedFrame.glbUrl || "",
      imageUrl: selectedFrame.glbUrl || ""
    };

    setCheckoutCart([cartItem]);
    setIsCheckoutOpen(true);
  };

  const isFrameRecommended = (frame) => {
    return recommendedFrames.some(r => r.id === frame.id);
  };

  const currentDisplayCatalog =
    recommendedFrames.length === 0 || catalogViewMode === "all"
      ? allFrames
      : recommendedFrames;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
      <div className={`lg:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm p-6 flex flex-col ${isFullscreen ? "p-0 border-none" : ""}`}>
        <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-2">
          <div>
            <h3 className="font-bold text-slate-800 text-base">AR Mirror Canvas</h3>
            <p className="text-xs text-slate-500 mt-0.5">Live 3D virtual try-on with AI facial landmark alignment.</p>
          </div>
          <div className="flex items-center gap-2">
            {/* AI Metric Fit vs Fast Mode Toggle Button */}
            <button
              type="button"
              onClick={() => setEnableMetricFit(!enableMetricFit)}
              className={`px-3 py-2 rounded-xl text-xs font-bold shadow-sm transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 border ${
                enableMetricFit
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 hover:bg-emerald-500/20"
                  : "bg-amber-500/10 border-amber-500/30 text-amber-700 hover:bg-amber-500/20"
              }`}
              title={enableMetricFit ? "Click to switch to Fast Fit Mode (bypasses Iris/PD)" : "Click to switch to AI Metric Fit (calibrated PD)"}
            >
              <span className={`w-2 h-2 rounded-full ${enableMetricFit ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`}></span>
              <span>{enableMetricFit ? "AI Metric Fit: ON" : "⚡ Fast Fit: ON"}</span>
            </button>

            {/* Maximize / Fullscreen Button */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="px-3.5 py-2 rounded-xl text-xs font-bold shadow-sm transition-all active:scale-95 cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 flex items-center gap-1.5"
              title={isFullscreen ? "Exit Fullscreen" : "Maximize Camera Window"}
            >
              {isFullscreen ? (
                <>
                  <svg className="w-3.5 h-3.5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9L4 4m0 0l5 0m-5 0l0 5m6 6l5 5m0 0l-5 0m5 0l0-5" />
                  </svg>
                  <span>Normal View</span>
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                  <span>Maximize</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setUseCamera(!useCamera);
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all active:scale-95 cursor-pointer ${useCamera ? "bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200" : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
            >
              {useCamera ? "Close Camera" : "Open Webcam"}
            </button>
          </div>
        </div>

        <div
          ref={mirrorContainerRef}
          className={`relative w-full bg-slate-950 rounded-2xl my-2 flex items-center justify-center overflow-hidden border border-slate-900 shadow-inner transition-all ${
            isFullscreen
              ? "fixed inset-0 z-50 rounded-none border-none bg-[#0b0f19] h-screen w-screen flex flex-col justify-center"
              : "min-h-[580px] md:min-h-[640px] lg:min-h-[680px] h-[640px] lg:h-[700px]"
          }`}
        >
          {useCamera && (
            <video ref={videoRef} autoPlay playsInline muted className="hidden" />
          )}

          {useCamera ? (
            <canvas ref={canvasRef} className="w-full h-full object-cover" />
          ) : (
            <div className="text-center p-6 text-slate-500 select-none">
              <svg className="w-20 h-20 mx-auto mb-3 text-slate-700 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm font-semibold text-slate-400">Webcam Inactive</p>
              <p className="text-xs text-slate-600 mt-1">Open the webcam to start face shape check and live 3D try-on</p>
            </div>
          )}

          {useCamera && !isMeasured && !isAnalyzing && (
            <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_#10b981] animate-[sweep_2.5s_infinite_ease-in-out] pointer-events-none"></div>
          )}

          {isAnalyzing && (
            <div className="absolute inset-0 bg-blue-900/40 backdrop-blur-[1px] flex flex-col items-center justify-center text-white space-y-3 z-20">
              <div className="w-12 h-12 rounded-full border-4 border-blue-200 border-t-blue-500 animate-spin"></div>
              <p className="text-xs font-bold tracking-wider animate-pulse uppercase">MediaPipe Analyzing Face Geometry...</p>
            </div>
          )}

          {/* Real-time AI Metric Calibration HUD */}
          {useCamera && isMeasured && (
            <div className="absolute top-3 left-3 z-30 bg-slate-900/85 backdrop-blur-md border border-slate-700/60 px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-2 shadow-lg transition-all">
              {enableMetricFit && metricData.isCalibrated ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="text-emerald-400">AI Metric Fit</span>
                  <span className="text-slate-600">|</span>
                  <span className="text-slate-300">PD: <strong className="text-emerald-300">{metricData.pdMm} mm</strong></span>
                  <span className="text-slate-600">|</span>
                  <span className="text-slate-400 text-[9px]">Scale: {selectedFrame?.scaleMultiplier ? `${selectedFrame.scaleMultiplier.toFixed(2)}x` : '1.00x'}</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  <span className="text-amber-300">⚡ Fast Fit Mode</span>
                  <span className="text-slate-600">|</span>
                  <span className="text-slate-400 text-[9px]">Scale: {selectedFrame?.scaleMultiplier ? `${selectedFrame.scaleMultiplier.toFixed(2)}x` : '1.00x'}</span>
                </>
              )}
            </div>
          )}

          {selectedFrame && isMeasured && !isAnalyzing && useCamera && (
            <TryOnCanvas3D
              landmarksRef={landmarksRef}
              modelPath={selectedFrame.glbUrl || selectedFrame.modelUrl}
              isMirrored={useCamera}
              onMetricUpdate={setMetricData}
              frameWidthMm={138}
              enableIrisMetric={enableMetricFit}
              calibration={{
                scaleMultiplier: selectedFrame.scaleMultiplier,
                xOffset: selectedFrame.xOffset,
                yOffset: selectedFrame.yOffset,
                zOffset: selectedFrame.zOffset,
                rotationX: selectedFrame.rotationX,
                rotationY: selectedFrame.rotationY,
                rotationZ: selectedFrame.rotationZ
              }}
            />
          )}
        </div>

        {useCamera && !isMeasured && !isAnalyzing && (
          <button
            onClick={handleMeasure}
            className="w-full mb-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl py-3.5 shadow-lg border border-emerald-500 hover:scale-[1.01] active:scale-95 transition-all cursor-pointer font-bold text-xs flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Measure Face Geometry
          </button>
        )}

        <style dangerouslySetInnerHTML={{
          __html: `
          @keyframes sweep {
            0% { top: 20%; }
            50% { top: 75%; }
            100% { top: 20%; }
          }
        `}} />
      </div>

      <div className="space-y-6">
        {faceShape ? (() => {
          const rule = WORLD_OPTICAL_RULES[faceShape.toLowerCase()] || WORLD_OPTICAL_RULES.round;
          return (
            <div className="bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 border border-emerald-500/40 rounded-3xl p-6 text-white shadow-xl space-y-4 animate-[popupFadeUp_0.3s_ease] relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

              {/* Header Badges */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-sm">
                  <span>✨</span> AI Face Shape: {faceShape}
                </span>
                <span className="bg-blue-500/20 text-cyan-300 border border-blue-400/30 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
                  WCO & AOA Standard
                </span>
              </div>

              {/* Optical Principle */}
              <div>
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-emerald-400 mb-1">
                  Optical Principle: {rule.principle}
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  <strong className="text-white">Facial Profile:</strong> {rule.characteristic}
                </p>
              </div>

              {/* Optical Rationale */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5">
                <p className="text-xs text-slate-200 leading-relaxed font-medium">
                  <span className="text-emerald-300 font-bold">Why these frames? </span>
                  {rule.rationale}
                </p>
              </div>

              {/* Recommended vs Avoid badges */}
              <div className="space-y-2 pt-1 border-t border-white/10">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 shrink-0">
                    Recommended Shapes:
                  </span>
                  {rule.recommendedShapes.map((s) => (
                    <span
                      key={s}
                      className="px-2 py-0.5 text-[10px] font-bold rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    >
                      ✓ {s}
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 shrink-0">
                    Shapes to Avoid:
                  </span>
                  {rule.avoidShapes.map((s) => (
                    <span
                      key={s}
                      className="px-2 py-0.5 text-[10px] font-bold rounded-lg bg-red-500/10 text-red-300 border border-red-500/20"
                    >
                      ✕ {s}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );
        })() : (
          <div className="bg-slate-100 border border-slate-200/60 rounded-3xl p-5 text-slate-600 text-xs text-center space-y-1">
            <p className="font-bold text-slate-700">No Recommendations Loaded</p>
            <p className="text-slate-400">Align your face inside the green guide and click "Measure Face Geometry" to scan.</p>
          </div>
        )}

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-wrap justify-between items-center border-b border-slate-100 pb-3 gap-2">
            <div className="flex items-center gap-2">
              {recommendedFrames.length > 0 ? (
                <>
                  <button
                    type="button"
                    onClick={() => setCatalogViewMode("recommended")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      catalogViewMode === "recommended"
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    Best Fit ({recommendedFrames.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCatalogViewMode("all")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      catalogViewMode === "all"
                        ? "bg-slate-900 text-white shadow-sm"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    All Frames ({allFrames.length})
                  </button>
                </>
              ) : (
                <h3 className="font-bold text-slate-800 text-sm">
                  All Available Frames ({allFrames.length})
                </h3>
              )}
            </div>

            {recommendedFrames.length > 0 && (
              <button
                type="button"
                onClick={handleClearFilter}
                className="text-[10px] text-blue-600 hover:underline font-bold cursor-pointer"
              >
                Clear Filter
              </button>
            )}
          </div>
          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {currentDisplayCatalog.map((frame) => {
              const recommended = isFrameRecommended(frame);
              return (
                <button
                  key={frame.id}
                  onClick={() => setSelectedFrame(frame)}
                  className={`w-full flex items-center justify-between p-4 rounded-xl border text-left transition-all ${selectedFrame?.id === frame.id
                    ? "border-blue-500 bg-blue-50/40 text-blue-900 shadow-sm"
                    : "border-slate-100 bg-slate-50/50 hover:bg-slate-50 text-slate-700"
                    }`}
                >
                  <div className="overflow-hidden pr-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-xs truncate max-w-[120px]">{frame.name}</span>
                      {recommended && (
                        <span className="px-1.5 py-0.5 text-[8px] bg-emerald-500 text-white rounded font-bold uppercase tracking-wider">
                          Best Fit
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium">{frame.color} ({frame.type})</span>
                  </div>
                  <span className="text-xs font-bold text-blue-600 shrink-0">{frame.price}</span>
                </button>
              );
            })}
          </div>

          <button
            onClick={handlePlaceOrder}
            className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl text-xs transition-all shadow-md active:scale-95 cursor-pointer text-center"
          >
            Add Selected Frame to Order
          </button>
        </div>
      </div>

      {/* Seamless In-Dashboard Checkout Customizer Modal */}
      {isCheckoutOpen && (
        <CheckoutCustomizerModal
          isOpen={isCheckoutOpen}
          onClose={() => setIsCheckoutOpen(false)}
          cart={checkoutCart}
          onOrderSuccess={() => {
            setIsCheckoutOpen(false);
            if (onOrderPlaced) onOrderPlaced();
            if (setActiveTab) setActiveTab("orders");
          }}
          onClearCart={() => setCheckoutCart([])}
        />
      )}
    </div>
  );
}

// ----------------------------------------------------
// 3. PRESCRIPTION OCR PANEL
// ----------------------------------------------------
function OCRPanel({ profile, setProfile, onPrescriptionUploaded }) {
  const [file, setFile] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [modalState, setModalState] = useState(null);
  const fileInputRef = useRef(null);

  const handleValChange = (eye, field, val) => {
    setScanResult(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        [eye]: {
          ...prev[eye],
          [field]: val
        }
      };
    });
  };

  const handleDirectChange = (field, val) => {
    setScanResult(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        [field]: val
      };
    });
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = async (selectedFile) => {
    setFile(selectedFile);
    setIsScanning(true);
    setScanResult(null);

    const token = localStorage.getItem("token");
    if (!token) {
      setModalState({
        type: "error",
        title: "Sign In Required",
        message: "Please log in to your account to scan prescription documents."
      });
      setIsScanning(false);
      return;
    }

    const formData = new FormData();
    formData.append("prescription", selectedFile);

    try {
      const response = await fetch(`${API_BASE_URL}/api/prescriptions/scan`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        },
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to scan prescription.");
      }

      const data = await response.json();
      setScanResult(data);
    } catch (err) {
      console.error("Prescription scan error:", err);
      setModalState({
        type: "error",
        title: "Scan Failed",
        message: err.message || "Unable to read prescription image. Please ensure the document is clear and well-lit."
      });
      setFile(null);
    } finally {
      setIsScanning(false);
    }
  };

  const applyScanToProfile = async () => {
    if (scanResult) {
      const token = localStorage.getItem("token");
      if (!token) {
        setModalState({
          type: "error",
          title: "Session Expired",
          message: "Your session has expired. Please log in again to save your prescription."
        });
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/api/prescriptions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({
            odSph: scanResult.od?.sphere ? parseFloat(scanResult.od.sphere) : null,
            odCyl: scanResult.od?.cyl ? parseFloat(scanResult.od.cyl) : null,
            odAxis: scanResult.od?.axis ? parseInt(scanResult.od.axis) : null,
            osSph: scanResult.os?.sphere ? parseFloat(scanResult.os.sphere) : null,
            osCyl: scanResult.os?.cyl ? parseFloat(scanResult.os.cyl) : null,
            osAxis: scanResult.os?.axis ? parseInt(scanResult.os.axis) : null,
            pd: scanResult.pd ? parseFloat(scanResult.pd) : null,
            rawOcrResult: `Digitized Scanner Report. Doctor: ${scanResult.doctor || 'Unknown'}`,
            ocrImageUrl: scanResult.imageUrl || null
          })
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || "Failed to submit prescription validation request.");
        }

        if (onPrescriptionUploaded) {
          await onPrescriptionUploaded();
        }

        setModalState({
          type: "success",
          title: "Prescription Submitted",
          message: "Success! Prescription validation request submitted. An optician will review and verify your parameters shortly."
        });
        setFile(null);
        setScanResult(null);
      } catch (err) {
        console.error("Prescription upload error:", err);
        setModalState({
          type: "error",
          title: "Submission Error",
          message: err.message || "Failed to submit prescription validation request. Please try again."
        });
      }
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Upload Zone */}
      <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between min-h-[450px]">
        <div>
          <h3 className="font-bold text-slate-800">Prescription OCR Scanner</h3>
          <p className="text-xs text-slate-500">Upload handwritten or printed optical reports to digitize them using AI OCR technology</p>
        </div>

        {/* Drag Drop Area */}
        <div
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current.click()}
          className="relative border-2 border-dashed border-slate-200 hover:border-blue-400 hover:bg-blue-50/10 rounded-2xl my-6 flex flex-col items-center justify-center p-8 text-center cursor-pointer transition-all min-h-64 overflow-hidden"
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept="image/*,application/pdf"
          />

          {isScanning ? (
            <div className="space-y-4">
              {/* Custom scanning animation line */}
              <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-cyan-400 to-blue-500 animate-[bounce_2s_infinite] shadow-[0_0_12px_rgba(0,170,255,0.8)]"></div>
              <svg className="w-16 h-16 text-blue-500 mx-auto animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h4 className="font-bold text-slate-700 animate-pulse text-sm">Processing Document...</h4>
              <p className="text-xs text-slate-400 max-w-sm">AI is reading text parameters, axis positions, and sphere measurements...</p>
            </div>
          ) : file ? (
            <div className="space-y-3">
              <div className="w-14 h-14 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto shadow-sm">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h4 className="font-bold text-slate-700 text-sm truncate max-w-xs">{file.name}</h4>
              <p className="text-xs text-emerald-500 font-semibold">Ready to re-upload if necessary</p>
            </div>
          ) : (
            <div className="space-y-3 text-slate-500">
              <svg className="w-16 h-16 text-slate-300 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <div>
                <h4 className="font-bold text-slate-700 text-sm">Drag and drop file here</h4>
                <p className="text-xs text-slate-400 mt-1">Supports PDF, JPEG, or PNG formats up to 5MB</p>
              </div>
            </div>
          )}
        </div>

        <p className="text-[11px] text-slate-400">
          * Note: AI OCR scanning works as a supportive tool. Extracted data should always be cross-referenced with your doctor's official slip before checkout.
        </p>
      </div>

      {/* OCR Outputs / Suggestions panel */}
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-800 text-base border-b border-slate-100 pb-3">Extracted Values</h3>
          {scanResult ? (
            <div className="space-y-4">
              <div className="space-y-3 bg-slate-50 p-4.5 rounded-xl border border-slate-200/60 text-xs">
                <div className="grid grid-cols-4 gap-2 text-slate-400 font-extrabold text-xs uppercase tracking-wider pb-1.5 border-b border-slate-200">
                  <span className="text-left">Eye</span>
                  <span className="text-center">SPH</span>
                  <span className="text-center">CYL</span>
                  <span className="text-right">Axis</span>
                </div>
                <div className="grid grid-cols-4 gap-2 items-center py-1">
                  <span className="text-left font-bold text-slate-700 text-xs md:text-sm">Right (OD)</span>
                  <input
                    type="text"
                    value={scanResult.od?.sphere || ""}
                    onChange={(e) => handleValChange('od', 'sphere', e.target.value)}
                    placeholder="SPH"
                    className="w-full text-center px-1.5 py-1.5 border border-slate-300 rounded text-xs md:text-sm font-bold text-slate-900 focus:outline-none focus:border-blue-600 bg-white"
                  />
                  <input
                    type="text"
                    value={scanResult.od?.cyl || ""}
                    onChange={(e) => handleValChange('od', 'cyl', e.target.value)}
                    placeholder="CYL"
                    className="w-full text-center px-1.5 py-1.5 border border-slate-300 rounded text-xs md:text-sm font-bold text-slate-900 focus:outline-none focus:border-blue-600 bg-white"
                  />
                  <input
                    type="text"
                    value={scanResult.od?.axis || ""}
                    onChange={(e) => handleValChange('od', 'axis', e.target.value)}
                    placeholder="Axis"
                    className="w-full text-center px-1.5 py-1.5 border border-slate-300 rounded text-xs md:text-sm font-bold text-slate-900 focus:outline-none focus:border-blue-600 bg-white"
                  />
                </div>
                <div className="grid grid-cols-4 gap-2 items-center py-1 border-b border-slate-200 pb-2.5">
                  <span className="text-left font-bold text-slate-700 text-xs md:text-sm">Left (OS)</span>
                  <input
                    type="text"
                    value={scanResult.os?.sphere || ""}
                    onChange={(e) => handleValChange('os', 'sphere', e.target.value)}
                    placeholder="SPH"
                    className="w-full text-center px-1.5 py-1.5 border border-slate-300 rounded text-xs md:text-sm font-bold text-slate-900 focus:outline-none focus:border-blue-600 bg-white"
                  />
                  <input
                    type="text"
                    value={scanResult.os?.cyl || ""}
                    onChange={(e) => handleValChange('os', 'cyl', e.target.value)}
                    placeholder="CYL"
                    className="w-full text-center px-1.5 py-1.5 border border-slate-300 rounded text-xs md:text-sm font-bold text-slate-900 focus:outline-none focus:border-blue-600 bg-white"
                  />
                  <input
                    type="text"
                    value={scanResult.os?.axis || ""}
                    onChange={(e) => handleValChange('os', 'axis', e.target.value)}
                    placeholder="Axis"
                    className="w-full text-center px-1.5 py-1.5 border border-slate-300 rounded text-xs md:text-sm font-bold text-slate-900 focus:outline-none focus:border-blue-600 bg-white"
                  />
                </div>
                <div className="flex justify-between items-center pt-1.5 text-slate-800">
                  <span className="text-slate-500 font-bold text-xs md:text-sm">PD (Dist):</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={scanResult.pd || ""}
                      onChange={(e) => handleDirectChange('pd', e.target.value)}
                      placeholder="63"
                      className="w-16 text-center px-1.5 py-1 border border-slate-300 rounded text-xs md:text-sm font-bold text-slate-900 focus:outline-none focus:border-blue-600 bg-white"
                    />
                    <span className="text-xs font-bold text-slate-400">mm</span>
                  </div>
                </div>
                <div className="flex justify-between items-center pt-1.5 text-slate-800 border-t border-slate-100">
                  <span className="text-slate-500 font-bold text-xs md:text-sm">Doctor:</span>
                  <input
                    type="text"
                    value={scanResult.doctor || ""}
                    onChange={(e) => handleDirectChange('doctor', e.target.value)}
                    placeholder="Dr. Name"
                    className="w-36 text-right px-2 py-1 border border-slate-300 rounded text-xs md:text-sm font-bold text-slate-900 focus:outline-none focus:border-blue-600 bg-white"
                  />
                </div>
              </div>

              {/* Suggestions */}
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs space-y-1">
                <h5 className="font-bold text-blue-800">AI Lens Suggestions:</h5>
                <p className="text-blue-700 leading-relaxed font-medium">
                  High-Index (1.61) or Polycarbonate lenses are suggested due to astigmatic corrections to prevent frame edge thickness.
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={applyScanToProfile}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-xs transition-all cursor-pointer text-center"
                >
                  Save to Profile
                </button>
                <button
                  onClick={() => alert("Downloading PDF document report...")}
                  className="px-3 border border-slate-200 hover:bg-slate-50 rounded-xl transition-all cursor-pointer"
                >
                  <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4-4v12" />
                  </svg>
                </button>
              </div>
            </div>
          ) : profile.glassesPrescription ? (
            <div className="space-y-4 animate-[fadeIn_0.3s_ease]">
              <div className="bg-slate-50 p-4.5 rounded-xl border border-slate-200/60 space-y-3.5">
                <div className="flex justify-between items-center pb-2.5 border-b border-slate-200/60 mb-2">
                  <span className="font-extrabold text-slate-700 text-xs uppercase tracking-wider">VERIFICATION STATUS</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm border ${profile.glassesPrescription.status === "PENDING" ? "bg-amber-50 text-amber-700 border-amber-200" :
                      profile.glassesPrescription.status === "REJECTED" ? "bg-rose-50 text-rose-700 border-rose-200" :
                        "bg-emerald-50 text-emerald-700 border-emerald-200"
                    }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${profile.glassesPrescription.status === "PENDING" ? "bg-amber-500 animate-pulse" :
                        profile.glassesPrescription.status === "REJECTED" ? "bg-rose-500" :
                          "bg-emerald-500"
                      }`} />
                    {profile.glassesPrescription.status === "PENDING" ? "Pending Review" :
                      profile.glassesPrescription.status === "REJECTED" ? "Rejected" : "Validated"}
                  </span>
                </div>

                {profile.glassesPrescription.status === "REJECTED" && (
                  <div className="text-xs text-rose-700 font-semibold leading-relaxed bg-rose-50 p-2.5 rounded-lg border border-rose-100 space-y-1">
                    <p>⚠️ The optician rejected this prescription slip. Please upload a clearer image of your doctor's slip.</p>
                    {profile.glassesPrescription.rejectionReason && (
                      <p className="border-t border-rose-200/50 pt-1 text-rose-800">
                        <strong>Reason:</strong> {profile.glassesPrescription.rejectionReason}
                      </p>
                    )}
                  </div>
                )}
                {profile.glassesPrescription.status === "PENDING" && (
                  <p className="text-xs text-amber-700 font-semibold leading-relaxed bg-amber-50/50 p-2.5 rounded-lg border border-amber-100">
                    ⏳ Validation pending. An optician is reviewing your uploaded slip.
                  </p>
                )}
                {profile.glassesPrescription.status === "VALIDATED" && (
                  <p className="text-xs text-emerald-700 font-semibold leading-relaxed bg-emerald-50/50 p-2.5 rounded-lg border border-emerald-100">
                    ✅ Validated. You can use these values for frame checkouts!
                  </p>
                )}

                <div className="grid grid-cols-4 gap-2 text-slate-400 font-extrabold text-xs uppercase tracking-wider pb-1 border-b border-slate-200/70">
                  <span className="text-left">Eye</span>
                  <span className="text-center">SPH</span>
                  <span className="text-center">CYL</span>
                  <span className="text-right">Axis</span>
                </div>
                <div className="grid grid-cols-4 gap-2 font-black text-slate-900 text-sm md:text-base py-1 items-center">
                  <span className="text-left text-xs md:text-sm font-bold text-slate-800">Right (OD)</span>
                  <span className="text-center font-mono font-black text-slate-900">{profile.glassesPrescription.od.sphere}</span>
                  <span className="text-center font-mono font-black text-slate-900">{profile.glassesPrescription.od.cyl}</span>
                  <span className="text-right font-mono font-black text-slate-900">{profile.glassesPrescription.od.axis !== "-" ? `${profile.glassesPrescription.od.axis}°` : "-"}</span>
                </div>
                <div className="grid grid-cols-4 gap-2 font-black text-slate-900 text-sm md:text-base py-1 items-center border-b border-slate-200 pb-2">
                  <span className="text-left text-xs md:text-sm font-bold text-slate-800">Left (OS)</span>
                  <span className="text-center font-mono font-black text-slate-900">{profile.glassesPrescription.os.sphere}</span>
                  <span className="text-center font-mono font-black text-slate-900">{profile.glassesPrescription.os.cyl}</span>
                  <span className="text-right font-mono font-black text-slate-900">{profile.glassesPrescription.os.axis !== "-" ? `${profile.glassesPrescription.os.axis}°` : "-"}</span>
                </div>
                <div className="flex justify-between items-center pt-1.5">
                  <span className="text-slate-400 font-extrabold text-xs md:text-sm">PD:</span>
                  <span className="font-black text-slate-900 text-sm md:text-base font-mono">{profile.glassesPrescription.pd !== "-" ? `${profile.glassesPrescription.pd} mm` : "-"}</span>
                </div>
                <div className="flex justify-between items-center pt-1.5 border-t border-slate-200/60">
                  <span className="text-slate-400 font-extrabold text-xs md:text-sm">Doctor:</span>
                  <span className="font-black text-slate-900 text-sm md:text-base">
                    {profile.glassesPrescription.doctor && profile.glassesPrescription.doctor !== "Verified Scanner"
                      ? profile.glassesPrescription.doctor
                      : "Dr. Nayanagama"}
                  </span>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 text-center italic">
                To update, upload a new slip in the scanner zone.
              </p>
            </div>
          ) : (
            <div className="text-center p-8 text-slate-400 space-y-2">
              <svg className="w-12 h-12 text-slate-200 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-xs">Extracted data will display here after scanning completes.</p>
            </div>
          )}
        </div>
      </div>

      {/* Professional In-App Feedback Modal */}
      {modalState && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease]">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-100 text-center animate-in fade-in zoom-in duration-200">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 border shadow-sm ${
              modalState.type === 'error'
                ? 'bg-rose-50 text-rose-600 border-rose-100 shadow-rose-500/10'
                : 'bg-emerald-50 text-emerald-600 border-emerald-100 shadow-emerald-500/10'
            }`}>
              {modalState.type === 'error' ? (
                <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              ) : (
                <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            
            <span className={`text-[11px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-full inline-block mb-2 ${
              modalState.type === 'error' 
                ? 'bg-rose-100 text-rose-700' 
                : 'bg-emerald-100 text-emerald-700'
            }`}>
              {modalState.type === 'error' ? 'Notice' : 'Confirmation'}
            </span>

            <h3 className="text-xl font-extrabold text-slate-900 mb-2">
              {modalState.title}
            </h3>
            
            <p className="text-slate-500 text-sm mb-6 leading-relaxed font-medium">
              {modalState.message}
            </p>

            <button
              onClick={() => setModalState(null)}
              className={`w-full py-3.5 px-4 font-bold rounded-xl shadow-lg transition-all cursor-pointer text-sm text-white ${
                modalState.type === 'error'
                  ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/25 active:scale-98'
                  : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/25 active:scale-98'
              }`}
            >
              {modalState.type === 'error' ? 'Dismiss' : 'Continue'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------
// 4. APPOINTMENT SCHEDULER PANEL
// ----------------------------------------------------
function AppointmentPanel() {
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth()); // 0-indexed month
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [selectedStore, setSelectedStore] = useState("Giriulla Branch");
  const [selectedService, setSelectedService] = useState("Cataract Surgery");
  const [appointments, setAppointments] = useState([]);
  const [bookedSlots, setBookedSlots] = useState([]);
  const [isBooked, setIsBooked] = useState(false);
  const [loading, setLoading] = useState(false);

  const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const monthDates = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();

  const timeslots = ["09:00 AM", "10:00 AM", "11:30 AM", "01:30 PM", "03:00 PM", "04:30 PM"];

  const handlePrevMonth = () => {
    const todayVal = new Date();
    if (currentYear < todayVal.getFullYear() || (currentYear === todayVal.getFullYear() && currentMonth <= todayVal.getMonth())) {
      return;
    }
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
    setSelectedDate(null);
    setSelectedSlot("");
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
    setSelectedDate(null);
    setSelectedSlot("");
  };

  const servicesList = [
    "Cataract Surgery",
    "Ocular Oncology",
    "Glaucoma Treatment",
    "Vision Correction",
    "Retina Treatment",
    "Cornea Surgery",
    "Pediatric Eye Care",
    "Dry Eye Treatment"
  ];

  const formatUtcToSlot = (dateTimeStr) => {
    const d = new Date(dateTimeStr);
    let hours = d.getUTCHours();
    const minutes = d.getUTCMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const minStr = String(minutes).padStart(2, '0');
    const hourWithZero = String(hours).padStart(2, '0');
    return `${hourWithZero}:${minStr} ${ampm}`;
  };

  const parseNotesMetadata = (notes) => {
    if (!notes) return { reason: "Standard Eye Exam", location: "Giriulla Branch" };
    const locationMatch = notes.match(/Location:\s*([^|]+)/);
    const typeMatch = notes.match(/Type:\s*([^|]+)/);
    return {
      location: locationMatch ? locationMatch[1].trim() : "Giriulla Branch",
      reason: typeMatch ? typeMatch[1].trim() : "Standard Eye Exam"
    };
  };

  const fetchAppointments = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/appointments`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        const mapped = data.map(apt => {
          const meta = parseNotesMetadata(apt.notes);
          return {
            id: apt.id.substring(0, 8).toUpperCase(),
            date: apt.dateTime.split('T')[0],
            time: formatUtcToSlot(apt.dateTime),
            location: meta.location,
            reason: meta.reason,
            status: apt.status
          };
        });
        setAppointments(mapped);
      }
    } catch (err) {
      console.error("Error fetching appointments:", err);
    }
  };

  const fetchBookedSlots = async (dateVal) => {
    const token = localStorage.getItem("token");
    if (!token || !dateVal) return;

    const pad = (n) => String(n).padStart(2, '0');
    const dateStr = `${currentYear}-${pad(currentMonth + 1)}-${pad(dateVal)}`;
    try {
      const response = await fetch(`${API_BASE_URL}/api/appointments/booked?date=${dateStr}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setBookedSlots(data);
      }
    } catch (err) {
      console.error("Error fetching booked slots:", err);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, []);

  useEffect(() => {
    if (selectedDate) {
      setSelectedSlot("");
      fetchBookedSlots(selectedDate);
    }
  }, [selectedDate]);

  const handleBook = async () => {
    if (!selectedDate || !selectedSlot) {
      alert("Please choose a date and time slot first.");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      alert("Session expired. Please log in again.");
      return;
    }

    const pad = (n) => String(n).padStart(2, '0');
    const dateStr = `${currentYear}-${pad(currentMonth + 1)}-${pad(selectedDate)}`;
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/appointments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          date: dateStr,
          time: selectedSlot,
          type: selectedService,
          location: selectedStore,
          notes: ""
        })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to book appointment.");
      }

      setIsBooked(true);
      setSelectedSlot("");
      fetchAppointments();
      fetchBookedSlots(selectedDate);
    } catch (err) {
      console.error(err);
      alert(`Error scheduling: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Calendar widget */}
      <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5">
        <div>
          <h3 className="font-bold text-slate-800">Select Date & Time</h3>
          <p className="text-xs text-slate-500">Pick a convenient schedule for your eye exam test</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Location</label>
            <div className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-700 font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Giriulla Branch
            </div>
          </div>
          <div className="flex-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Select Service</label>
            <select
              value={selectedService}
              onChange={(e) => setSelectedService(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-700 outline-none focus:ring-1 focus:ring-blue-500"
            >
              {servicesList.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="space-y-3">
          <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-200/60">
            <button
              onClick={handlePrevMonth}
              disabled={currentYear === today.getFullYear() && currentMonth === today.getMonth()}
              className="p-1.5 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-all text-slate-500 hover:text-slate-800 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:border-transparent cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              {MONTH_NAMES[currentMonth]} {currentYear}
            </h4>
            <button
              onClick={handleNextMonth}
              className="p-1.5 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-all text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          <div className="grid grid-cols-7 gap-2 text-center text-xs">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(d => (
              <span key={d} className="font-bold text-slate-400 py-1">{d}</span>
            ))}
            {/* Blank cells for alignment */}
            {Array.from({ length: firstDayIndex }).map((_, i) => (
              <span key={`empty-${i}`} className="py-2"></span>
            ))}
            {monthDates.map(date => {
              const active = selectedDate === date;
              
              const todayVal = new Date();
              const todayYear = todayVal.getFullYear();
              const todayMonth = todayVal.getMonth();
              const todayDay = todayVal.getDate();
              
              let isPast = false;
              if (currentYear < todayYear) {
                isPast = true;
              } else if (currentYear === todayYear) {
                if (currentMonth < todayMonth) {
                  isPast = true;
                } else if (currentMonth === todayMonth) {
                  isPast = date < todayDay;
                }
              }

              return (
                <button
                  key={date}
                  disabled={isPast}
                  onClick={() => setSelectedDate(date)}
                  className={`py-2 rounded-lg font-semibold transition-all ${
                    isPast
                      ? "text-slate-300 bg-slate-50/50 cursor-not-allowed opacity-40 line-through"
                      : active
                        ? "bg-blue-600 text-white font-bold cursor-pointer"
                        : "text-slate-700 hover:bg-slate-100 cursor-pointer"
                  }`}
                >
                  {date}
                </button>
              );
            })}
          </div>
        </div>

        {/* Time slot grid */}
        {selectedDate && (
          <div className="space-y-2 animate-[popupFadeUp_0.3s_ease]">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Available Hours</h4>
            <div className="grid grid-cols-3 gap-2">
              {timeslots.map(slot => {
                const isTaken = bookedSlots.includes(slot);
                return (
                  <button
                    key={slot}
                    disabled={isTaken}
                    onClick={() => setSelectedSlot(slot)}
                    className={`py-2.5 rounded-xl text-xs font-medium border text-center transition-all ${isTaken
                        ? "bg-slate-100 text-slate-400 border-slate-200 line-through cursor-not-allowed opacity-50"
                        : selectedSlot === slot
                          ? "border-blue-600 bg-blue-50 text-blue-800 font-bold cursor-pointer"
                          : "border-slate-150 hover:bg-slate-50 text-slate-700 cursor-pointer"
                      }`}
                  >
                    {slot}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <button
          onClick={handleBook}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl text-sm transition-all shadow-md active:scale-95 cursor-pointer disabled:opacity-50"
        >
          {loading ? "Scheduling..." : "Request Appointment Confirmation"}
        </button>
      </div>

      {/* Upcoming / Receipts panel */}
      <div className="space-y-6">
        {isBooked && (
          <div className="bg-emerald-500 rounded-3xl p-5 text-white shadow-md space-y-3 animate-[popupFadeUp_0.3s_ease]">
            <div className="flex items-center gap-2">
              <span className="bg-white/20 p-1.5 rounded-full">✓</span>
              <h4 className="font-bold text-sm">Booking Request Sent</h4>
            </div>
            <p className="text-xs text-emerald-100">
              We saved your appointment request in the system. An optician will review and confirm it shortly.
            </p>
            <button
              onClick={() => setIsBooked(false)}
              className="w-full bg-white text-emerald-700 font-bold py-2 rounded-xl text-xs cursor-pointer hover:bg-slate-50 transition-all"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <h3 className="font-bold text-slate-800">Upcoming Schedules</h3>
            <button
              onClick={fetchAppointments}
              className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-1 rounded-md font-bold transition-all"
            >
              Refresh
            </button>
          </div>
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
            {appointments.map((apt) => (
              <div key={apt.id} className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-slate-800">{apt.reason}</p>
                    <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[9px] font-bold ${apt.status === "CONFIRMED" ? "bg-emerald-50 text-emerald-700 border border-emerald-100" :
                        apt.status === "PENDING" ? "bg-amber-50 text-amber-700 border border-amber-100" :
                          apt.status === "CANCELLED" ? "bg-rose-50 text-rose-700 border border-rose-100" :
                            "bg-slate-100 text-slate-600 border border-slate-200"
                      }`}>
                      {apt.status}
                    </span>
                  </div>
                  <span className="text-slate-400 font-semibold">{apt.id}</span>
                </div>
                <div className="text-slate-600 space-y-1 pt-1 border-t border-slate-100/60">
                  <p className="flex items-center gap-1.5">
                    📅 {apt.date} at {apt.time}
                  </p>
                  <p className="flex items-center gap-1.5">
                    📍 {apt.location}
                  </p>
                </div>
              </div>
            ))}
            {appointments.length === 0 && (
              <p className="text-center text-slate-400 text-xs py-8">No scheduled appointments.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// 5. MY ORDERS PANEL
// ----------------------------------------------------
function OrdersPanel({ orders, profile, onOrderCancelled }) {
  const [selectedOrder, setSelectedOrder] = useState(null);

  useEffect(() => {
    if (orders && orders.length > 0) {
      if (!selectedOrder || !orders.some(o => o.id === selectedOrder.id)) {
        setSelectedOrder(orders[0]);
      } else {
        const updated = orders.find(o => o.id === selectedOrder.id);
        if (updated) setSelectedOrder(updated);
      }
    } else {
      setSelectedOrder(null);
    }
  }, [orders]);

  const handleCancelOrder = async () => {
    if (!selectedOrder || !selectedOrder.rawId) {
      alert("Order reference not found.");
      return;
    }
    const confirmCancel = window.confirm("Are you sure you want to cancel this order? This will restore stock levels.");
    if (!confirmCancel) return;

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        alert("Session expired. Please log in.");
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/orders/${selectedOrder.rawId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to cancel order.");
      }

      alert("Order cancelled successfully!");
      if (onOrderCancelled) {
        await onOrderCancelled();
      }
    } catch (err) {
      console.error(err);
      alert(`Error cancelling order: ${err.message}`);
    }
  };

  const handleDownloadPDF = () => {
    if (!selectedOrder) return;

    try {
      const doc = new jsPDF();

      // Page styling / Color Palette
      const primaryColor = [30, 41, 59]; // Slate 800
      const secondaryColor = [71, 85, 105]; // Slate 600
      const accentColor = [59, 130, 246]; // Blue 500
      const lightGray = [241, 245, 249]; // Slate 100

      // Header Banner
      doc.setFillColor(...primaryColor);
      doc.rect(0, 0, 210, 35, 'F');

      // Logo and Brand Name
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(255, 255, 255);
      doc.text("NETHMINI OPTICALS", 20, 22);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(148, 163, 184); // light gray text
      doc.text("Smart Optical Care, Simplified", 20, 28);

      // Invoice Info (Right Aligned)
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("OFFICIAL RECEIPT", 140, 18);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(203, 213, 225);
      doc.text(`Receipt ID: ${selectedOrder.id}`, 140, 24);
      doc.text(`Date: ${selectedOrder.date}`, 140, 29);

      // Reset text color
      doc.setTextColor(...primaryColor);

      // Client Information Section
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("Delivery & Billing Details:", 20, 50);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      const billName = selectedOrder.recipientName || profile?.name || "Customer";
      const billPhone = selectedOrder.recipientPhone || profile?.phone || "None provided";
      const billAddress = selectedOrder.shippingAddress || "In-Store Pickup";
      doc.text(`Recipient: ${billName}`, 20, 55);
      doc.text(`Phone: ${billPhone}`, 20, 60);
      doc.text(`Address: ${billAddress.substring(0, 45)}${billAddress.length > 45 ? "..." : ""}`, 20, 65);

      // Store Info (Right side)
      doc.setFont("helvetica", "bold");
      doc.text("Merchant:", 120, 50);
      doc.setFont("helvetica", "normal");
      doc.text("Nethmini Opticals", 120, 56);
      doc.text("Giriulla Branch", 120, 62);
      doc.text("Giriulla, Sri Lanka", 120, 68);

      // Divider Line
      doc.setDrawColor(226, 232, 240);
      doc.line(20, 75, 190, 75);

      // Order Details Section
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("Order Summary", 20, 85);

      // Table Header
      doc.setFillColor(...lightGray);
      doc.rect(20, 92, 170, 8, 'F');

      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...secondaryColor);
      doc.text("Description", 25, 97.5);
      doc.text("Qty", 130, 97.5);
      doc.text("Unit Price", 150, 97.5);
      doc.text("Total", 175, 97.5);

      // Table Content
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...primaryColor);

      let yPos = 108;
      selectedOrder.items?.forEach((item, idx) => {
        if (idx > 0) {
          doc.setDrawColor(241, 245, 249);
          doc.line(20, yPos - 5, 190, yPos - 5);
        }

        doc.setFont("helvetica", "bold");
        doc.text(item.frame?.name || "Eyeglasses Frame", 25, yPos);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...secondaryColor);
        
        let lensType = item.lens?.type ? `Lens: ${item.lens.type}` : "Eyeglasses Frame Only";
        doc.text(lensType, 25, yPos + 4.5);
        
        doc.setTextColor(...primaryColor);
        doc.text(String(item.quantity), 132, yPos);
        
        const priceNum = item.price || 0;
        const formattedPrice = `LKR ${priceNum.toLocaleString()}`;
        const formattedTotal = `LKR ${(priceNum * item.quantity).toLocaleString()}`;
        
        doc.text(formattedPrice, 150, yPos);
        doc.text(formattedTotal, 175, yPos);

        yPos += 14;
      });

      // Total Calculation Box
      doc.setDrawColor(226, 232, 240);
      doc.line(20, yPos + 1, 190, yPos + 1);

      const itemsTotalVal = selectedOrder.items?.reduce((tot, it) => tot + (it.price * it.quantity), 0) || 0;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("Items Subtotal:", 132, yPos + 10);
      doc.text(`LKR ${itemsTotalVal.toLocaleString()}`, 175, yPos + 10);

      doc.text("Shipping Fee:", 132, yPos + 16);
      doc.text(selectedOrder.shippingCost > 0 ? `LKR ${selectedOrder.shippingCost.toLocaleString()}` : "LKR 0 (FREE)", 175, yPos + 16);

      doc.text("Payment Option:", 132, yPos + 22);
      doc.text(String(selectedOrder.paymentMethod || "COD"), 175, yPos + 22);

      // Total amount line
      doc.setFillColor(...lightGray);
      doc.rect(130, yPos + 26, 60, 8, 'F');
      doc.setFontSize(11);
      doc.setTextColor(...accentColor);
      doc.text("Grand Total:", 132, yPos + 31.5);
      doc.text(selectedOrder.price, 165, yPos + 31.5);

      // Footer and Terms
      doc.setTextColor(...secondaryColor);
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "normal");
      doc.text("Thank you for your order! If you have any questions, please contact our support team.", 20, 185);
      doc.text("NethminiOpticals - Dedicated to professional visual care.", 20, 190);

      // Add decorative bottom accent bar
      doc.setFillColor(...accentColor);
      doc.rect(0, 287, 210, 10, 'F');

      doc.save(`receipt-${selectedOrder.id}.pdf`);
    } catch (err) {
      console.error("PDF Generation failed:", err);
      alert("Error generating receipt PDF. Please try again.");
    }
  };

  if (!orders || orders.length === 0) {
    return (
      <div className="bg-white p-12 rounded-3xl border border-slate-200 shadow-sm text-center flex flex-col items-center justify-center space-y-4">
        <div className="w-20 h-20 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center shadow-inner">
          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
          </svg>
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-slate-800">No Orders Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            You don't have any purchase history or ongoing shipments with NethminiOpticals.
          </p>
        </div>
        <p className="text-xs text-slate-400">
          Try out some frames in our AR Virtual mirror to place an order!
        </p>
      </div>
    );
  }

  if (!selectedOrder) {
    return (
      <div className="min-h-[200px] flex items-center justify-center text-slate-400 text-xs">
        Loading order details...
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Orders List */}
      <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5">
        <div>
          <h3 className="font-bold text-slate-800">Order Listings</h3>
          <p className="text-xs text-slate-500">View current shipments and your completed purchases history</p>
        </div>

        <div className="space-y-3">
          {orders.map((order) => {
            const frameSummary = order.items?.map(item => item.frame?.name || "Eyeglasses Frame").join(", ") || "Eyeglasses Package";
            const itemSummaryText = frameSummary.length > 35 ? `${frameSummary.substring(0, 35)}...` : frameSummary;
            return (
              <button
                key={order.id}
                onClick={() => setSelectedOrder(order)}
                className={`w-full text-left p-5 rounded-2xl border transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4 cursor-pointer ${selectedOrder.id === order.id
                  ? "border-blue-500 bg-blue-50/10 shadow-sm"
                  : "border-slate-100 bg-slate-50/20 hover:bg-slate-50"
                  }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-800">{itemSummaryText}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        order.status?.toUpperCase() === "COMPLETED"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : (order.status?.toUpperCase() === "ON_HOLD" || order.status === "On Hold")
                            ? "bg-amber-50 text-amber-800 border border-amber-300 font-bold"
                            : order.status?.toUpperCase() === "CANCELLED"
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : "bg-blue-50 text-blue-700 border border-blue-200"
                      }`}>
                      {order.status === "ON_HOLD" ? "On Hold" : order.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Date: {order.date} | {order.items?.length || 0} {order.items?.length === 1 ? "item" : "items"}
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  <span className="font-bold text-sm text-slate-800">{order.price}</span>
                  <span className="text-blue-600 text-xs font-bold group-hover:translate-x-1 transition-transform">Details →</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Details Status Timeline panel */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5">
        <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
          <h3 className="font-bold text-slate-800">Order Details</h3>
          <span className="text-xs font-bold text-blue-650">{selectedOrder.id}</span>
        </div>

        <div className="space-y-4">
          {/* On Hold notice banner */}
          {(selectedOrder.status === "On Hold" || selectedOrder.status?.toUpperCase() === "ON_HOLD") && (
            <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 text-xs space-y-1.5 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shrink-0"></span>
                <span className="font-extrabold uppercase tracking-wider text-[11px] text-amber-800">Order Action Notice: On Hold</span>
              </div>
              <p className="text-xs text-amber-950 font-bold">
                Reason: {selectedOrder.holdReason || "Prescription or fitting clarification required by the optical team."}
              </p>
              <p className="text-[11px] text-amber-700 leading-relaxed">
                Our optician will contact you shortly if additional details are required. Your order will resume fulfillment as soon as this is verified.
              </p>
            </div>
          )}

          {/* Cancelled notice banner */}
          {(selectedOrder.status === "Cancelled" || selectedOrder.status?.toUpperCase() === "CANCELLED") && (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-xs space-y-1.5 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0"></span>
                <span className="font-extrabold uppercase tracking-wider text-[11px] text-rose-800">Order Cancelled</span>
              </div>
              {selectedOrder.cancelReason && (
                <p className="text-xs text-rose-950 font-bold">
                  Reason: {selectedOrder.cancelReason}
                </p>
              )}
              <p className="text-[11px] text-rose-700 leading-relaxed">
                This order was cancelled. Feel free to contact our clinic team if you have questions or wish to place a new order.
              </p>
            </div>
          )}

          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Eyewear Package ({selectedOrder.items?.length || 0} items)</h4>
            <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
              {selectedOrder.items?.map((item, idx) => (
                <div key={idx} className="p-4 bg-slate-50 border border-slate-200/60 rounded-2xl space-y-1.5 shadow-sm">
                  <p className="text-base font-extrabold text-slate-900">{item.frame?.name || "Eyeglasses Frame"}</p>
                  <p className="text-xs md:text-sm text-slate-600 font-semibold leading-relaxed">
                    <span className="text-slate-400">Lens:</span> {item.lens?.type || "None selected"} <span className="text-slate-300">·</span> <span className="text-slate-400">Qty:</span> {item.quantity} <span className="text-slate-300">·</span> <span className="text-slate-400">Price:</span> LKR {item.price?.toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-2 space-y-4">
            <h4 className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Delivery Timeline</h4>
            <div className="space-y-4">
              {selectedOrder.timeline.map((step, idx) => (
                <div key={idx} className="flex gap-4 items-start relative">
                  {idx < selectedOrder.timeline.length - 1 && (
                    <div
                      className={`absolute left-3.5 top-7 bottom-0 w-0.5 -ml-px ${step.status === "completed" ? "bg-blue-500" : "bg-slate-200"
                        }`}
                    ></div>
                  )}
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 border-2 font-bold text-xs ${
                      step.isHold
                        ? "bg-amber-500 border-amber-500 text-white ring-4 ring-amber-100"
                        : step.status === "completed"
                          ? "bg-blue-50 border-blue-500 text-blue-600"
                          : step.status === "active"
                            ? "bg-amber-50 border-amber-500 text-amber-600 ring-4 ring-amber-100"
                            : "bg-slate-50 border-slate-200 text-slate-400"
                      }`}
                  >
                    {step.isHold ? "!" : step.status === "completed" ? "✓" : idx + 1}
                  </div>
                  <div className="pt-0.5">
                    <p className="text-xs font-semibold text-slate-800">{step.label}</p>
                    <p className="text-[10px] text-slate-400">{step.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Shipping & Payment Details Section */}
          <div className="pt-4 border-t border-slate-100 space-y-3">
            <h4 className="text-xs font-bold text-slate-450 uppercase tracking-wider font-sans">Shipping & Payment</h4>
            
            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
              <div>
                <span className="text-slate-450 block font-semibold text-[10px] uppercase font-sans">Recipient</span>
                <span className="font-extrabold text-slate-800 block mt-0.5">{selectedOrder.recipientName || profile?.name || "Customer"}</span>
                {selectedOrder.recipientPhone && (
                  <span className="text-slate-500 text-[10px] block mt-0.5 font-mono">{selectedOrder.recipientPhone}</span>
                )}
              </div>
              <div>
                <span className="text-slate-450 block font-semibold text-[10px] uppercase font-sans">Payment Status</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold mt-1 font-sans ${
                  selectedOrder.paymentStatus === "PAID"
                    ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                    : selectedOrder.paymentStatus === "FAILED"
                      ? "bg-rose-50 text-rose-600 border border-rose-200"
                      : "bg-amber-50 text-amber-600 border border-amber-200"
                }`}>
                  {selectedOrder.paymentStatus || "PENDING"} ({selectedOrder.paymentMethod || "COD"})
                </span>
              </div>
            </div>

            {selectedOrder.shippingAddress && (
              <div className="text-xs bg-slate-50 p-3.5 rounded-2xl border border-slate-100 space-y-1">
                <span className="text-slate-450 block font-semibold text-[10px] uppercase font-sans">Delivery Address</span>
                <span className="text-slate-700 block leading-normal">{selectedOrder.shippingAddress}</span>
                <span className="text-slate-500 text-[10px] block mt-1 font-sans">Shipping Cost: {selectedOrder.shippingCost > 0 ? `LKR ${selectedOrder.shippingCost.toLocaleString()}` : "FREE SHIPPING"}</span>
              </div>
            )}

            {selectedOrder.courierName && (
              <div className="text-xs bg-blue-50/40 p-3.5 rounded-2xl border border-blue-100 space-y-1">
                <span className="text-blue-600 block font-bold text-[10px] uppercase font-sans">Courier Dispatch</span>
                <p className="text-slate-800 font-extrabold">{selectedOrder.courierName}</p>
                {selectedOrder.trackingNumber && (
                  <p className="font-mono text-slate-500 text-[10px] mt-0.5">Tracking Number: <span className="text-slate-900 font-bold select-all">{selectedOrder.trackingNumber}</span></p>
                )}
              </div>
            )}
          </div>

          <button
            onClick={handleDownloadPDF}
            className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
          >
            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Download Receipt PDF
          </button>

          {selectedOrder.status === "PENDING" && (
            <button
              onClick={handleCancelOrder}
              className="w-full mt-2 bg-rose-50 hover:bg-rose-100/80 border border-rose-200 text-rose-700 font-bold py-2.5 rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 animate-[fadeIn_0.3s_ease]"
            >
              <svg className="w-4 h-4 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Cancel Order
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// 6. CHAT SUPPORT PANEL
// ----------------------------------------------------
// 6. CLINICAL OPTICAL CHAT & TELE-CONSULTATION PANEL
// ----------------------------------------------------
function ChatPanel({ profile }) {
  const [activeChatTab, setActiveChatTab] = useState("ai"); // "ai" | "optician"

  // --- AI Clinical Assistant State ---
  const [aiMessages, setAiMessages] = useState([
    {
      sender: "ai",
      text: `Hello ${profile?.name ? profile.name.split(' ')[0] : 'there'}! I am your InsightOpticals AI Clinical Assistant. I can analyze your prescription, recommend the ideal lens index (1.50 to 1.74), explain optical parameters, or provide eye health guidance. How may I assist your vision care today?`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [hasRedFlag, setHasRedFlag] = useState(false);

  // --- Optician Persistent Chat State ---
  const [opticianMessages, setOpticianMessages] = useState([]);
  const [opticianInput, setOpticianInput] = useState("");
  const [opticianLoading, setOpticianLoading] = useState(false);
  const [opticianSending, setOpticianSending] = useState(false);

  const aiChatEndRef = useRef(null);
  const opticianChatEndRef = useRef(null);

  // Scroll helpers
  useEffect(() => {
    if (activeChatTab === "ai") {
      aiChatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    } else {
      opticianChatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [aiMessages, opticianMessages, activeChatTab]);

  // Fetch persistent messages from database for Optician tab
  const fetchOpticianMessages = async (silent = false) => {
    const token = localStorage.getItem("token");
    if (!token) return;
    if (!silent) setOpticianLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/chat/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setOpticianMessages(data);
      }
    } catch (err) {
      console.error("Failed to load optician messages:", err);
    } finally {
      if (!silent) setOpticianLoading(false);
    }
  };

  useEffect(() => {
    fetchOpticianMessages();
    const interval = setInterval(() => {
      fetchOpticianMessages(true);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  // Send message to Gemini AI Clinical Assistant
  const handleSendAi = async (messageText) => {
    const textToSend = typeof messageText === "string" ? messageText : aiInput;
    if (!textToSend || !textToSend.trim() || aiLoading) return;

    const userMsg = {
      sender: "user",
      text: textToSend.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setAiMessages((prev) => [...prev, userMsg]);
    setAiInput("");
    setAiLoading(true);

    // Red flag triage detection
    const emergencyKeywords = ["pain", "flashes", "flashing", "curtain", "shadow", "floaters", "sudden loss", "blind", "chemical"];
    const isEmergency = emergencyKeywords.some((kw) => textToSend.toLowerCase().includes(kw));
    if (isEmergency) {
      setHasRedFlag(true);
    }

    try {
      const token = localStorage.getItem("token");
      const conversationHistory = aiMessages.map((m) => ({
        role: m.sender === "user" ? "user" : "model",
        text: m.text,
      }));

      const res = await fetch(`${API_BASE_URL}/api/chat/ai`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: textToSend.trim(),
          conversationHistory,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setAiMessages((prev) => [
          ...prev,
          {
            sender: "ai",
            text: data.reply,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      } else {
        const errData = await res.json().catch(() => ({}));
        setAiMessages((prev) => [
          ...prev,
          {
            sender: "ai",
            text: errData.error || "I am momentarily unavailable. You can reach out directly to our optician staff in the 'Ask Licensed Optician' tab.",
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      }
    } catch (err) {
      console.error("AI chat error:", err);
      setAiMessages((prev) => [
        ...prev,
        {
          sender: "ai",
          text: "Network error communicating with clinical AI. Please try again or message our clinic staff directly.",
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setAiLoading(false);
    }
  };

  // Send message to Licensed Opticians (Database persistent)
  const handleSendOptician = async (e) => {
    if (e) e.preventDefault();
    if (!opticianInput.trim() || opticianSending) return;

    const token = localStorage.getItem("token");
    if (!token) {
      alert("Please log in to contact our optician team.");
      return;
    }

    const sendingText = opticianInput.trim();
    setOpticianSending(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/chat/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: sendingText }),
      });

      if (res.ok) {
        const savedMsg = await res.json();
        setOpticianMessages((prev) => [...prev, savedMsg]);
        setOpticianInput("");
      } else {
        alert("Failed to deliver message to optician. Please try again.");
      }
    } catch (err) {
      console.error("Optician chat error:", err);
      alert("Network error sending consultation message.");
    } finally {
      setOpticianSending(false);
    }
  };

  // Preset chips for AI
  const promptChips = [
    "Explain my prescription (OD, OS, SPH, CYL)",
    "Which lens index (1.56, 1.61, 1.67) should I choose?",
    "Do I need blue-light filter for computer work?",
    "What are progressive vs bifocal lenses?",
    "Emergency ocular symptoms triage",
    "මගේ prescription එක සිංහලෙන් පහදන්න (Explain in Sinhala)",
  ];

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col h-[640px] overflow-hidden">
      {/* Header & Tabs */}
      <div className="px-6 py-4 bg-slate-900 text-white flex flex-col sm:flex-row justify-between sm:items-center gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm shadow ${
            activeChatTab === "ai" ? "bg-cyan-400 text-slate-900" : "bg-blue-600 text-white"
          }`}>
            {activeChatTab === "ai" ? "AI" : "Dr"}
          </div>
          <div>
            <h4 className="font-extrabold text-sm tracking-tight flex items-center gap-2">
              <span>{activeChatTab === "ai" ? "AI Clinical Vision Assistant" : "Optician Tele-Consultation"}</span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping"></span>
                Active
              </span>
            </h4>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {activeChatTab === "ai"
                ? "24/7 Evidence-based lens recommendations & prescription explanation"
                : "Direct messaging with Dr. Sarah Perera & InsightOpticals clinical staff"}
            </p>
          </div>
        </div>

        {/* Dual Tab Switcher */}
        <div className="flex bg-slate-800 p-1 rounded-2xl border border-slate-700 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveChatTab("ai")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeChatTab === "ai"
                ? "bg-cyan-500 text-slate-950 shadow"
                : "text-slate-300 hover:text-white"
            }`}
          >
            <span>AI Assistant</span>
            <span className="text-[9px] bg-slate-900/30 px-1.5 py-0.2 rounded font-black">24/7</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveChatTab("optician")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeChatTab === "optician"
                ? "bg-blue-600 text-white shadow"
                : "text-slate-300 hover:text-white"
            }`}
          >
            <span>Ask Licensed Optician</span>
            {opticianMessages.filter((m) => m.senderRole === "OPTICIAN" && !m.isRead).length > 0 && (
              <span className="text-[9px] bg-rose-500 text-white px-1.5 py-0.2 rounded-full font-black">
                New
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Red-flag Emergency Alert Banner */}
      {hasRedFlag && (
        <div className="bg-rose-50 border-b border-rose-200 px-6 py-2.5 flex items-center justify-between text-xs text-rose-800 animate-in fade-in shrink-0">
          <div className="flex items-center gap-2 font-medium">
            <span className="font-extrabold text-rose-600 uppercase tracking-wider text-[10px] bg-rose-200/70 px-1.5 py-0.5 rounded">Emergency Triage Alert</span>
            <span>If you are experiencing sudden vision loss, dark shadows, or severe pain, visit an emergency eye unit immediately.</span>
          </div>
          <button
            onClick={() => setHasRedFlag(false)}
            className="text-rose-500 hover:text-rose-800 text-xs font-bold cursor-pointer ml-3"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* TAB 1: AI CLINICAL VISION ASSISTANT */}
      {activeChatTab === "ai" && (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Prescription Context Pill */}
          <div className="px-6 py-2 bg-cyan-50/70 border-b border-cyan-100 flex items-center justify-between text-xs text-cyan-900 shrink-0">
            <div className="flex items-center gap-2 text-[11px]">
              <span className="font-bold text-cyan-800">Connected to your profile:</span>
              {profile?.glassesPrescription?.od ? (
                <span className="font-mono bg-white px-2 py-0.5 rounded border border-cyan-200">
                  OD: {profile.glassesPrescription.od.sphere} / OS: {profile.glassesPrescription.os.sphere} (PD: {profile.glassesPrescription.pd || 63}mm)
                </span>
              ) : (
                <span className="text-slate-500 italic">No prescription on file</span>
              )}
            </div>
            <span className="text-[10px] text-cyan-700 font-semibold hidden md:inline">
              ISO 13666 Optical Compliance
            </span>
          </div>

          {/* AI Messages Container */}
          <div className="flex-1 p-6 space-y-4 overflow-y-auto bg-slate-50/60">
            {aiMessages.map((msg, idx) => {
              const isUser = msg.sender === "user";
              return (
                <div
                  key={idx}
                  className={`flex ${isUser ? "justify-end" : "justify-start"} animate-in fade-in duration-150`}
                >
                  <div
                    className={`max-w-xs md:max-w-xl rounded-2xl p-4 text-xs shadow-sm space-y-1.5 ${
                      isUser
                        ? "bg-cyan-600 text-white rounded-tr-none"
                        : "bg-white text-slate-800 rounded-tl-none border border-slate-200"
                    }`}
                  >
                    {!isUser && (
                      <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-1 mb-1">
                        <span className="text-[10px] font-extrabold text-cyan-700 uppercase tracking-wide">
                          AI Clinical Guidance
                        </span>
                        <span className="text-[9px] text-slate-400">{msg.time}</span>
                      </div>
                    )}
                    <div className="leading-relaxed font-medium whitespace-pre-wrap">{msg.text}</div>
                    {isUser && (
                      <span className="block text-[9px] text-right text-cyan-100">{msg.time}</span>
                    )}
                  </div>
                </div>
              );
            })}

            {aiLoading && (
              <div className="flex justify-start animate-pulse">
                <div className="bg-white border border-slate-200 text-slate-500 rounded-2xl rounded-tl-none p-3.5 text-xs flex items-center gap-2">
                  <div className="w-2 h-2 bg-cyan-600 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-cyan-600 rounded-full animate-bounce delay-100"></div>
                  <div className="w-2 h-2 bg-cyan-600 rounded-full animate-bounce delay-200"></div>
                  <span className="font-semibold text-slate-600 text-[11px]">Analyzing clinical parameters...</span>
                </div>
              </div>
            )}
            <div ref={aiChatEndRef} />
          </div>

          {/* Prompt Chips */}
          <div className="px-6 py-2 bg-white border-t border-slate-100 flex items-center gap-2 overflow-x-auto text-[11px] shrink-0">
            <span className="text-slate-400 font-bold shrink-0 text-[10px] uppercase tracking-wider">Suggested:</span>
            {promptChips.map((chip, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSendAi(chip)}
                className="px-2.5 py-1 bg-slate-100 hover:bg-cyan-50 hover:text-cyan-800 border border-slate-200 rounded-lg text-slate-700 font-medium shrink-0 cursor-pointer transition-colors"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* AI Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendAi();
            }}
            className="p-4 border-t border-slate-200 bg-white flex gap-3 shrink-0"
          >
            <input
              type="text"
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              placeholder="Ask about your eye power, recommended lens index, anti-glare coatings..."
              className="flex-1 bg-slate-50 hover:bg-slate-100/50 border border-slate-200 focus:border-cyan-500 rounded-xl px-4 py-3 text-xs text-slate-800 outline-none transition-colors"
            />
            <button
              type="submit"
              disabled={aiLoading || !aiInput.trim()}
              className="bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white font-bold px-6 py-3 rounded-xl text-xs transition-all active:scale-95 cursor-pointer shadow flex items-center gap-1.5"
            >
              <span>Ask AI</span>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </form>
        </div>
      )}

      {/* TAB 2: ASK LICENSED OPTICIAN (PERSISTENT CLINIC THREAD) */}
      {activeChatTab === "optician" && (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Clinical Banner */}
          <div className="px-6 py-2.5 bg-blue-50/80 border-b border-blue-100 flex items-center justify-between text-xs text-blue-900 shrink-0">
            <div className="flex items-center gap-2">
              <span className="font-bold">Clinic Tele-Consultation:</span>
              <span className="text-[11px] text-blue-800">
                Messages are directly reviewed by our in-clinic licensed opticians with access to your prescription history.
              </span>
            </div>
            <span className="text-[10px] bg-blue-100 text-blue-800 font-extrabold px-2 py-0.5 rounded">
              Giriulla Branch
            </span>
          </div>

          {/* Optician Messages Area */}
          <div className="flex-1 p-6 space-y-4 overflow-y-auto bg-slate-50/60">
            {opticianLoading && opticianMessages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-2"></div>
                Connecting to optician consultation history...
              </div>
            ) : opticianMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center p-6">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <h4 className="font-bold text-slate-700 text-sm">No consultation messages yet</h4>
                <p className="text-xs text-slate-500 max-w-sm mt-1">
                  Send a message below to ask Dr. Sarah or our optical team about custom frame fitting, lab edging status, or prescription adjustments.
                </p>
              </div>
            ) : (
              opticianMessages.map((msg) => {
                const isUser = msg.senderRole === "PATIENT";
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isUser ? "justify-end" : "justify-start"} animate-in fade-in duration-150`}
                  >
                    <div
                      className={`max-w-xs md:max-w-xl rounded-2xl p-4 text-xs shadow-sm space-y-1.5 ${
                        isUser
                          ? "bg-blue-600 text-white rounded-tr-none"
                          : "bg-white text-slate-800 rounded-tl-none border border-slate-200"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3 text-[10px] pb-1 border-b border-black/5">
                        <span className={`font-bold ${isUser ? "text-blue-100" : "text-blue-600"}`}>
                          {isUser ? "You" : `Optician (${msg.senderName})`}
                        </span>
                        <span className={isUser ? "text-blue-200" : "text-slate-400"}>
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="leading-relaxed font-medium whitespace-pre-wrap">{msg.message}</p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={opticianChatEndRef} />
          </div>

          {/* Optician Input Form */}
          <form onSubmit={handleSendOptician} className="p-4 border-t border-slate-200 bg-white flex gap-3 shrink-0">
            <input
              type="text"
              value={opticianInput}
              onChange={(e) => setOpticianInput(e.target.value)}
              placeholder="Type your message to the optician team..."
              className="flex-1 bg-slate-50 hover:bg-slate-100/50 border border-slate-200 focus:border-blue-500 rounded-xl px-4 py-3 text-xs text-slate-800 outline-none transition-colors"
            />
            <button
              type="submit"
              disabled={opticianSending || !opticianInput.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold px-6 py-3 rounded-xl text-xs transition-all active:scale-95 cursor-pointer shadow flex items-center gap-1.5"
            >
              {opticianSending ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <span>Send</span>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </>
              )}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------
// 7. PROFILE SETTINGS & SECURITY PANEL
// ----------------------------------------------------
function SettingsPanel({ profile, setProfile }) {
  const [formData, setFormData] = useState({ ...profile });

  // Standard password change state
  const [pwdForm, setPwdForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdError, setPwdError] = useState(null);
  const [pwdSuccess, setPwdSuccess] = useState(null);

  // Forgot password OTP recovery state
  const [isForgotMode, setIsForgotMode] = useState(false);
  const [forgotOtp, setForgotOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpSending, setOtpSending] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    if (formData.phone && formData.phone.trim().length > 0 && formData.phone.trim().length !== 10) {
      alert("Please enter a valid 10-digit mobile number (e.g., 07XXXXXXXX).");
      return;
    }
    try {
      const token = localStorage.getItem("token");
      if (token) {
        await fetch(`${API_BASE_URL}/api/auth/profile`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            fullName: formData.name,
            phoneNumber: formData.phone,
          }),
        });
      }
      setProfile(formData);
      alert("Account settings updated successfully.");
    } catch (err) {
      console.error("Failed to update profile:", err);
      setProfile(formData);
      alert("Account settings updated successfully.");
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPwdError(null);
    setPwdSuccess(null);

    if (!pwdForm.currentPassword || !pwdForm.newPassword || !pwdForm.confirmPassword) {
      setPwdError("All password fields are required.");
      return;
    }

    if (pwdForm.newPassword.length < 6) {
      setPwdError("New password must be at least 6 characters long.");
      return;
    }

    if (pwdForm.newPassword !== pwdForm.confirmPassword) {
      setPwdError("New password and confirmation password do not match.");
      return;
    }

    setPwdLoading(true);

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE_URL}/api/auth/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword: pwdForm.currentPassword,
          newPassword: pwdForm.newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update password.");
      }

      setPwdSuccess("Your password has been changed successfully.");
      setPwdForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (err) {
      setPwdError(err.message || "Failed to change password.");
    } finally {
      setPwdLoading(false);
    }
  };

  const handleSendOtp = async () => {
    setPwdError(null);
    setPwdSuccess(null);
    const targetEmail = formData.email || profile.email;

    if (!targetEmail || !targetEmail.includes("@")) {
      setPwdError("A valid account email address is required to receive the verification code.");
      return;
    }

    setOtpSending(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send verification code.");
      }

      setOtpSent(true);
      setPwdSuccess(`A 6-digit verification code has been dispatched to ${targetEmail}.`);
    } catch (err) {
      setPwdError(err.message || "Failed to send verification code.");
    } finally {
      setOtpSending(false);
    }
  };

  const handleOtpResetPassword = async (e) => {
    e.preventDefault();
    setPwdError(null);
    setPwdSuccess(null);

    const targetEmail = formData.email || profile.email;

    if (!forgotOtp.trim()) {
      setPwdError("Please enter the 6-digit verification code sent to your email.");
      return;
    }

    if (!pwdForm.newPassword || pwdForm.newPassword.length < 6) {
      setPwdError("New password must be at least 6 characters long.");
      return;
    }

    if (pwdForm.newPassword !== pwdForm.confirmPassword) {
      setPwdError("New password and confirmation password do not match.");
      return;
    }

    setPwdLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: targetEmail.trim(),
          otp: forgotOtp.trim(),
          newPassword: pwdForm.newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to reset password.");
      }

      setPwdSuccess("Your password has been successfully reset. You can now use your new password.");
      setPwdForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setForgotOtp("");
      setOtpSent(false);
      setIsForgotMode(false);
    } catch (err) {
      setPwdError(err.message || "Failed to reset password.");
    } finally {
      setPwdLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-2xl">
      {/* 1. Account Credentials Form */}
      <div className="bg-white p-8 rounded-2xl border border-slate-200/90 shadow-sm">
        <div className="border-b border-slate-100 pb-4 mb-6">
          <h3 className="text-base font-bold text-slate-900 tracking-tight">Account Credentials</h3>
          <p className="text-xs text-slate-500 mt-1">Personal profile information and primary clinic preferences</p>
        </div>

        <form onSubmit={handleSave} className="space-y-5 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-slate-700 font-semibold mb-1.5">Full Name</label>
              <input
                type="text"
                value={formData.name || ""}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-slate-50/70 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 font-medium outline-none focus:bg-white focus:border-[#1b5e85] focus:ring-1 focus:ring-[#1b5e85] transition-all"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-slate-700 font-semibold">Email Address</label>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                  🔒 Primary ID (Read-only)
                </span>
              </div>
              <input
                type="email"
                value={formData.email || ""}
                readOnly
                disabled
                className="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-500 font-medium cursor-not-allowed select-none outline-none"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Linked to your login & medical records. Contact clinic support to change.
              </p>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1.5">Phone Number</label>
              <input
                type="tel"
                value={formData.phone || ""}
                maxLength={10}
                placeholder="0771234567"
                onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                className="w-full bg-slate-50/70 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 font-medium outline-none focus:bg-white focus:border-[#1b5e85] focus:ring-1 focus:ring-[#1b5e85] transition-all"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1.5">Date of Birth</label>
              <input
                type="date"
                value={formData.dob || ""}
                onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                className="w-full bg-slate-50/70 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 font-medium outline-none focus:bg-white focus:border-[#1b5e85] focus:ring-1 focus:ring-[#1b5e85] transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1.5">Preferred Pickup Store</label>
            <select
              value={formData.preferredStore || "Nethmini Opticals - Giriulla Branch"}
              onChange={(e) => setFormData({ ...formData, preferredStore: e.target.value })}
              className="w-full bg-slate-50/70 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 font-medium outline-none focus:bg-white focus:border-[#1b5e85] focus:ring-1 focus:ring-[#1b5e85] transition-all"
            >
              <option>Nethmini Opticals - Giriulla Branch</option>
            </select>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="bg-[#1b5e85] hover:bg-[#154d70] text-white font-semibold px-6 py-2.5 rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer text-xs"
            >
              Save Account Settings
            </button>
          </div>
        </form>
      </div>

      {/* 2. Security & Password Form */}
      <div className="bg-white p-8 rounded-2xl border border-slate-200/90 shadow-sm">
        <div className="border-b border-slate-100 pb-4 mb-6">
          <h3 className="text-base font-bold text-slate-900 tracking-tight">Security & Password</h3>
          <p className="text-xs text-slate-500 mt-1">
            {isForgotMode
              ? "Reset your password securely via email verification code"
              : "Change your password or manage credentials"}
          </p>
        </div>

        {/* Clean Professional Status Messages (No emojis or decorative icons) */}
        {pwdError && (
          <div className="mb-5 py-2.5 px-4 bg-rose-50 border-l-4 border-rose-500 rounded-r-lg text-rose-800 text-xs font-medium">
            {pwdError}
          </div>
        )}

        {pwdSuccess && (
          <div className="mb-5 py-2.5 px-4 bg-emerald-50 border-l-4 border-emerald-500 rounded-r-lg text-emerald-800 text-xs font-medium">
            {pwdSuccess}
          </div>
        )}

        {!isForgotMode ? (
          /* Standard Change Password Form */
          <form onSubmit={handlePasswordChange} className="space-y-5 text-xs">
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-slate-700 font-semibold">
                  Current Password <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setIsForgotMode(true);
                    setPwdError(null);
                    setPwdSuccess(null);
                  }}
                  className="text-[11px] font-semibold text-[#1b5e85] hover:text-[#154d70] hover:underline cursor-pointer"
                >
                  Forgot current password?
                </button>
              </div>
              <div className="relative">
                <input
                  type={showCurrentPassword ? "text" : "password"}
                  placeholder="Enter your current password"
                  value={pwdForm.currentPassword}
                  onChange={(e) => setPwdForm({ ...pwdForm, currentPassword: e.target.value })}
                  className="w-full bg-slate-50/70 border border-slate-200 rounded-xl pl-4 pr-11 py-2.5 text-slate-800 font-medium outline-none focus:bg-white focus:border-[#1b5e85] focus:ring-1 focus:ring-[#1b5e85] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  title={showCurrentPassword ? "Hide password" : "Show password"}
                >
                  {showCurrentPassword ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-slate-700 font-semibold mb-1.5">
                  New Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    placeholder="At least 6 characters"
                    value={pwdForm.newPassword}
                    onChange={(e) => setPwdForm({ ...pwdForm, newPassword: e.target.value })}
                    className="w-full bg-slate-50/70 border border-slate-200 rounded-xl pl-4 pr-11 py-2.5 text-slate-800 font-medium outline-none focus:bg-white focus:border-[#1b5e85] focus:ring-1 focus:ring-[#1b5e85] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                    title={showNewPassword ? "Hide password" : "Show password"}
                  >
                    {showNewPassword ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1.5">
                  Confirm New Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Re-enter new password"
                    value={pwdForm.confirmPassword}
                    onChange={(e) => setPwdForm({ ...pwdForm, confirmPassword: e.target.value })}
                    className="w-full bg-slate-50/70 border border-slate-200 rounded-xl pl-4 pr-11 py-2.5 text-slate-800 font-medium outline-none focus:bg-white focus:border-[#1b5e85] focus:ring-1 focus:ring-[#1b5e85] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                    title={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={pwdLoading}
                className="bg-[#1b5e85] hover:bg-[#154d70] text-white font-semibold px-6 py-2.5 rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer disabled:opacity-60 flex items-center gap-2 text-xs"
              >
                {pwdLoading ? (
                  <>
                    <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Updating Password...
                  </>
                ) : (
                  "Update Password"
                )}
              </button>
            </div>
          </form>
        ) : (
          /* Forgot Password OTP Mode */
          <div className="space-y-5 text-xs">
            <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1.5">
              <div className="text-slate-800 font-semibold">Email Verification Recovery</div>
              <p className="text-slate-500 leading-relaxed">
                If you do not recall your current password, request a secure 6-digit verification code sent to{" "}
                <span className="font-semibold text-slate-800">{formData.email || profile.email}</span>.
              </p>
            </div>

            {!otpSent ? (
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={otpSending}
                  className="bg-[#1b5e85] hover:bg-[#154d70] text-white font-semibold px-5 py-2.5 rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer disabled:opacity-60 flex items-center gap-2 text-xs"
                >
                  {otpSending ? (
                    <>
                      <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Sending Code...
                    </>
                  ) : (
                    "Send Verification Code"
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsForgotMode(false);
                    setPwdError(null);
                    setPwdSuccess(null);
                  }}
                  className="px-4 py-2.5 text-slate-600 hover:text-slate-800 font-semibold rounded-xl hover:bg-slate-100 transition-colors cursor-pointer text-xs"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <form onSubmit={handleOtpResetPassword} className="space-y-5">
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-slate-700 font-semibold">
                      6-Digit Verification Code <span className="text-rose-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={otpSending}
                      className="text-[11px] font-semibold text-[#1b5e85] hover:underline cursor-pointer disabled:opacity-50"
                    >
                      Resend code
                    </button>
                  </div>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="Enter 6-digit code"
                    value={forgotOtp}
                    onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, ""))}
                    className="w-full bg-slate-50/70 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 font-bold tracking-widest text-center outline-none focus:bg-white focus:border-[#1b5e85] focus:ring-1 focus:ring-[#1b5e85] transition-all"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1.5">
                      New Password <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? "text" : "password"}
                        placeholder="At least 6 characters"
                        value={pwdForm.newPassword}
                        onChange={(e) => setPwdForm({ ...pwdForm, newPassword: e.target.value })}
                        className="w-full bg-slate-50/70 border border-slate-200 rounded-xl pl-4 pr-11 py-2.5 text-slate-800 font-medium outline-none focus:bg-white focus:border-[#1b5e85] focus:ring-1 focus:ring-[#1b5e85] transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                        title={showNewPassword ? "Hide password" : "Show password"}
                      >
                        {showNewPassword ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1.5">
                      Confirm New Password <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Re-enter new password"
                        value={pwdForm.confirmPassword}
                        onChange={(e) => setPwdForm({ ...pwdForm, confirmPassword: e.target.value })}
                        className="w-full bg-slate-50/70 border border-slate-200 rounded-xl pl-4 pr-11 py-2.5 text-slate-800 font-medium outline-none focus:bg-white focus:border-[#1b5e85] focus:ring-1 focus:ring-[#1b5e85] transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                        title={showConfirmPassword ? "Hide password" : "Show password"}
                      >
                        {showConfirmPassword ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={pwdLoading}
                    className="bg-[#1b5e85] hover:bg-[#154d70] text-white font-semibold px-6 py-2.5 rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer disabled:opacity-60 flex items-center gap-2 text-xs"
                  >
                    {pwdLoading ? (
                      <>
                        <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Verifying...
                      </>
                    ) : (
                      "Verify & Reset Password"
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotMode(false);
                      setOtpSent(false);
                      setForgotOtp("");
                      setPwdError(null);
                      setPwdSuccess(null);
                    }}
                    className="px-4 py-2.5 text-slate-600 hover:text-slate-800 font-semibold rounded-xl hover:bg-slate-100 transition-colors cursor-pointer text-xs"
                  >
                    Back to Standard Change
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
