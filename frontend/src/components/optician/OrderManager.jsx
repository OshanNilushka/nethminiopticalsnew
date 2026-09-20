import { useState, useEffect } from "react";
import { API_BASE_URL } from "../../config/api";

const dbToUiStatus = (status) => {
  switch (status) {
    case "PENDING": return "Pending";
    case "PROCESSING": return "Processing";
    case "ON_HOLD":
    case "HOLD": return "On Hold";
    case "READY_FOR_PICKUP": return "Completed";
    case "SHIPPED":
    case "DELIVERED": return "Delivered";
    case "COMPLETED": return "Completed";
    case "CANCELLED": return "Cancelled";
    default: return status;
  }
};

const uiToDbStatus = (status) => {
  switch (status) {
    case "Pending": return "PENDING";
    case "Processing": return "PROCESSING";
    case "On Hold": return "ON_HOLD";
    case "Delivered": return "DELIVERED";
    case "Completed": return "COMPLETED";
    case "Cancelled": return "CANCELLED";
    default: return status.toUpperCase();
  }
};

const STATUS_OPTIONS = ["Pending", "Processing", "On Hold", "Delivered", "Completed", "Cancelled"];
const QUEUE_FEATURE_LAUNCH = new Date("2026-09-19T11:30:00.000Z").getTime();

const HOLD_PRESETS = [
  "Prescription or Pupillary Distance (PD) verification required",
  "Specialty / high-index lens manufacturing delay",
  "Frame out of stock - awaiting supplier restock",
  "Patient consultation / frame fitting appointment required",
  "Awaiting customer payment / order confirmation",
  "Other (custom reason entered below)",
];

const CANCEL_PRESETS = [
  "Customer requested order cancellation",
  "Prescription out of optical tolerance / cannot fulfill",
  "Customer unresponsive to verification inquiries",
  "Duplicate or erroneous order",
  "Other (custom reason entered below)",
];

// ─── HCI-compliant semantic colour map ────────────────────────────────────────
// Group 1 – Blue  : active / in-progress  (Pending, Processing)
// Group 2 – Amber : warning / on-hold    (On Hold)
// Group 3 – Green : delivery / success    (Delivered, Completed)
// Group 4 – Red   : danger / stopped      (Cancelled)
const UNIFIED_UNSELECTED = "bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100 hover:text-slate-900 hover:border-slate-300";

const statusConfig = {
  "Pending": {
    cls: "bg-blue-50 text-blue-700 border border-blue-200",
    dot: "bg-blue-400",
    unselectedCls: UNIFIED_UNSELECTED,
    selectedCls:   "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/25 ring-2 ring-blue-400/30",
  },
  "Processing": {
    cls: "bg-indigo-50 text-indigo-700 border border-indigo-200",
    dot: "bg-indigo-500",
    unselectedCls: UNIFIED_UNSELECTED,
    selectedCls:   "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/25 ring-2 ring-indigo-400/30",
  },
  "On Hold": {
    cls: "bg-amber-50 text-amber-800 border border-amber-300 font-semibold",
    dot: "bg-amber-500",
    unselectedCls: UNIFIED_UNSELECTED,
    selectedCls:   "bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-400/25 ring-2 ring-amber-400/30",
  },
  "Delivered": {
    cls: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    dot: "bg-emerald-500",
    unselectedCls: UNIFIED_UNSELECTED,
    selectedCls:   "bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-500/25 ring-2 ring-emerald-400/30",
  },
  "Completed": {
    cls: "bg-teal-50 text-teal-800 border border-teal-300 font-extrabold",
    dot: "bg-teal-600",
    unselectedCls: UNIFIED_UNSELECTED,
    selectedCls:   "bg-teal-600 text-white border-teal-600 shadow-md shadow-teal-500/25 ring-2 ring-teal-400/30",
  },
  "Cancelled": {
    cls: "bg-red-50 text-red-700 border border-red-200",
    dot: "bg-red-400",
    unselectedCls: UNIFIED_UNSELECTED,
    selectedCls:   "bg-red-600 text-white border-red-600 shadow-md shadow-red-500/25 ring-2 ring-red-400/30",
  },
};

const priorityConfig = {
  "High":   "bg-red-50 text-red-600 border border-red-200",
  "Normal": "bg-slate-50 text-slate-600 border border-slate-200",
  "Low":    "bg-slate-50 text-slate-400 border border-slate-200",
};

