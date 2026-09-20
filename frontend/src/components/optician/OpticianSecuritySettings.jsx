import { useState, useEffect } from "react";
import { API_BASE_URL } from "../../config/api";

export default function OpticianSecuritySettings({ opticianName }) {
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [submittingPw, setSubmittingPw] = useState(false);

  // Profile Edit state
  const [fullName, setFullName] = useState(opticianName || "");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [submittingProfile, setSubmittingProfile] = useState(false);

  // Notification Toast state
  const [notification, setNotification] = useState(null);

  const notify = (msg, type = "success") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const fetchProfile = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      setLoadingProfile(true);
      const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        setFullName(data.fullName || "");
        setPhoneNumber(data.phoneNumber || "");
      }
    } catch (err) {
      console.error("Failed to load staff profile:", err);
    } finally {
      setLoadingProfile(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      notify("Please fill in all password fields.", "error");
      return;
    }

    if (newPassword.length < 6) {
      notify("New password must be at least 6 characters long.", "error");
      return;
    }

    if (newPassword !== confirmPassword) {
      notify("New password and confirmation do not match.", "error");
      return;
    }

    if (currentPassword === newPassword) {
      notify("New password cannot be the same as your current password.", "error");
      return;
    }

    const token = localStorage.getItem("token");
    setSubmittingPw(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/change-password`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update password.");
      }

      notify("Password updated successfully! Your account is secure.", "success");
      localStorage.setItem("mustChangePassword", "false");
      if (profile) setProfile(prev => ({ ...prev, mustChangePassword: false }));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setSubmittingPw(false);
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    if (!fullName.trim()) {
      notify("Full name cannot be left blank.", "error");
      return;
    }
    if (phoneNumber && phoneNumber.trim().length > 0 && phoneNumber.trim().length !== 10) {
      notify("Phone number must be exactly 10 digits (e.g. 0771234567).", "error");
      return;
    }
    const token = localStorage.getItem("token");
    setSubmittingProfile(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ fullName, phoneNumber }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update profile details.");
      }

      notify("Staff profile details updated successfully.", "success");
      if (data.user?.fullName) {
        localStorage.setItem("user_name", data.user.fullName);
      }
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setSubmittingProfile(false);
    }
  };

  return (
    <div className="p-6 max-w-[1000px] mx-auto space-y-6 animate-[fadeIn_0.2s_ease]">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed top-6 right-6 z-50 px-5 py-3.5 rounded-2xl shadow-xl text-sm font-bold flex items-center gap-2.5 transition-all animate-[fadeIn_0.2s_ease] ${
            notification.type === "error"
              ? "bg-rose-600 text-white shadow-rose-600/20"
              : "bg-emerald-600 text-white shadow-emerald-500/20"
          }`}
        >
          {notification.type === "error" ? (
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          ) : (
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
          {notification.msg}
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-br from-[#0f2d45] via-[#163f5f] to-[#1b5e85] rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-400/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-cyan-400/20 text-cyan-300 border border-cyan-400/30 mb-2">
              <span>🛡️</span> Staff Credential Management
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Account & Security</h1>
            <p className="text-white/70 text-sm mt-1 max-w-xl">
              Keep your optician portal credentials private. Changing your password ensures confidential patient prescription reviews and clinical integrity.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/15 shrink-0 text-center sm:text-right">
            <span className="text-[10px] uppercase font-extrabold text-cyan-300 tracking-wider block">Access Role</span>
            <span className="text-sm font-black text-white">Licensed Clinical Optician</span>
            <span className="text-xs text-white/60 block mt-0.5">{profile?.email || "Optician Account"}</span>
          </div>
        </div>
      </div>

      {/* First-Login Mandatory Password Change Banner */}
      {(profile?.mustChangePassword || localStorage.getItem("mustChangePassword") === "true") && (
        <div className="bg-amber-50 border-2 border-amber-400 rounded-3xl p-5 sm:p-6 shadow-sm flex items-start gap-4 animate-in fade-in duration-200">
          <div className="w-11 h-11 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-amber-500/20 mt-0.5">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-black text-amber-950 uppercase tracking-wide">
              First-Time Security Setup Required
            </h4>
            <p className="text-xs text-amber-900 font-medium mt-1 leading-relaxed">
              Your optician staff account was initiated by the Administrator with a system temporary key. For clinical data security and compliance, please enter your temporary password and define your permanent secret password below.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: Change Password Form */}
        <div className={`bg-white rounded-3xl p-6 sm:p-7 border shadow-sm flex flex-col justify-between transition-all ${
          profile?.mustChangePassword || localStorage.getItem("mustChangePassword") === "true"
            ? "border-amber-400 ring-4 ring-amber-400/20 shadow-amber-100"
            : "border-slate-200/80"
        }`}>
          <div>
            <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div>
                <h3 className="font-extrabold text-slate-800 text-base">Update Password</h3>
                <p className="text-xs text-slate-400">Set a private secret password for your portal account</p>
              </div>
            </div>

            <form onSubmit={handlePasswordChange} className="space-y-4">
              {/* Current Password */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Current / Temporary Password *
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPw ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="w-full px-3.5 py-2.5 text-xs font-medium border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50/50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPw(!showCurrentPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-semibold cursor-pointer"
                  >
                    {showCurrentPw ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  New Password *
                </label>
                <div className="relative">
                  <input
                    type={showNewPw ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full px-3.5 py-2.5 text-xs font-medium border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50/50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPw(!showNewPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-semibold cursor-pointer"
                  >
                    {showNewPw ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              {/* Confirm New Password */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Confirm New Password *
                </label>
                <input
                  type={showNewPw ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  className="w-full px-3.5 py-2.5 text-xs font-medium border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50/50"
                />
              </div>

              <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-3 text-[11px] text-blue-800 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <span>💡</span> Password Security Guidelines:
                </p>
                <ul className="list-disc list-inside text-blue-700 space-y-0.5 ml-1">
                  <li>At least 6 characters (longer is recommended)</li>
                  <li>Do not share this password with staff or administrators</li>
                  <li>Use a unique password not shared with personal email</li>
                </ul>
              </div>

              <button
                type="submit"
                disabled={submittingPw}
                className="w-full mt-2 py-3 bg-[#1b5e85] hover:bg-[#154d70] disabled:bg-slate-300 text-white font-bold text-xs rounded-xl shadow-md shadow-[#1b5e85]/20 transition-all cursor-pointer active:scale-98 flex items-center justify-center gap-2"
              >
                {submittingPw ? (
                  <>
                    <svg className="w-4 h-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Updating Password...
                  </>
                ) : (
                  "Change Password Now"
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Card 2: Profile & Governance Info */}
        <div className="space-y-6">
          {/* Profile Details Edit */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-sm">
            <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-700 flex items-center justify-center font-bold">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <h3 className="font-extrabold text-slate-800 text-base">Optician Profile</h3>
                <p className="text-xs text-slate-400">Clinical identifier and contact information</p>
              </div>
            </div>

            <form onSubmit={handleProfileUpdate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Official Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full name"
                  className="w-full px-3.5 py-2.5 text-xs font-medium border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50/50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Registered Email (Read-Only)</label>
                <input
                  type="email"
                  disabled
                  value={profile?.email || ""}
                  className="w-full px-3.5 py-2.5 text-xs font-bold border border-slate-200 rounded-xl bg-slate-100 text-slate-500 cursor-not-allowed"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  * Official staff email addresses are managed centrally by the system administrator.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Contact Phone Number</label>
                <input
                  type="tel"
                  maxLength={10}
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  placeholder="0771234567"
                  className="w-full px-3.5 py-2.5 text-xs font-medium border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50/50"
                />
              </div>

              <button
                type="submit"
                disabled={submittingProfile}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer"
              >
                {submittingProfile ? "Saving..." : "Save Profile Details"}
              </button>
            </form>
          </div>

          {/* System Governance Notice */}
          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200/70 space-y-2">
            <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <span>🏛️</span> Clinical Accountability & Auditing
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Every prescription validated and order status updated by your account is logged with exact digital timestamps. Keep your password confidential to maintain non-repudiation in clinical records.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
