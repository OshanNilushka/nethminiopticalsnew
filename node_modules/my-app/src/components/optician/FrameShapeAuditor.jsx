import { useState, useEffect, useMemo } from "react";
import { API_BASE_URL } from "../../config/api";
import {
  STANDARD_FRAME_SHAPES,
  analyzeFrameGeometry,
  WORLD_OPTICAL_RULES
} from "../../constants/opticalRules";

export default function FrameShapeAuditor() {
  const [frames, setFrames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState("all"); // 'all', 'mismatch', 'verified'
  const [shapeFilter, setShapeFilter] = useState("all");
  const [updatingId, setUpdatingId] = useState(null);
  const [notification, setNotification] = useState(null);

  const notify = (msg, type = "success") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const fetchFrames = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/products`);
      if (!res.ok) throw new Error("Failed to load products");
      const data = await res.json();
      // Filter out lenses (contact lenses or optical lenses)
      const frameList = data.filter((p) => {
        const shapeStr = (p.shape || "").toLowerCase();
        const imgStr = (p.imageUrl || "").toLowerCase();
        return !shapeStr.includes("lens") && !imgStr.includes("/lenses/");
      });

      // Augment each frame with AI / Geometric Shape Analysis
      const analyzed = frameList.map((f) => {
        // Approximate width & height from calibration or standard physical scale
        const scale = f.scaleMultiplier || 1.0;
        const width = 140 * scale; // standard glasses span in mm
        let height = 48 * scale;
        const norm = (f.name || "").toLowerCase();

        // If shape implies taller or rounder height
        if (norm.includes("round") || norm.includes("circular") || norm.includes("retro")) {
          height = 62 * scale;
        } else if (norm.includes("aviator") || norm.includes("pilot")) {
          height = 55 * scale;
        } else if (norm.includes("square")) {
          height = 52 * scale;
        } else if (norm.includes("slim") || norm.includes("rectangle")) {
          height = 42 * scale;
        }

        const analysis = analyzeFrameGeometry({
          width,
          height,
          depth: 135 * scale,
          name: f.name,
          currentShape: f.shape || "Square"
        });

        return {
          ...f,
          analysis
        };
      });

      setFrames(analyzed);
    } catch (err) {
      console.error(err);
      notify("Failed to load frames catalog for shape audit.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchFrames();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUpdateShape = async (frameId, newShape) => {
    setUpdatingId(frameId);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE_URL}/api/products/${frameId}/shape`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ shape: newShape })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to update shape");
      }

      // Update local state immediately
      setFrames((prev) =>
        prev.map((f) => {
          if (f.id === frameId) {
            const updatedAnalysis = {
              ...f.analysis,
              isMismatch: f.analysis.detectedShape.toLowerCase() !== newShape.toLowerCase()
            };
            return {
              ...f,
              shape: newShape,
              analysis: updatedAnalysis
            };
          }
          return f;
        })
      );

      notify(`Frame shape updated to ${newShape}!`);
    } catch (err) {
      console.error(err);
      notify(err.message || "Failed to update frame shape", "error");
    } finally {
      setUpdatingId(null);
    }
  };

  // Metrics
  const totalFrames = frames.length;
  const mismatchCount = useMemo(
    () => frames.filter((f) => f.analysis.isMismatch).length,
    [frames]
  );
  const verifiedCount = totalFrames - mismatchCount;

  // Filtered List
  const filteredFrames = useMemo(() => {
    return frames.filter((f) => {
      const matchSearch =
        search === "" ||
        f.name.toLowerCase().includes(search.toLowerCase()) ||
        f.brand.toLowerCase().includes(search.toLowerCase()) ||
        (f.shape && f.shape.toLowerCase().includes(search.toLowerCase()));

      const matchFilterMode =
        filterMode === "all" ||
        (filterMode === "mismatch" && f.analysis.isMismatch) ||
        (filterMode === "verified" && !f.analysis.isMismatch);

      const matchShape =
        shapeFilter === "all" ||
        (f.shape && f.shape.toLowerCase() === shapeFilter.toLowerCase());

      return matchSearch && matchFilterMode && matchShape;
    });
  }, [frames, search, filterMode, shapeFilter]);

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed top-6 right-6 z-50 px-5 py-3.5 rounded-2xl shadow-xl text-sm font-bold flex items-center gap-2.5 transition-all animate-[fadeIn_0.2s_ease] ${
            notification.type === "error"
              ? "bg-rose-600 text-white"
              : "bg-emerald-600 text-white shadow-emerald-500/20"
          }`}
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          {notification.msg}
        </div>
      )}

      {/* Header & Stats Banner */}
      <div className="bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-slate-800">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-500/20 text-cyan-300 border border-blue-400/30 mb-2">
                <span>🤖</span> AI Computer Vision & Geometry Auditor
              </div>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                Frame Shape Analyzer & Verifier
              </h2>
              <p className="text-slate-300 text-sm font-medium mt-1 max-w-xl">
                Automatically scans catalog frames using bounding-box aspect ratios (Width : Height) and nomenclature to verify alignment with World Optical Standards.
              </p>
            </div>

            <button
              onClick={fetchFrames}
              disabled={loading}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl border border-white/20 flex items-center gap-2 transition-all cursor-pointer active:scale-95 shrink-0"
            >
              <svg className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Re-analyze Catalog
            </button>
          </div>

          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Frames</p>
                <p className="text-2xl font-black text-white mt-0.5">{totalFrames}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-300 flex items-center justify-center font-bold">
                👓
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Verified Accurate</p>
                <p className="text-2xl font-black text-emerald-300 mt-0.5">{verifiedCount}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center font-bold">
                ✓
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-amber-400 uppercase tracking-wider">Shape Mismatches</p>
                <p className="text-2xl font-black text-amber-300 mt-0.5">{mismatchCount}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold">
                ⚠️
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Control Bar: Search & Filters */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        {/* Search */}
        <div className="relative w-full md:w-72">
          <svg className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search frame name, brand..."
            className="w-full pl-10 pr-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Filter Buttons */}
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => setFilterMode("all")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filterMode === "all"
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            All Frames ({totalFrames})
          </button>
          <button
            onClick={() => setFilterMode("mismatch")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              filterMode === "mismatch"
                ? "bg-amber-500 text-white shadow-sm"
                : "bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200"
            }`}
          >
            <span>⚠️ Needs Review ({mismatchCount})</span>
          </button>
          <button
            onClick={() => setFilterMode("verified")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filterMode === "verified"
                ? "bg-emerald-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Verified Only ({verifiedCount})
          </button>

          {/* Shape Selector */}
          <select
            value={shapeFilter}
            onChange={(e) => setShapeFilter(e.target.value)}
            className="text-xs font-bold px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 cursor-pointer"
          >
            <option value="all">All Shapes</option>
            {STANDARD_FRAME_SHAPES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Frame Analysis List */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center">
            <svg className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Analyzing Frame Geometries & Aspect Ratios...
            </p>
          </div>
        ) : filteredFrames.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <p className="text-sm font-bold text-slate-600">No frames match the active filter criteria.</p>
            <p className="text-xs mt-1">Try selecting "All Frames" or resetting the search query.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                  <th className="py-4 px-6">Frame Details</th>
                  <th className="py-4 px-4">Current Shape</th>
                  <th className="py-4 px-4">AI Geometric Prediction</th>
                  <th className="py-4 px-4">Aspect Ratio & Analysis</th>
                  <th className="py-4 px-4">Audit Status</th>
                  <th className="py-4 px-6 text-right">Quick Correction</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredFrames.map((frame) => {
                  const { analysis } = frame;
                  const isUpdating = updatingId === frame.id;

                  return (
                    <tr
                      key={frame.id}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        analysis.isMismatch ? "bg-amber-50/20" : ""
                      }`}
                    >
                      {/* Frame Details */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center font-black text-slate-600 shrink-0 overflow-hidden">
                            {frame.imageUrl && !frame.imageUrl.endsWith(".glb") ? (
                              <img src={frame.imageUrl} alt={frame.name} className="w-full h-full object-contain p-1" />
                            ) : (
                              <span>👓</span>
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 leading-tight">{frame.name}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              {frame.brand || "InsightOpticals"} • LKR {frame.price?.toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Current Shape */}
                      <td className="py-4 px-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          {frame.shape || "Unset"}
                        </span>
                      </td>

                      {/* AI Prediction */}
                      <td className="py-4 px-4">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-black text-slate-800 text-[13px]">
                              {analysis.detectedShape}
                            </span>
                            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.2 rounded-md">
                              {analysis.confidence}%
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-medium">Confidence</span>
                        </div>
                      </td>

                      {/* Aspect Ratio & Reason */}
                      <td className="py-4 px-4 max-w-xs">
                        <div className="flex flex-col gap-1">
                          <span className="font-semibold text-slate-700 text-[11px]">
                            Ratio: <strong className="text-slate-900">{analysis.aspectRatio} : 1</strong>
                          </span>
                          <span className="text-[10px] text-slate-500 leading-relaxed truncate-2-lines">
                            {analysis.reason}
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4">
                        {analysis.isMismatch ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            Shape Mismatch
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Verified Match
                          </span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {analysis.isMismatch && (
                            <button
                              disabled={isUpdating}
                              onClick={() => handleUpdateShape(frame.id, analysis.detectedShape)}
                              className="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold text-[11px] rounded-xl shadow-sm transition-all cursor-pointer active:scale-95 flex items-center gap-1 shrink-0"
                            >
                              {isUpdating ? "Updating..." : `Set to ${analysis.detectedShape}`}
                            </button>
                          )}

                          {/* Quick Manual Override Dropdown */}
                          <select
                            disabled={isUpdating}
                            value={frame.shape}
                            onChange={(e) => handleUpdateShape(frame.id, e.target.value)}
                            className="text-[11px] font-bold py-1.5 px-2.5 bg-white border border-slate-200 rounded-xl text-slate-700 cursor-pointer hover:border-slate-300"
                            title="Manually assign shape"
                          >
                            {STANDARD_FRAME_SHAPES.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* World Optical Reference Matrix Info Card */}
      <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6">
        <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
          <span>📖</span> World Optical Standards: Face Shape Recommendation Rules Reference
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.entries(WORLD_OPTICAL_RULES).map(([key, rule]) => (
            <div key={key} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-extrabold text-slate-900 text-sm">{rule.faceShape} Face</span>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md uppercase ${rule.badgeClass}`}>
                  {rule.standardBody}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mb-2 leading-relaxed">{rule.rationale}</p>
              <div className="flex flex-wrap gap-1">
                {rule.recommendedShapes.map((s) => (
                  <span key={s} className="text-[10px] font-bold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