export default function OrderManager() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterStatus, setFilterStatus] = useState("All");
  const [queueFilter, setQueueFilter] = useState("all"); // "all" | "my_orders" | "unassigned"
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [notification, setNotification] = useState(null);
  const [newNote, setNewNote] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [claimLoading, setClaimLoading] = useState(false);

  // Courier/Payment inputs
  const [courierNameInput, setCourierNameInput] = useState("");
  const [trackingNumInput, setTrackingNumInput] = useState("");
  const [paymentStatusInput, setPaymentStatusInput] = useState("PENDING");

  // On Hold Reason modal state
  const [holdModalOpen, setHoldModalOpen] = useState(false);
  const [holdReasonPreset, setHoldReasonPreset] = useState(HOLD_PRESETS[0]);
  const [customHoldReason, setCustomHoldReason] = useState("");

  // Cancellation Reason modal state
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReasonPreset, setCancelReasonPreset] = useState(CANCEL_PRESETS[0]);
  const [customCancelReason, setCustomCancelReason] = useState("");

  // Fetch current user details
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    fetch(`${API_BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.ok ? r.json() : null)
      .then(u => { if (u) setCurrentUser(u); })
      .catch(() => {});
  }, []);

  // Sync inputs on selected order change
  useEffect(() => {
    if (selected) {
      setCourierNameInput(selected.courierName || "");
      setTrackingNumInput(selected.trackingNumber || "");
      setPaymentStatusInput(selected.paymentStatus || "PENDING");
    } else {
      setCourierNameInput("");
      setTrackingNumInput("");
      setPaymentStatusInput("PENDING");
    }
  }, [selected]);

  const notify = (msg) => { setNotification(msg); setTimeout(() => setNotification(null), 3000); };

  const fetchOrders = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/orders`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error("Failed to fetch orders.");

      const data = await response.json();
      const mapped = data.map(o => ({
        id: o.id.substring(0, 8).toUpperCase(),
        rawId: o.id,
        patient: o.patient?.fullName || "Anonymous Patient",
        patientId: o.patientId,
        date: o.createdAt.split('T')[0],
        items: o.items, // Keep all items in order mapping
        price: o.totalAmount,
        status: dbToUiStatus(o.status),
        assignedOptician: o.assignedOptician || null,
        assignedOpticianId: o.assignedOpticianId || null,
        isLegacy: !o.assignedOpticianId && new Date(o.createdAt).getTime() < QUEUE_FEATURE_LAUNCH,
        holdReason: o.holdReason || null,
        cancelReason: o.cancelReason || null,
        priority: "Normal", // Default priority
        prescription: o.prescriptionId ? "Rx Active" : "No Rx Attached",
        notes: "",
        shippingAddress: o.shippingAddress,
        recipientName: o.recipientName,
        recipientPhone: o.recipientPhone,
        shippingCost: o.shippingCost,
        courierName: o.courierName,
        trackingNumber: o.trackingNumber,
        paymentMethod: o.paymentMethod,
        paymentStatus: o.paymentStatus,
      }));

      setOrders(mapped);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setError(err.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const updateStatus = async (rawId, id, status, reason = null) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const dbStatus = uiToDbStatus(status);
      const payload = { status: dbStatus };
      if (reason) payload.reason = reason;
      if (status === "Processing" && selected && !selected.assignedOpticianId && currentUser) {
        payload.assignedOpticianId = currentUser.id;
      }

      const response = await fetch(`${API_BASE_URL}/api/orders/${rawId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to update order status.");
      }

      const resData = await response.json();

      setOrders(prev => prev.map(o => o.id === id ? { 
        ...o, 
        status, 
        ...(payload.assignedOpticianId && {
          assignedOpticianId: currentUser.id,
          assignedOptician: { id: currentUser.id, fullName: currentUser.fullName, email: currentUser.email },
        }),
        ...(status === "Completed" && { paymentStatus: "PAID" }),
        ...(status === "On Hold" && { holdReason: reason }),
        ...(status === "Cancelled" && { cancelReason: reason })
      } : o));

      if (selected?.id === id) {
        setSelected(prev => ({ 
          ...prev, 
          status, 
          ...(payload.assignedOpticianId && {
            assignedOpticianId: currentUser.id,
            assignedOptician: { id: currentUser.id, fullName: currentUser.fullName, email: currentUser.email },
          }),
          ...(status === "Completed" && { paymentStatus: "PAID" }),
          ...(status === "On Hold" && { holdReason: reason }),
          ...(status === "Cancelled" && { cancelReason: reason })
        }));
        if (status === "Completed") {
          setPaymentStatusInput("PAID");
        }
      }
      notify(`Order status updated to "${status}"`);
    } catch (err) {
      console.error(err);
      alert(`Error updating order: ${err.message}`);
    }
  };

  const isLockedByOther = Boolean(
    selected?.assignedOpticianId &&
    currentUser &&
    selected.assignedOpticianId !== currentUser.id &&
    currentUser.role !== "ADMIN"
  );

  const handleStatusClick = (status) => {
    if (isLockedByOther) {
      alert(`This order is locked and claimed by ${selected.assignedOptician?.fullName || 'another optician'}. Actions are restricted to prevent duplicate processing.`);
      return;
    }
    if (status === "On Hold") {
      setHoldReasonPreset(HOLD_PRESETS[0]);
      setCustomHoldReason("");
      setHoldModalOpen(true);
      return;
    }
    if (status === "Cancelled") {
      setCancelReasonPreset(CANCEL_PRESETS[0]);
      setCustomCancelReason("");
      setCancelModalOpen(true);
      return;
    }
    updateStatus(selected.rawId, selected.id, status);
  };

  const handleConfirmHold = async () => {
    const finalReason = holdReasonPreset === "Other (custom reason entered below)"
      ? customHoldReason.trim()
      : customHoldReason.trim()
        ? `${holdReasonPreset} - ${customHoldReason.trim()}`
        : holdReasonPreset;

    if (!finalReason) {
      alert("Please select or enter a reason for placing this order on hold.");
      return;
    }

    setHoldModalOpen(false);
    await updateStatus(selected.rawId, selected.id, "On Hold", finalReason);
  };

  const handleConfirmCancel = async () => {
    const finalReason = cancelReasonPreset === "Other (custom reason entered below)"
      ? customCancelReason.trim()
      : customCancelReason.trim()
        ? `${cancelReasonPreset} - ${customCancelReason.trim()}`
        : cancelReasonPreset;

    if (!finalReason) {
      alert("Please select or enter a reason for cancelling this order.");
      return;
    }

    setCancelModalOpen(false);
    await updateStatus(selected.rawId, selected.id, "Cancelled", finalReason);
  };

  const updateOrderShippingDetails = async (rawId, courierName, trackingNumber, paymentStatus) => {
    if (isLockedByOther) {
      alert(`This order is locked and claimed by ${selected?.assignedOptician?.fullName || 'another optician'}.`);
      return;
    }
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const response = await fetch(`${API_BASE_URL}/api/orders/${rawId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ courierName, trackingNumber, paymentStatus })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to update shipping details.");
      }

      setOrders(prev => prev.map(o => o.rawId === rawId ? { 
        ...o, 
        courierName, 
        trackingNumber, 
        paymentStatus 
      } : o));
      
      if (selected?.rawId === rawId) {
        setSelected(prev => ({ 
          ...prev, 
          courierName, 
          trackingNumber, 
          paymentStatus 
        }));
      }
      notify("Shipping and payment details saved!");
    } catch (err) {
      console.error(err);
      alert(`Error updating shipping: ${err.message}`);
    }
  };

  const saveNote = (id) => {
    if (isLockedByOther) return;
    setOrders(prev => prev.map(o => o.id === id ? { ...o, notes: newNote } : o));
    if (selected?.id === id) setSelected(prev => ({ ...prev, notes: newNote }));
    notify("Notes saved");
  };

  const handleClaimOrder = async (rawId) => {
    const token = localStorage.getItem("token");
    if (!token) return;
    setClaimLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/orders/${rawId}/claim`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to claim order.");

      notify("Order claimed! Moved to Processing.");
      await fetchOrders();
      if (selected && selected.rawId === rawId) {
        setSelected(prev => ({
          ...prev,
          assignedOptician: data.order.assignedOptician,
          assignedOpticianId: data.order.assignedOpticianId,
          status: dbToUiStatus(data.order.status),
        }));
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setClaimLoading(false);
    }
  };

  const handleReleaseOrder = async (rawId) => {
    const token = localStorage.getItem("token");
    if (!token) return;
    setClaimLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/orders/${rawId}/release`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to release order.");

      notify("Order released back to open clinic queue.");
      await fetchOrders();
      if (selected && selected.rawId === rawId) {
        setSelected(prev => ({
          ...prev,
          assignedOptician: null,
          assignedOpticianId: null,
          status: dbToUiStatus(data.order.status),
        }));
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setClaimLoading(false);
    }
  };

  const filtered = orders
    .filter(o => {
      if (queueFilter === "my_orders") {
        return currentUser && o.assignedOpticianId === currentUser.id;
      }
      if (queueFilter === "unassigned") {
        return !o.assignedOpticianId && !o.isLegacy && (o.status === "Pending" || o.status === "Processing");
      }
      return true;
    })
    .filter(o => filterStatus === "All" || o.status === filterStatus)
    .filter(o => o.id.toLowerCase().includes(search.toLowerCase()) || o.patient.toLowerCase().includes(search.toLowerCase()));

  // Dynamic capacity & workload metrics
  const myActiveJobsCount = orders.filter(
    o => currentUser && o.assignedOpticianId === currentUser.id && o.status === "Processing"
  ).length;
  const myTotalClaimedCount = orders.filter(
    o => currentUser && o.assignedOpticianId === currentUser.id
  ).length;
  const unassignedCount = orders.filter(
    o => !o.assignedOpticianId && !o.isLegacy && (o.status === "Pending" || o.status === "Processing")
  ).length;
  const totalProcessingCount = orders.filter(o => o.status === "Processing").length;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 min-h-[400px] font-sans">
        <div className="w-10 h-10 rounded-full border-4 border-slate-200 border-t-[#1b5e85] animate-spin mb-4"></div>
        <p className="text-slate-500 text-xs font-semibold animate-pulse">Loading orders catalog...</p>
      </div>
    );
  }

  const counts = STATUS_OPTIONS.reduce((acc, s) => ({ ...acc, [s]: orders.filter(o => o.status === s).length }), {});

  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      {notification && (
        <div className="fixed top-6 right-6 z-50 px-5 py-3 rounded-2xl shadow-xl text-sm font-bold flex items-center gap-2 bg-emerald-500 text-white">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          {notification}
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Order Manager</h1>
        <p className="text-slate-500 text-sm font-medium mt-0.5">Process eyewear orders and update status in real time</p>
      </div>

      {/* Real-time Optician Availability & Workload Status Banner */}
      <div className="mb-6 bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-white shadow-md shrink-0 ${
            myActiveJobsCount === 0
              ? "bg-emerald-500 shadow-emerald-500/20"
              : "bg-amber-500 shadow-amber-500/20"
          }`}>
            {myActiveJobsCount === 0 ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-6 h-6 animate-pulse" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Your Duty Capacity</span>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold ${
                myActiveJobsCount === 0
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-amber-50 text-amber-800 border border-amber-200"
              }`}>
                <span className={`w-2 h-2 rounded-full ${myActiveJobsCount === 0 ? "bg-emerald-500" : "bg-amber-500 animate-ping"}`} />
                {myActiveJobsCount === 0 ? "Available for Orders" : `Busy: ${myActiveJobsCount} Active Job${myActiveJobsCount > 1 ? "s" : ""}`}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {currentUser?.fullName ? `${currentUser.fullName} · ` : ""}
              {myActiveJobsCount === 0
                ? "No active orders in fabrication. You are free to claim incoming orders from the queue."
                : `Currently fabricating ${myActiveJobsCount} order in the laboratory. Completing orders will automatically reset your status to Available.`}
            </p>
          </div>
        </div>

        {/* Quick Workload Distribution Summary */}
        <div className="flex items-center gap-2 sm:gap-4 shrink-0 bg-slate-50 border border-slate-100 rounded-xl p-2.5 text-xs text-slate-600">
          <div className="text-center px-2">
            <span className="block text-sm font-black text-[#1b5e85]">{myTotalClaimedCount}</span>
            <span className="text-[10px] text-slate-400 uppercase font-bold">My Total</span>
          </div>
          <div className="w-[1px] h-6 bg-slate-200" />
          <div className="text-center px-2">
            <span className="block text-sm font-black text-amber-600">{unassignedCount}</span>
            <span className="text-[10px] text-slate-400 uppercase font-bold">Unassigned</span>
          </div>
          <div className="w-[1px] h-6 bg-slate-200" />
          <div className="text-center px-2">
            <span className="block text-sm font-black text-indigo-600">{totalProcessingCount}</span>
            <span className="text-[10px] text-slate-400 uppercase font-bold">In Lab</span>
          </div>
        </div>
      </div>

      {/* Stat strip */}
      <div className="flex gap-3 flex-wrap mb-6">
        {[
          { label: "Total", value: orders.length, color: "text-slate-700 bg-slate-50 border-slate-200" },
          { label: "Pending", value: counts["Pending"] || 0, color: "text-blue-700 bg-blue-50 border-blue-200" },
          { label: "Processing", value: counts["Processing"] || 0, color: "text-indigo-700 bg-indigo-50 border-indigo-200" },
          { label: "On Hold", value: counts["On Hold"] || 0, color: "text-amber-700 bg-amber-50 border-amber-200" },
          { label: "Delivered", value: counts["Delivered"] || 0, color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
          { label: "Completed", value: counts["Completed"] || 0, color: "text-teal-700 bg-teal-50 border-teal-200 font-extrabold" },
        ].map(s => (
          <div key={s.label} className={`rounded-2xl border px-5 py-3 flex flex-col ${s.color}`}>
            <span className="text-2xl font-black leading-none">{s.value}</span>
            <span className="text-xs font-bold mt-0.5 opacity-70">{s.label}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* List */}
        <div className="w-full lg:w-[380px] shrink-0 space-y-4">
          {/* Main Queue Switcher (All / My Claimed / Unassigned) */}
          <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl text-center text-xs font-bold text-slate-600">
            <button
              type="button"
              onClick={() => setQueueFilter("all")}
              className={`py-1.5 px-2 rounded-lg transition-all cursor-pointer ${
                queueFilter === "all" ? "bg-white text-slate-900 shadow-sm" : "hover:text-slate-900"
              }`}
            >
              All ({orders.length})
            </button>
            <button
              type="button"
              onClick={() => setQueueFilter("my_orders")}
              className={`py-1.5 px-2 rounded-lg transition-all cursor-pointer ${
                queueFilter === "my_orders" ? "bg-white text-[#1b5e85] shadow-sm font-extrabold" : "hover:text-slate-900"
              }`}
            >
              My Claimed ({myTotalClaimedCount})
            </button>
            <button
              type="button"
              onClick={() => setQueueFilter("unassigned")}
              className={`py-1.5 px-2 rounded-lg transition-all cursor-pointer ${
                queueFilter === "unassigned" ? "bg-white text-amber-700 shadow-sm font-extrabold" : "hover:text-slate-900"
              }`}
            >
              Queue ({unassignedCount})
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="text" placeholder="Search orders..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-400/20 focus:border-blue-400" />
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl overflow-x-auto">
            {["All", ...STATUS_OPTIONS].map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all whitespace-nowrap ${filterStatus === s ? "bg-white text-slate-800 shadow" : "text-slate-500 hover:text-slate-700"}`}>
              {s}
              </button>
            ))}
          </div>

          <div className="space-y-2.5">
            {filtered.map(order => {
              const cfg = statusConfig[order.status] || {};
              return (
                <button key={order.id} onClick={() => { setSelected(order); setNewNote(order.notes); }}
                  className={`w-full text-left bg-white border rounded-2xl p-4 transition-all hover:shadow-md
                    ${selected?.id === order.id ? "border-blue-400 ring-2 ring-blue-400/20" : "border-slate-100"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-bold text-slate-900 text-sm">{order.id}</p>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${priorityConfig[order.priority]}`}>{order.priority}</span>
                      </div>
                      <p className="text-slate-500 text-xs truncate">{order.patient} · {order.date}</p>
                      <p className="text-slate-400 text-xs mt-1 truncate">
                        {order.items?.map(item => item.frame?.name || "Eyeglasses Frame").join(", ") || "No Frame Selected"}
                      </p>
                      <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                        {order.assignedOptician ? (
                          order.assignedOpticianId === currentUser?.id ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                              Assigned to You
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200 truncate max-w-[170px]">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                              Claimed: {order.assignedOptician.fullName?.split(" ")[0] || "Staff"}
                            </span>
                          )
                        ) : (
                          !order.isLegacy && (order.status === "Pending" || order.status === "Processing") ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200/80">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                              Unassigned Queue
                            </span>
                          ) : null
                        )}
                      </div>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${cfg.cls}`}>{order.status}</span>
                  </div>
                </button>
              );
            })}
            {filtered.length === 0 && <p className="text-center text-slate-400 text-sm py-6">No orders found</p>}
          </div>
        </div>

        {/* Detail */}
        {selected ? (
          <div className="flex-1 space-y-6">
            {/* Optical Lab Job Claiming & Workload Panel - only for assigned orders or new queue orders */}
            {(selected.assignedOptician || (!selected.isLegacy && (selected.status === "Pending" || selected.status === "Processing"))) && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shadow-sm">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">Lab Optician Assignment</h3>
                    <p className="text-xs text-slate-400">Track and claim lens fabrication responsibility</p>
                  </div>
                </div>

                {selected.assignedOptician ? (
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${
                      selected.assignedOpticianId === currentUser?.id
                        ? "bg-blue-50 text-blue-700 border-blue-200 shadow-sm"
                        : "bg-slate-100 text-slate-700 border-slate-300"
                    }`}>
                      {isLockedByOther ? "Claimed by: " : "Assigned: "}
                      {selected.assignedOptician.fullName || "Clinical Optician"}
                      {selected.assignedOpticianId === currentUser?.id ? " (You)" : ""}
                    </span>

                    {selected.assignedOpticianId === currentUser?.id && selected.status !== "Completed" && selected.status !== "Cancelled" && (
                      <button
                        type="button"
                        onClick={() => handleReleaseOrder(selected.rawId)}
                        disabled={claimLoading}
                        className="px-3 py-1 text-xs font-semibold text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition-colors border border-rose-200 cursor-pointer disabled:opacity-50"
                      >
                        {claimLoading ? "Releasing..." : "Release Job"}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                      Unassigned in Queue
                    </span>
                    {selected.status !== "Cancelled" && selected.status !== "Completed" && (
                      <button
                        type="button"
                        onClick={() => handleClaimOrder(selected.rawId)}
                        disabled={claimLoading}
                        className="px-4 py-1.5 bg-[#1b5e85] hover:bg-[#154d70] text-white text-xs font-bold rounded-xl shadow-sm transition-all active:scale-95 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                        {claimLoading ? "Claiming..." : "Claim Job & Fabricate"}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {selected.assignedOpticianId === currentUser?.id && selected.status === "Processing" && (
                <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl text-xs text-blue-800 flex items-center justify-between">
                  <span>You are actively fabricating this order. Completing or delivering will reset your capacity back to Available.</span>
                </div>
              )}

              {isLockedByOther && (
                <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-900">
                  <p className="font-bold text-amber-950">
                    Assigned to {selected.assignedOptician?.fullName || "another optician"}
                  </p>
                  <p className="text-amber-800 mt-0.5 leading-relaxed">
                    This order is actively being processed. Action controls are restricted to the assigned optician to prevent duplicate fabrication.
                  </p>
                </div>
              )}
            </div>
          )}

            {/* Card 1: Order Summary */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-900">{selected.id}</h2>
                  <p className="text-slate-500 text-sm">{selected.patient} · Placed {selected.date}</p>
                </div>
                <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider shadow-sm ${(statusConfig[selected.status] || {}).cls}`}>{selected.status}</span>
              </div>

              {/* Order details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-5 sm:col-span-2 space-y-4 shadow-sm">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Eyewear Items ({selected.items?.length || 0})</p>
                  <div className="space-y-3.5 max-h-[260px] overflow-y-auto pr-1">
                    {selected.items?.map((item, idx) => (
                      <div key={idx} className="bg-white border border-slate-100 rounded-xl p-3.5 space-y-1.5 shadow-sm">
                        <p className="text-base font-extrabold text-slate-900">{item.frame?.name || "Eyeglasses Frame"}</p>
                        <p className="text-xs md:text-sm text-slate-600 font-semibold leading-relaxed">
                          <span className="text-slate-400">Lens Type:</span> {item.lens?.type || "No Custom Lens"} <span className="text-slate-300">·</span> <span className="text-slate-400">Qty:</span> {item.quantity} <span className="text-slate-300">·</span> <span className="text-slate-400">Price:</span> LKR {item.price?.toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-slate-50 rounded-2xl p-4">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Prescription Ref.</p>
                  <p className="text-slate-900 font-bold text-sm">{selected.prescription}</p>
                </div>
                <div className="bg-slate-50 rounded-2xl p-4">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Price</p>
                  <p className="text-slate-900 font-bold text-sm">LKR {selected.price?.toLocaleString()}</p>
                </div>
              </div>
            </div>

            {/* Status Warning & Notice Banners */}
            {selected.status === "On Hold" && (
              <div className="bg-amber-50 border border-amber-300 text-amber-950 rounded-2xl p-5 text-sm font-semibold shadow-sm space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
                  <span className="font-extrabold uppercase tracking-wider text-xs text-amber-800">Order Currently On Hold</span>
                </div>
                <p className="text-sm font-bold text-amber-950">
                  Reason: {selected.holdReason || "Awaiting prescription or frame stock verification from optical team."}
                </p>
                <p className="text-xs text-amber-700 leading-relaxed">
                  The customer has been notified and can view this reason in their dashboard. Click any other status button below to resume fulfillment once resolved.
                </p>
              </div>
            )}

            {selected.status === "Cancelled" && (
              <div className="bg-red-50 border border-red-200 text-red-950 rounded-2xl p-5 text-sm font-semibold shadow-sm space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                  <span className="font-extrabold uppercase tracking-wider text-xs text-red-800">Order Cancelled</span>
                </div>
                {selected.cancelReason && (
                  <p className="text-sm font-bold text-red-950">
                    Reason: {selected.cancelReason}
                  </p>
                )}
                <p className="text-xs text-red-700 leading-relaxed">
                  Eyewear stock has been returned to store inventory. This order is locked from further edits.
                </p>
              </div>
            )}

            {selected.status === "Completed" && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl p-5 text-sm font-bold flex items-center gap-3.5 shadow-sm">
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 text-emerald-600">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                </div>
                <span>This order has been completed and finalized.</span>
              </div>
            )}

            {/* Update Status (Moved to Top) */}
            <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-violet-600 to-indigo-600">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  <p className="text-sm font-extrabold text-white uppercase tracking-widest">
                    {isLockedByOther ? `Status Locked (Claimed by ${selected.assignedOptician?.fullName?.split(" ")[0] || "Staff"})` : "Update Order Status"}
                  </p>
                </div>
                {/* Colour legend */}
                <div className="hidden sm:flex items-center gap-4">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-white/90"><span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block ring-2 ring-white/20"></span>Active</span>
                  <span className="flex items-center gap-1.5 text-xs font-bold text-white/90"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block ring-2 ring-white/20"></span>Hold</span>
                  <span className="flex items-center gap-1.5 text-xs font-bold text-white/90"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block ring-2 ring-white/20"></span>Done</span>
                  <span className="flex items-center gap-1.5 text-xs font-bold text-white/90"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block ring-2 ring-white/20"></span>Cancelled</span>
                </div>
              </div>
              <div className="bg-white px-5 py-5">
                <div className="flex flex-wrap gap-2.5">
                  {STATUS_OPTIONS.map(s => {
                    const cfg = statusConfig[s] || {};
                    const isCurrent = selected.status === s;
                    const isFinal = selected.status === "Cancelled" || selected.status === "Completed";
                    return (
                      <button
                        key={s}
                        onClick={() => handleStatusClick(s)}
                        disabled={isCurrent || isFinal || isLockedByOther}
                        title={isLockedByOther ? `Order is locked by ${selected.assignedOptician?.fullName || "another optician"}` : s}
                        className={`px-5 py-3 rounded-2xl text-base font-black border transition-all duration-200 flex items-center shadow-sm hover:shadow hover:-translate-y-0.5 active:translate-y-0
                          ${isCurrent ? cfg.selectedCls : cfg.unselectedCls}
                          disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none`}
                      >
                        <span className={`w-2.5 h-2.5 rounded-full inline-block mr-2.5 shrink-0 ${isCurrent ? "bg-white ring-2 ring-white/40" : cfg.dot}`}></span>
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>



            {/* Shipping & Contact (Moved to Bottom) */}
            <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              {/* Card header */}
              <div className="flex items-center gap-2 px-5 py-4 bg-gradient-to-r from-violet-600 to-indigo-600">
                <svg className="w-5 h-5 text-white shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                <p className="text-sm font-extrabold text-white uppercase tracking-widest">Shipping & Contact</p>
              </div>

              {/* Info rows */}
              <div className="bg-white px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
                <div className="flex items-start gap-4">
                  <div className="mt-0.5 w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  </div>
                  <div>
                    <p className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-1">Recipient Name</p>
                    <p className="text-base font-black text-slate-900">{selected.recipientName || <span className="text-slate-450 font-medium">Not provided</span>}</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="mt-0.5 w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                  </div>
                  <div>
                    <p className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-1">Phone Number</p>
                    <p className="text-base font-black text-slate-900 font-mono">{selected.recipientPhone || <span className="text-slate-450 font-medium">Not provided</span>}</p>
                  </div>
                </div>
                <div className="flex items-start gap-4 sm:col-span-2">
                  <div className="mt-0.5 w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-1">Delivery Address</p>
                    <p className="text-base font-black text-slate-900 leading-relaxed">{selected.shippingAddress || "In-Store Pickup"}</p>
                    <div className="flex items-center gap-2.5 mt-2">
                      <span className="text-xs font-extrabold text-slate-600 bg-slate-100 px-3 py-1 rounded-full">
                        🚢 Shipping: LKR {selected.shippingCost?.toLocaleString() || "0"}
                      </span>
                      <span className={`text-xs font-extrabold px-3 py-1 rounded-full ${
                        selected.paymentMethod === "CARD" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"
                      }`}>
                        {selected.paymentMethod === "CARD" ? "💳 Card Payment" : "💵 Cash on Delivery"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tracking & Payment editor */}
              <div className="bg-slate-50 border-t border-slate-200 px-6 py-5 space-y-4">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                  <p className="text-xs font-black text-slate-650 uppercase tracking-wider">Update Tracking & Payment</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-extrabold text-slate-600 uppercase block mb-1.5">Courier Partner</label>
                    <input
                      type="text"
                      placeholder="e.g. Prompt Express"
                      value={courierNameInput}
                      onChange={e => setCourierNameInput(e.target.value)}
                      disabled={selected.status === "Cancelled" || selected.status === "Completed" || isLockedByOther}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 placeholder-slate-350 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-50 disabled:bg-slate-100 transition"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-extrabold text-slate-600 uppercase block mb-1.5">Tracking Number</label>
                    <input
                      type="text"
                      placeholder="e.g. PE-10293847"
                      value={trackingNumInput}
                      onChange={e => setTrackingNumInput(e.target.value)}
                      disabled={selected.status === "Cancelled" || selected.status === "Completed" || isLockedByOther}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 font-mono placeholder-slate-350 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-50 disabled:bg-slate-100 transition"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-extrabold text-slate-600 uppercase block mb-1.5">Payment Status</label>
                    <select
                      value={paymentStatusInput}
                      onChange={e => setPaymentStatusInput(e.target.value)}
                      disabled={
                        selected.status === "Cancelled" ||
                        selected.status === "Completed" ||
                        // Lock if PayHere already confirmed a card payment
                        (selected.paymentMethod === "CARD" && selected.paymentStatus === "PAID") ||
                        isLockedByOther
                      }
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-50 disabled:bg-slate-100 transition"
                    >
                      <option value="PENDING">⏳ PENDING</option>
                      <option value="PAID">✅ PAID</option>
                      <option value="FAILED">❌ FAILED</option>
                    </select>
                    {/* PayHere lock notice */}
                    {selected.paymentMethod === "CARD" && selected.paymentStatus === "PAID" && (
                      <div className="mt-2.5 flex items-center gap-3 bg-emerald-600 text-white rounded-xl px-5 py-4 shadow-md shadow-emerald-500/20">
                        <svg className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                        <div>
                          <p className="text-sm font-extrabold uppercase tracking-wide">Confirmed by PayHere</p>
                          <p className="text-xs font-semibold opacity-85 mt-0.5">This payment was verified by the gateway and cannot be changed.</p>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={() => updateOrderShippingDetails(selected.rawId, courierNameInput, trackingNumInput, paymentStatusInput)}
                      disabled={selected.status === "Cancelled" || selected.status === "Completed" || isLockedByOther}
                      className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-extrabold py-3 rounded-xl text-sm tracking-wide hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm flex items-center justify-center gap-1.5"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      {isLockedByOther ? "Locked for Editing" : "Save Shipping & Payment"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            {/* Card 4: Order Notes */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Order Notes</p>
              <textarea 
                rows={3} 
                value={newNote} 
                onChange={e => setNewNote(e.target.value)}
                disabled={selected.status === "Cancelled" || selected.status === "Completed" || isLockedByOther}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-sm text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-400/20 focus:border-blue-400 resize-none disabled:opacity-60 disabled:bg-slate-100"
                placeholder={selected.status === "Cancelled" || selected.status === "Completed" || isLockedByOther ? "Order locked from notes editing." : "Add notes about this order..."} 
              />
              {!(selected.status === "Cancelled" || selected.status === "Completed" || isLockedByOther) && (
                <button 
                  onClick={() => saveNote(selected.id)}
                  className="mt-2 px-4 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-500 transition-colors"
                >
                  Save Notes
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 bg-white rounded-3xl border border-slate-100 shadow-sm flex items-center justify-center min-h-[300px]">
            <div className="text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </div>
              <p className="text-slate-400 font-semibold">Select an order to view details</p>
            </div>
          </div>
        )}
      </div>

      {/* Modal: Place Order On Hold */}
      {holdModalOpen && selected && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl p-6 space-y-5">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">Place Order On Hold</h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">Order Ref: {selected.id} · {selected.patient}</p>
              </div>
              <button
                type="button"
                onClick={() => setHoldModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider block">
                Select Hold Reason
              </label>
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {HOLD_PRESETS.map((preset) => (
                  <label
                    key={preset}
                    onClick={() => setHoldReasonPreset(preset)}
                    className={`flex items-start gap-3 p-3 rounded-xl border text-xs font-semibold cursor-pointer transition ${
                      holdReasonPreset === preset
                        ? "bg-amber-50/70 border-amber-400 text-amber-950 ring-1 ring-amber-400"
                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="holdPreset"
                      checked={holdReasonPreset === preset}
                      onChange={() => setHoldReasonPreset(preset)}
                      className="mt-0.5 text-amber-600 focus:ring-amber-500"
                    />
                    <span>{preset}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider block">
                Additional Clinical or Operational Notes
              </label>
              <textarea
                rows={3}
                value={customHoldReason}
                onChange={(e) => setCustomHoldReason(e.target.value)}
                placeholder="Add specific instructions or laboratory notes for the customer..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400"
              />
              <p className="text-[11px] text-slate-400">
                This notice will be displayed to the patient in their dashboard and sent via status notification email.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setHoldModalOpen(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmHold}
                className="px-5 py-2.5 rounded-xl text-xs font-extrabold text-white bg-amber-500 hover:bg-amber-600 shadow-md shadow-amber-500/25 transition"
              >
                Confirm Hold
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Cancellation Confirmation */}
      {cancelModalOpen && selected && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl p-6 space-y-5">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-extrabold text-red-600">Cancel Order</h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">Order Ref: {selected.id} · {selected.patient}</p>
              </div>
              <button
                type="button"
                onClick={() => setCancelModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 text-xs text-red-800 leading-relaxed font-semibold">
              Warning: Cancelling this order is final. Eyewear item quantities will be automatically returned to store inventory stock.
            </div>

            <div className="space-y-3">
              <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider block">
                Select Cancellation Reason
              </label>
              <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                {CANCEL_PRESETS.map((preset) => (
                  <label
                    key={preset}
                    onClick={() => setCancelReasonPreset(preset)}
                    className={`flex items-start gap-3 p-3 rounded-xl border text-xs font-semibold cursor-pointer transition ${
                      cancelReasonPreset === preset
                        ? "bg-red-50/70 border-red-400 text-red-950 ring-1 ring-red-400"
                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="cancelPreset"
                      checked={cancelReasonPreset === preset}
                      onChange={() => setCancelReasonPreset(preset)}
                      className="mt-0.5 text-red-600 focus:ring-red-500"
                    />
                    <span>{preset}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider block">
                Additional Notes
              </label>
              <textarea
                rows={2}
                value={customCancelReason}
                onChange={(e) => setCustomCancelReason(e.target.value)}
                placeholder="Optional notes regarding cancellation..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-400/30 focus:border-red-400"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCancelModalOpen(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
              >
                Go Back
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                className="px-5 py-2.5 rounded-xl text-xs font-extrabold text-white bg-red-600 hover:bg-red-700 shadow-md shadow-red-600/25 transition"
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
