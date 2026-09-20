import { useState, useEffect, useRef } from "react";
import { API_BASE_URL } from "../../config/api";

export default function PatientConsultations() {
  const [conversations, setConversations] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [replyText, setReplyText] = useState("");
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showRxCard, setShowRxCard] = useState(true);
  const messagesEndRef = useRef(null);

  const selectedConversation = conversations.find(
    (c) => c.patientId === selectedPatientId
  );

  // Fetch all conversations
  const fetchConversations = async (silent = false) => {
    if (!silent) setLoadingConversations(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE_URL}/api/chat/optician/conversations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
        // Default to first conversation if none selected
        if (!selectedPatientId && data.length > 0) {
          setSelectedPatientId(data[0].patientId);
        }
      }
    } catch (err) {
      console.error("Failed to load conversations:", err);
    } finally {
      if (!silent) setLoadingConversations(false);
    }
  };

  // Fetch messages for active conversation
  const fetchMessages = async (patientId, silent = false) => {
    if (!patientId) return;
    if (!silent) setLoadingMessages(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE_URL}/api/chat/messages?patientId=${patientId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
        // Refresh conversation list quietly to update unread badge counts
        fetchConversations(true);
      }
    } catch (err) {
      console.error("Failed to load patient messages:", err);
    } finally {
      if (!silent) setLoadingMessages(false);
    }
  };

  useEffect(() => {
    fetchConversations();
    // Poll for updates every 8 seconds
    const interval = setInterval(() => {
      fetchConversations(true);
      if (selectedPatientId) {
        fetchMessages(selectedPatientId, true);
      }
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedPatientId) {
      fetchMessages(selectedPatientId);
    }
  }, [selectedPatientId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Send reply from optician
  const handleSendReply = async (e) => {
    if (e) e.preventDefault();
    if (!replyText.trim() || !selectedPatientId || sendingReply) return;

    setSendingReply(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE_URL}/api/chat/optician/reply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          patientId: selectedPatientId,
          message: replyText.trim(),
        }),
      });

      if (res.ok) {
        const newMsg = await res.json();
        setMessages((prev) => [...prev, newMsg]);
        setReplyText("");
        fetchConversations(true);
      } else {
        alert("Failed to send reply. Please try again.");
      }
    } catch (err) {
      console.error("Error sending optician reply:", err);
      alert("Network error sending message.");
    } finally {
      setSendingReply(false);
    }
  };

  // Quick clinical snippets
  const insertSnippet = (snippet) => {
    setReplyText((prev) => (prev ? `${prev} ${snippet}` : snippet));
  };

  const filteredConversations = conversations.filter((c) => {
    const q = searchQuery.toLowerCase();
    return (
      c.patientName.toLowerCase().includes(q) ||
      (c.email && c.email.toLowerCase().includes(q)) ||
      (c.phoneNumber && c.phoneNumber.includes(q))
    );
  });

  return (
    <div className="p-6 max-w-[1400px] mx-auto h-[calc(100vh-85px)] flex flex-col">
      {/* Header */}
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <span>Patient Tele-Consultations</span>
            <span className="text-xs bg-cyan-100 text-cyan-800 font-bold px-2.5 py-1 rounded-full">
              Clinical Inbox
            </span>
          </h1>
          <p className="text-slate-500 text-xs font-medium mt-0.5">
            Bi-directional asynchronous patient messaging, prescription verification, and lens advice.
          </p>
        </div>

        <button
          onClick={() => {
            fetchConversations();
            if (selectedPatientId) fetchMessages(selectedPatientId);
          }}
          className="self-start sm:self-auto px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
        >
          <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh Inbox
        </button>
      </div>

      {/* Main Container */}
      <div className="flex-1 bg-white rounded-3xl border border-slate-200 shadow-sm flex overflow-hidden min-h-0">
        {/* Left Column: Conversations List */}
        <div className="w-full sm:w-80 md:w-96 border-r border-slate-200 flex flex-col shrink-0 bg-slate-50/50">
          {/* Search bar */}
          <div className="p-3.5 border-b border-slate-200 bg-white">
            <div className="relative">
              <svg className="w-4 h-4 absolute left-3 top-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search patient or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-100/70 hover:bg-slate-100 border border-slate-200/80 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-700 placeholder-slate-400 outline-none focus:border-cyan-500 focus:bg-white transition-all"
              />
            </div>
          </div>

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {loadingConversations ? (
              <div className="p-8 text-center text-xs text-slate-400 space-y-2">
                <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p>Loading patient threads...</p>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                <p className="font-semibold text-slate-600 mb-1">No inquiries found</p>
                <p className="text-[11px]">When customers send messages from their dashboard, they will appear here.</p>
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const isSelected = conv.patientId === selectedPatientId;
                const hasUnread = conv.unreadCount > 0;
                return (
                  <button
                    key={conv.patientId}
                    onClick={() => setSelectedPatientId(conv.patientId)}
                    className={`w-full text-left p-4 transition-colors flex items-start gap-3 relative cursor-pointer ${
                      isSelected
                        ? "bg-cyan-50/80 border-l-4 border-cyan-600"
                        : "hover:bg-slate-100/60 bg-white"
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-slate-800 text-cyan-300 flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
                      {conv.patientName
                        ? conv.patientName.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
                        : "PT"}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className={`text-xs truncate ${hasUnread ? "font-extrabold text-slate-900" : "font-bold text-slate-800"}`}>
                          {conv.patientName}
                        </span>
                        {conv.latestMessageAt && (
                          <span className="text-[10px] text-slate-400 shrink-0">
                            {new Date(conv.latestMessageAt).toLocaleDateString([], { month: "short", day: "numeric" })}
                          </span>
                        )}
                      </div>

                      <p className={`text-[11px] truncate leading-tight ${hasUnread ? "font-semibold text-slate-900" : "text-slate-500"}`}>
                        {conv.latestMessageRole === "OPTICIAN" && (
                          <span className="text-cyan-700 font-bold mr-1">You:</span>
                        )}
                        {conv.latestMessage || "No messages yet"}
                      </p>

                      <div className="flex items-center gap-2 mt-2">
                        {conv.latestPrescription ? (
                          <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200/80 font-bold px-1.5 py-0.5 rounded">
                            Rx on file ({conv.latestPrescription.status})
                          </span>
                        ) : (
                          <span className="text-[9px] bg-slate-100 text-slate-500 font-medium px-1.5 py-0.5 rounded">
                            No Rx
                          </span>
                        )}

                        {hasUnread && (
                          <span className="ml-auto text-[10px] bg-cyan-600 text-white font-black px-2 py-0.5 rounded-full shadow-sm animate-pulse">
                            {conv.unreadCount} new
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Chat Window & Clinical Context */}
        {selectedConversation ? (
          <div className="flex-1 flex flex-col min-w-0 bg-white">
            {/* Thread Header */}
            <div className="px-6 py-3.5 border-b border-slate-200 flex items-center justify-between bg-white shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-cyan-600 text-white flex items-center justify-center font-extrabold text-sm shadow-sm">
                  {selectedConversation.patientName.charAt(0)}
                </div>
                <div className="min-w-0">
                  <h3 className="font-extrabold text-slate-900 text-sm truncate flex items-center gap-2">
                    <span>{selectedConversation.patientName}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md">
                      Patient
                    </span>
                  </h3>
                  <div className="flex items-center gap-3 text-[11px] text-slate-500 font-medium">
                    {selectedConversation.email && <span>{selectedConversation.email}</span>}
                    {selectedConversation.phoneNumber && <span>• {selectedConversation.phoneNumber}</span>}
                  </div>
                </div>
              </div>

              {selectedConversation.latestPrescription && (
                <button
                  onClick={() => setShowRxCard(!showRxCard)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-xl border flex items-center gap-1.5 transition-colors cursor-pointer ${
                    showRxCard
                      ? "bg-cyan-50 text-cyan-800 border-cyan-200"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {showRxCard ? "Hide Patient Rx" : "View Patient Rx"}
                </button>
              )}
            </div>

            {/* Quick Clinical Card: Patient Prescription Context */}
            {showRxCard && selectedConversation.latestPrescription && (
              <div className="bg-slate-900 text-white px-6 py-3 shrink-0 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs animate-in fade-in duration-150">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5 font-mono text-[11px] bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700">
                    <span className="text-cyan-400 font-bold">OD (Right):</span>
                    <span>SPH {selectedConversation.latestPrescription.odSph || "0.00"}</span>
                    <span>CYL {selectedConversation.latestPrescription.odCyl || "0.00"}</span>
                    <span>AXIS {selectedConversation.latestPrescription.odAxis || "0"}°</span>
                  </div>

                  <div className="flex items-center gap-1.5 font-mono text-[11px] bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700">
                    <span className="text-cyan-400 font-bold">OS (Left):</span>
                    <span>SPH {selectedConversation.latestPrescription.osSph || "0.00"}</span>
                    <span>CYL {selectedConversation.latestPrescription.osCyl || "0.00"}</span>
                    <span>AXIS {selectedConversation.latestPrescription.osAxis || "0"}°</span>
                  </div>

                  {selectedConversation.latestPrescription.pd && (
                    <div className="font-mono text-[11px] bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700">
                      <span className="text-cyan-400 font-bold">PD:</span> {selectedConversation.latestPrescription.pd} mm
                    </div>
                  )}
                </div>

                <div className="text-[10px] text-slate-400">
                  Rx Status: <span className="font-bold text-cyan-300">{selectedConversation.latestPrescription.status}</span>
                </div>
              </div>
            )}

            {/* Messages Area */}
            <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-slate-50/60">
              {loadingMessages ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-400">
                  <div className="w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mr-2"></div>
                  Loading consultation history...
                </div>
              ) : messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center p-6">
                  <div className="w-12 h-12 rounded-2xl bg-cyan-50 text-cyan-600 flex items-center justify-center mb-2">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <p className="font-bold text-slate-700 text-sm">No messages in this consultation yet</p>
                  <p className="text-xs text-slate-500 mt-1">Send a clinical greeting or reply to initiate consultation.</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isOptician = msg.senderRole === "OPTICIAN";
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isOptician ? "justify-end" : "justify-start"} animate-in fade-in duration-200`}
                    >
                      <div
                        className={`max-w-md md:max-w-lg rounded-2xl p-4 text-xs shadow-sm space-y-1.5 ${
                          isOptician
                            ? "bg-slate-900 text-white rounded-tr-none"
                            : "bg-white text-slate-800 rounded-tl-none border border-slate-200"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3 text-[10px] pb-1 border-b border-white/10">
                          <span className={`font-bold ${isOptician ? "text-cyan-300" : "text-slate-600"}`}>
                            {isOptician ? `Optician (${msg.senderName})` : msg.senderName}
                          </span>
                          <span className={isOptician ? "text-slate-400" : "text-slate-400"}>
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        <p className="leading-relaxed font-medium whitespace-pre-wrap">{msg.message}</p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Clinical Snippets */}
            <div className="px-6 py-2 bg-slate-100/70 border-t border-slate-200 flex items-center gap-2 overflow-x-auto text-[11px] shrink-0">
              <span className="text-slate-400 font-bold shrink-0 text-[10px] uppercase tracking-wider">Quick Advice:</span>
              <button
                type="button"
                onClick={() => insertSnippet("Based on your prescription power, I recommend a 1.61 High-Index lens with anti-reflective coating.")}
                className="px-2.5 py-1 bg-white hover:bg-slate-200 border border-slate-200 rounded-lg text-slate-700 font-medium shrink-0 cursor-pointer transition-colors"
              >
                Recommend 1.61 High Index
              </button>
              <button
                type="button"
                onClick={() => insertSnippet("For prolonged screen use, we strongly suggest Blue-Cut protective filter coating.")}
                className="px-2.5 py-1 bg-white hover:bg-slate-200 border border-slate-200 rounded-lg text-slate-700 font-medium shrink-0 cursor-pointer transition-colors"
              >
                Suggest Blue-Cut Coating
              </button>
              <button
                type="button"
                onClick={() => insertSnippet("Your optical order is currently undergoing custom lens edging in our clinic laboratory.")}
                className="px-2.5 py-1 bg-white hover:bg-slate-200 border border-slate-200 rounded-lg text-slate-700 font-medium shrink-0 cursor-pointer transition-colors"
              >
                Lab Edging Status
              </button>
              <button
                type="button"
                onClick={() => insertSnippet("Please visit our clinic for a complimentary frame adjustment and pupillary height calibration.")}
                className="px-2.5 py-1 bg-white hover:bg-slate-200 border border-slate-200 rounded-lg text-slate-700 font-medium shrink-0 cursor-pointer transition-colors"
              >
                In-Clinic Fitting Visit
              </button>
            </div>

            {/* Reply Input Form */}
            <form onSubmit={handleSendReply} className="p-4 border-t border-slate-200 bg-white flex gap-3 shrink-0">
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendReply();
                  }
                }}
                rows={2}
                placeholder={`Type clinical response to ${selectedConversation.patientName}... (Press Enter to send)`}
                className="flex-1 bg-slate-50 hover:bg-slate-100/50 border border-slate-200 focus:border-cyan-500 rounded-xl px-4 py-2.5 text-xs text-slate-800 outline-none transition-all resize-none"
              />
              <button
                type="submit"
                disabled={sendingReply || !replyText.trim()}
                className="bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white font-bold px-6 py-2.5 rounded-xl text-xs transition-all active:scale-95 cursor-pointer shadow-sm flex items-center justify-center gap-1.5 self-end"
              >
                {sendingReply ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <span>Send Advice</span>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </>
                )}
              </button>
            </form>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <h3 className="font-bold text-slate-700 text-base">Select a Consultation Thread</h3>
            <p className="text-xs text-slate-500 max-w-sm mt-1">
              Choose a patient inquiry from the left panel to review their message history, optical prescription, and provide clinical advice.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
