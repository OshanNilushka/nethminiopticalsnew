import React, { useState, useEffect } from "react";
import { API_BASE_URL } from "../../config/api";
import {
  Sparkles,
  User,
  Eye,
  Activity,
  Award,
  CheckCircle2,
  AlertTriangle,
  Printer,
  Save,
  RotateCcw,
  Search,
  Layers,
  ShieldCheck,
  Sun,
  Monitor,
  Car,
  Zap,
  Info,
  ChevronRight,
  ArrowLeft,
  Glasses
} from "lucide-react";

// Scientific face shape optical principles based on World Optical Dispensing Standards
// Face shape optical dispensing matrix
const FACE_SHAPE_OPTICS = {
  Oval: {
    name: "Oval",
    trait: "Balanced proportions",
    principle: "Natural Proportion",
    recommendedShapes: ["Rectangle", "Geometric", "Square", "Aviator", "Wayfarer"],
    avoid: "Oversized frames"
  },
  Round: {
    name: "Round",
    trait: "Soft curved contours",
    principle: "Angular Contrast",
    recommendedShapes: ["Rectangle", "Square", "Geometric", "Wayfarer"],
    avoid: "Small circular rims"
  },
  Square: {
    name: "Square",
    trait: "Strong angular jawline",
    principle: "Curved Softening",
    recommendedShapes: ["Round", "Oval", "Aviator", "Cat Eye"],
    avoid: "Boxy square rims"
  },
  Heart: {
    name: "Heart",
    trait: "Broad brow, narrow chin",
    principle: "Base Widening",
    recommendedShapes: ["Round", "Oval", "Aviator", "Light Rimless"],
    avoid: "Top-heavy frames"
  },
  Diamond: {
    name: "Diamond",
    trait: "High sculpted cheekbones",
    principle: "Cheekbone Softening",
    recommendedShapes: ["Cat Eye", "Oval", "Round", "Browline", "Aviator"],
    avoid: "Narrow horizontal frames"
  },
  Oblong: {
    name: "Oblong",
    trait: "Elongated facial length",
    principle: "Vertical Depth",
    recommendedShapes: ["Aviator", "Wayfarer", "Square", "Geometric"],
    avoid: "Short low-profile rims"
  }
};

export default function LensFrameAdvisor() {
  const [activeView, setActiveView] = useState("advisor"); // "advisor" | "saved"
  const [step, setStep] = useState(1);
  const [notification, setNotification] = useState(null);

  // Registered Patients & Live Catalog Data
  const [patients, setPatients] = useState([]);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [patientSearch, setPatientSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState(null);

  const [dbLenses, setDbLenses] = useState([]);
  const [dbProducts, setDbProducts] = useState([]);
  const [loadingData, setLoadingData] = useState(false);

  // Clinical Profile State
  const [profile, setProfile] = useState({
    patientName: "",
    age: "",
    gender: "Unisex",
    odSph: 0.0,
    odCyl: 0.0,
    odAxis: 180,
    odAdd: 0.0,
    osSph: 0.0,
    osCyl: 0.0,
    osAxis: 180,
    osAdd: 0.0,
    pd: 63.0,
    faceShape: "Oval",
    screenTime: "heavy", // "light" | "moderate" | "heavy"
    environment: "office", // "office" | "outdoor" | "mixed"
    impactRisk: false, // active sports or hazardous vocation (ANSI Z87.1)
    symptoms: {
      nightDrivingGlaring: false,
      photophobia: false,
      digitalFatigue: true,
      highSweatDust: false,
    },
    budgetTier: "balanced", // "economic" | "balanced" | "premium"
    clinicalNotes: "",
  });

  // Selected matched frame from inventory for bundle computation
  const [selectedFrame, setSelectedFrame] = useState(null);
  const [recommendationResult, setRecommendationResult] = useState(null);
  const [savedConsultations, setSavedConsultations] = useState(() => {
    try {
      const stored = localStorage.getItem("optician_saved_consultations");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const notify = (msg, type = "success") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  };

  // Fetch initial data (patients, lenses, frames)
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoadingData(true);
    const token = localStorage.getItem("token");

    try {
      // 1. Fetch live lenses
      const lensRes = await fetch(`${API_BASE_URL}/api/products/lenses`);
      if (lensRes.ok) {
        const lenses = await lensRes.json();
        setDbLenses(lenses);
      }

      // 2. Fetch live frames
      const prodRes = await fetch(`${API_BASE_URL}/api/products`);
      if (prodRes.ok) {
        const prods = await prodRes.json();
        setDbProducts(prods);
      }

      // 3. Fetch patients if authenticated optician
      if (token) {
        setLoadingPatients(true);
        const patRes = await fetch(`${API_BASE_URL}/api/prescriptions/patients`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (patRes.ok) {
          const patData = await patRes.json();
          setPatients(patData);
        }
        setLoadingPatients(false);
      }
    } catch (err) {
      console.error("Failed to load clinical advisor data:", err);
    } finally {
      setLoadingData(false);
    }
  };

  // Active selected prescription id (when customer has multiple)
  const [selectedRxId, setSelectedRxId] = useState("");
  // Auto-detected face shape from customer's AR virtual mirror scan
  const [autoDetectedShape, setAutoDetectedShape] = useState(null);

  const applyPrescriptionToProfile = (patient, rx) => {
    // Check for saved face shape in localStorage from virtual mirror
    let autoFaceShape = profile.faceShape || "Oval";
    let detected = null;

    if (patient?.email) {
      try {
        const savedShape = localStorage.getItem(`face_shape_${patient.email}`);
        if (savedShape) {
          const matchedKey = Object.keys(FACE_SHAPE_OPTICS).find(
            k => k.toLowerCase() === savedShape.toLowerCase().trim()
          );
          if (matchedKey) {
            autoFaceShape = matchedKey;
            detected = matchedKey;
          }
        }
      } catch (e) {
        console.error("Error reading saved face shape:", e);
      }
    }

    setAutoDetectedShape(detected);

    setProfile(prev => ({
      ...prev,
      patientName: patient?.fullName || prev.patientName,
      age: patient?.dob ? (new Date().getFullYear() - new Date(patient.dob).getFullYear()) : (prev.age || ""),
      gender: patient?.gender === "Female" ? "Female" : patient?.gender === "Male" ? "Male" : "Unisex",
      faceShape: autoFaceShape,
      odSph: rx?.odSph !== null && rx?.odSph !== undefined ? Number(rx.odSph) : 0.0,
      odCyl: rx?.odCyl !== null && rx?.odCyl !== undefined ? Number(rx.odCyl) : 0.0,
      odAxis: rx?.odAxis !== null && rx?.odAxis !== undefined ? Number(rx.odAxis) : 180,
      odAdd: rx?.odAdd !== null && rx?.odAdd !== undefined ? Number(rx.odAdd) : 0.0,
      osSph: rx?.osSph !== null && rx?.osSph !== undefined ? Number(rx.osSph) : 0.0,
      osCyl: rx?.osCyl !== null && rx?.osCyl !== undefined ? Number(rx.osCyl) : 0.0,
      osAxis: rx?.osAxis !== null && rx?.osAxis !== undefined ? Number(rx.osAxis) : 180,
      osAdd: rx?.osAdd !== null && rx?.osAdd !== undefined ? Number(rx.osAdd) : 0.0,
      pd: rx?.pd !== null && rx?.pd !== undefined ? Number(rx.pd) : 63.0,
      clinicalNotes: rx
        ? `Doctor verified Rx #${rx.id.slice(0, 8)} (${new Date(rx.createdAt).toLocaleDateString()}) - ${rx.status || "VALIDATED"}`
        : `Patient file: ${patient?.fullName || "Walk-In"} (${patient?.email || ""}). No prescription on record.`,
    }));
  };

  // Auto-populate patient clinical metrics when selected from dropdown
  const handleSelectPatient = (patient) => {
    setSelectedPatient(patient);
    
    // Auto-select latest or validated prescription
    const rxs = patient.prescriptionsAsPatient || [];
    const bestRx = rxs.find(r => r.isValidated || r.status === "VALIDATED") || rxs[0] || null;
    setSelectedRxId(bestRx ? bestRx.id : "");

    applyPrescriptionToProfile(patient, bestRx);

    if (bestRx) {
      notify(`Auto-filled ${patient.fullName}'s profile & Doctor Prescription (OD/OS/PD)!`);
    } else {
      notify(`Auto-filled ${patient.fullName}'s profile. (No prescription on file — enter refraction below).`, "info");
    }
  };

  const handleSelectSpecificRx = (rxId) => {
    setSelectedRxId(rxId);
    if (!selectedPatient) return;
    const rx = (selectedPatient.prescriptionsAsPatient || []).find(r => r.id === rxId);
    if (rx) {
      applyPrescriptionToProfile(selectedPatient, rx);
      notify(`Switched to prescription dated ${new Date(rx.createdAt).toLocaleDateString()}`);
    }
  };

  const handleClearPatient = () => {
    setSelectedPatient(null);
    setSelectedRxId("");
    setAutoDetectedShape(null);
    setProfile(prev => ({
      ...prev,
      patientName: "",
      age: "",
      gender: "Unisex",
      faceShape: "Oval",
      odSph: 0.0,
      odCyl: 0.0,
      odAxis: 180,
      odAdd: 0.0,
      osSph: 0.0,
      osCyl: 0.0,
      osAxis: 180,
      osAdd: 0.0,
      pd: 63.0,
      clinicalNotes: "",
    }));
    notify("Cleared customer selection. Ready for walk-in refraction.");
  };

  // -------------------------------------------------------------
  // Evidence-Based Clinical Recommendation Engine
  // -------------------------------------------------------------
  const calculateEvidenceBasedDispensing = () => {
    const odPower = Math.abs(Number(profile.odSph)) + Math.abs(Number(profile.odCyl));
    const osPower = Math.abs(Number(profile.osSph)) + Math.abs(Number(profile.osCyl));
    const maxPower = Math.max(odPower, osPower);
    const meanSph = (Number(profile.odSph) + Number(profile.osSph)) / 2;
    const isMyope = meanSph < 0;
    const maxCyl = Math.max(Math.abs(Number(profile.odCyl)), Math.abs(Number(profile.osCyl)));
    const hasAstigmatism = maxCyl >= 1.25;
    const isPresbyopic = Number(profile.odAdd) > 0 || Number(profile.osAdd) > 0 || (Number(profile.age) >= 42);

    // 1. Material & Index Selection (Jalie's Sizing Law & ANSI Standards)
    let recommendedIndex = "1.50";
    let materialName = "CR-39 Standard Organic Resin";
    let abbeValue = "58 (Maximum optical purity, zero chromatic aberration)";
    let thicknessRationale = "Standard thickness; ideal for mild prescriptions up to ±2.25D.";

    if (profile.impactRisk) {
      recommendedIndex = "1.59";
      materialName = "Polycarbonate / Trivex (Impact Certified)";
      abbeValue = "31 - 45 (ANSI Z87.1 High-Velocity Ballistic Tested)";
      thicknessRationale = "Shatterproof safety material mandatory for athletic activities, ball sports, and occupational hazards.";
    } else if (maxPower > 7.00) {
      recommendedIndex = "1.74";
      materialName = "1.74 Ultra High-Index Bi-Aspheric";
      abbeValue = "33 (High Dispersion Control)";
      thicknessRationale = "Reduces edge thickness by ~45% and eliminates heavy bridge nasal indentation for severe refractive errors.";
    } else if (maxPower >= 4.50) {
      recommendedIndex = "1.67";
      materialName = "1.67 High-Index Aspheric";
      abbeValue = "32 (Precision Aspheric Surfacing)";
      thicknessRationale = "33% thinner and flatter profile. Significantly reduces 'minified eye' appearance in high myopia.";
    } else if (maxPower >= 2.50) {
      recommendedIndex = "1.60";
      materialName = "1.60 MR-8 High Tensile Resin";
      abbeValue = "42 (High Abbe Clarity)";
      thicknessRationale = "20-25% thinner profile with superior tensile strength, ideal for rimless, semi-rimless, and full-rim mounts.";
    }

    // 2. Optical Focal Design Selection
    let focalDesign = "Single Vision Aspheric";
    let designRationale = "Custom spherical/aspheric curve providing razor-sharp central and paraxial optical acuity.";

    if (isPresbyopic) {
      if (profile.screenTime === "heavy") {
        focalDesign = "Occupational / Office Progressive (Degressive Corridor)";
        designRationale = "Extra-wide intermediate computer zone optimized for dual monitors and desktop ergonomics without neck tilting.";
      } else {
        focalDesign = "Freeform Digital Progressive (All-Distance HD)";
        designRationale = "Continuous smooth focal corridor from optical infinity down to 40cm reading plane with zero image jump.";
      }
    } else if (hasAstigmatism) {
      focalDesign = "Atoric / Freeform Single Vision";
      designRationale = "Dual-surface atoric geometry eliminates oblique astigmatic aberrations across peripheral eye sweeps.";
    }

    // 3. Coating & Surface Treatments (Rosenfield Digital Strain + ISO 8980-4)
    const coatings = [];
    const clinicalCoatingsRationale = [];

    if (profile.screenTime === "heavy" || profile.symptoms.digitalFatigue) {
      coatings.push("BlueCut UV420 + Multi-Layer Anti-Glare");
      clinicalCoatingsRationale.push("Filters harmful 380-450nm high-energy visible blue light to preserve retinal contrast and reduce asthenopia (digital strain).");
    }

    if (profile.environment === "outdoor" || profile.symptoms.photophobia) {
      coatings.push("Photochromic Transitions Gen 8 (Light Intelligent)");
      clinicalCoatingsRationale.push("Rapid molecular matrix darkening under solar UV (Category 3 sun tint) with 100% UVA/UVB blocking.");
    }

    if (profile.symptoms.nightDrivingGlaring) {
      coatings.push("High-Transmission Anti-Reflective (AR) Night Coat");
      clinicalCoatingsRationale.push("Reduces headlight starbursts and reflection halos by maintaining 99.6% light transmission.");
    }

    coatings.push("Super-Hydrophobic & Oleophobic Scratch Shield");
    clinicalCoatingsRationale.push("Repels water, dust, and facial oils for crystal clarity and high scratch endurance.");

    // 4. Match With Live Database Lens Catalog & Clinical Standards
    const CLINICAL_LENS_LIBRARY = [
      { id: "lens-prog", type: "Carl Zeiss Progressive Digital HD Lens", brand: "Carl Zeiss", price: 18500, description: "Precision progressive multi-focal lens for smooth distance to near vision" },
      { id: "lens-hi", type: "1.67 Ultra-Thin High-Index Lens", brand: "Hoya", price: 11500, description: "High-index ultra slim lightweight lens designed for stronger prescription powers" },
      { id: "lens-trans", type: "Essilor Transitions Gen 8 Photochromic Lens", brand: "Essilor", price: 14000, description: "Smart light-adaptive: clear indoors, darkens automatically to sunglasses outdoors" },
      { id: "lens-blue", type: "Lens 1 - BlueCut Precision Optical Lens", brand: "Essilor Crizal", price: 8500, description: "UV420 Blue-light blocker filtering computer and phone screen glare" },
      { id: "lens-ar", type: "Crizal Anti-Reflective Hydrophobic Lens", brand: "Essilor", price: 6500, description: "Hydrophobic, smudge-resistant anti-glare coating for night driving" },
      { id: "lens-std", type: "Standard Hard-Coated Scratch Resistant Lens", brand: "Standard", price: 3500, description: "Durable daily optical lens with scratch resistant hard coating and UV protection" }
    ];

    const allAvailableLenses = [...dbLenses, ...CLINICAL_LENS_LIBRARY];

    const normalizeLensPrice = (lens) => {
      if (!lens) return 3500;
      const p = Number(lens.price) || 0;
      if (p >= 1000) return p;
      if (p <= 25) return 3500;
      if (p <= 50) return 8500;
      if (p <= 80) return 11500;
      return Math.round(p * 300);
    };

    let bestDbLens = null;

    if (isPresbyopic) {
      bestDbLens = allAvailableLenses.find(l => l.type.toLowerCase().includes("progressive")) || CLINICAL_LENS_LIBRARY[0];
    } else if (maxPower >= 4.50) {
      bestDbLens = allAvailableLenses.find(l => l.type.toLowerCase().includes("1.67") || l.type.toLowerCase().includes("high-index")) || CLINICAL_LENS_LIBRARY[1];
    } else if (profile.environment === "outdoor" || profile.symptoms.photophobia) {
      bestDbLens = allAvailableLenses.find(l => l.type.toLowerCase().includes("transition") || l.type.toLowerCase().includes("photochromic")) || CLINICAL_LENS_LIBRARY[2];
    } else if (profile.screenTime === "heavy" || profile.symptoms.digitalFatigue) {
      bestDbLens = allAvailableLenses.find(l => l.type.toLowerCase().includes("bluecut") || l.type.toLowerCase().includes("blue")) || CLINICAL_LENS_LIBRARY[3];
    } else if (profile.symptoms.nightDrivingGlaring) {
      bestDbLens = allAvailableLenses.find(l => l.type.toLowerCase().includes("anti-reflective") || l.type.toLowerCase().includes("crizal")) || CLINICAL_LENS_LIBRARY[4];
    } else {
      bestDbLens = allAvailableLenses.find(l => l.type.toLowerCase().includes("standard") || l.type.toLowerCase().includes("single vision")) || CLINICAL_LENS_LIBRARY[5];
    }

    // Ensure price is normalized
    bestDbLens = {
      ...bestDbLens,
      price: normalizeLensPrice(bestDbLens)
    };

    // 5. Frame Morphology Compatibility & Database Match
    const faceOptics = FACE_SHAPE_OPTICS[profile.faceShape] || FACE_SHAPE_OPTICS.Oval;

    // Filter and score database frames
    const rankedFrames = dbProducts.map(frame => {
      const frameShapeLower = (frame.shape || "").toLowerCase();
      let matchScore = 70;
      let clinicalNote = "Standard compatibility.";

      const isDirectMatch = faceOptics.recommendedShapes.some(rs => rs.toLowerCase() === frameShapeLower);
      if (isDirectMatch) {
        matchScore = 96;
        clinicalNote = `Optimal optical geometry. ${faceOptics.principle} balances ${profile.faceShape} face.`;
      } else {
        matchScore = 78;
        clinicalNote = "Acceptable aesthetic fit; ensure proper temple width.";
      }

      // Check for high power frame limitations (Jalie rule: avoid rimless/oversized for high minus)
      if (maxPower >= 4.50 && isMyope) {
        if (frame.material?.toLowerCase().includes("titanium rimless") || frame.name?.toLowerCase().includes("rimless")) {
          matchScore -= 25;
          clinicalNote = "Caution: Rimless mounting exposes thick minus lens edges. Acetate full-rim strongly advised.";
        } else if (frame.material?.toLowerCase().includes("acetate")) {
          matchScore += 3;
          clinicalNote = "Excellent: Full-rim acetate effectively conceals bevel edge thickness.";
        }
      }

      return {
        ...frame,
        matchScore,
        clinicalNote,
      };
    }).sort((a, b) => b.matchScore - a.matchScore);

    const generated = {
      timestamp: new Date().toISOString(),
      patientName: profile.patientName || "Walk-In Patient",
      age: profile.age || "N/A",
      faceShape: profile.faceShape,
      faceOptics,
      refractiveMetrics: {
        maxPower: maxPower.toFixed(2),
        isMyope,
        isPresbyopic,
        hasAstigmatism,
        meanSph: meanSph.toFixed(2),
        od: `SPH ${profile.odSph >= 0 ? "+" : ""}${Number(profile.odSph).toFixed(2)} | CYL ${Number(profile.odCyl).toFixed(2)} × ${profile.odAxis}° | ADD +${Number(profile.odAdd).toFixed(2)}`,
        os: `SPH ${profile.osSph >= 0 ? "+" : ""}${Number(profile.osSph).toFixed(2)} | CYL ${Number(profile.osCyl).toFixed(2)} × ${profile.osAxis}° | ADD +${Number(profile.osAdd).toFixed(2)}`,
        pd: `${profile.pd} mm`,
      },
      lensSolution: {
        focalDesign,
        designRationale,
        recommendedIndex,
        materialName,
        abbeValue,
        thicknessRationale,
        coatings,
        clinicalCoatingsRationale,
        dbLens: bestDbLens || {
          type: "BlueCut Precision Optical Lens",
          brand: "Essilor Crizal",
          price: 8500.0,
          description: "High-grade optical lens with integrated digital protection",
        },
      },
      rankedFrames: rankedFrames.slice(0, 6),
    };

    setRecommendationResult(generated);
    if (generated.rankedFrames.length > 0) {
      setSelectedFrame(generated.rankedFrames[0]);
    }
    setStep(4);
  };

  const handleSaveConsultation = () => {
    if (!recommendationResult) return;

    const consultation = {
      id: Date.now(),
      date: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
      patientName: recommendationResult.patientName,
      faceShape: recommendationResult.faceShape,
      maxPower: recommendationResult.refractiveMetrics.maxPower,
      lensType: recommendationResult.lensSolution.dbLens.type,
      frameName: selectedFrame?.name || "No frame selected",
      totalLkr: (Number(selectedFrame?.price || 0) + Number(recommendationResult.lensSolution.dbLens.price || 0)).toLocaleString(),
      notes: profile.clinicalNotes,
    };

    const updated = [consultation, ...savedConsultations];
    setSavedConsultations(updated);
    try {
      localStorage.setItem("optician_saved_consultations", JSON.stringify(updated));
    } catch (e) {
      console.error("Failed to persist consultation:", e);
    }

    notify("Consultation profile saved successfully!");
  };

  const handlePrintPlan = () => {
    window.print();
  };

  const resetAdvisor = () => {
    setStep(1);
    setSelectedPatient(null);
    setSelectedFrame(null);
    setRecommendationResult(null);
  };

  return (
    <div className="p-4 sm:p-7 max-w-[1280px] mx-auto">
      {/* Toast Notification */}
      {notification && (
        <div className={`fixed top-6 right-6 z-50 px-5 py-3.5 rounded-2xl shadow-2xl text-sm font-bold flex items-center gap-3 transition-all animate-bounce ${
          notification.type === "error" ? "bg-rose-600 text-white" : "bg-emerald-600 text-white"
        }`}>
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{notification.msg}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-7 bg-gradient-to-r from-slate-900 via-[#0f2d45] to-[#1b5e85] text-white p-6 rounded-3xl shadow-lg relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-blue-300 text-xs font-black uppercase tracking-wider mb-1">
            <Award className="w-4 h-4" />
            <span>Clinical Optometry Dispensing Protocol</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Lens & Frame Clinical Advisor</h1>
          <p className="text-slate-300 text-sm mt-1 max-w-xl font-medium">
            Evidence-based optical recommendation engine applying Jalie's lens thickness laws, Rosenfield's digital strain mitigations, and facial morphology geometry.
          </p>
        </div>

        <div className="relative z-10 flex gap-2 shrink-0">
          <button
            onClick={() => setActiveView("advisor")}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeView === "advisor"
                ? "bg-white text-slate-900 shadow-md"
                : "bg-white/15 text-white hover:bg-white/25"
            }`}
          >
            <Sparkles className="w-4 h-4 text-blue-400" />
            Advisor Engine
          </button>
          <button
            onClick={() => setActiveView("saved")}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeView === "saved"
                ? "bg-white text-slate-900 shadow-md"
                : "bg-white/15 text-white hover:bg-white/25"
            }`}
          >
            <Save className="w-4 h-4 text-emerald-400" />
            Saved Consultations ({savedConsultations.length})
          </button>
        </div>
      </div>

      {/* VIEW: Saved Consultations History */}
      {activeView === "saved" && (
        <div className="bg-white rounded-3xl border border-slate-100 p-6 sm:p-8 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900">Saved Patient Dispensing Records</h2>
              <p className="text-slate-500 text-sm">Archived clinical consultations and bundle recommendations</p>
            </div>
            <button
              onClick={() => setActiveView("advisor")}
              className="px-4 py-2 bg-[#1b5e85] text-white text-xs font-bold rounded-xl hover:bg-[#154d70] transition-colors flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              New Assessment
            </button>
          </div>

          {savedConsultations.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-3xl">
              <Glasses className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-bold text-base">No saved dispensing consultations yet</p>
              <p className="text-slate-400 text-xs mt-1">Run a clinical assessment and click "Save Consultation" to archive records here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 text-xs font-bold uppercase tracking-wider">
                    <th className="pb-3">Date</th>
                    <th className="pb-3">Patient</th>
                    <th className="pb-3">Face Shape</th>
                    <th className="pb-3">Max Diopter</th>
                    <th className="pb-3">Recommended Lens</th>
                    <th className="pb-3">Matched Frame</th>
                    <th className="pb-3 text-right">Package (LKR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {savedConsultations.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 text-slate-500 text-xs font-medium">{c.date}</td>
                      <td className="py-3.5 font-bold text-slate-900">{c.patientName}</td>
                      <td className="py-3.5">
                        <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs font-bold border border-blue-100">
                          {c.faceShape}
                        </span>
                      </td>
                      <td className="py-3.5 font-bold text-slate-700">±{c.maxPower}D</td>
                      <td className="py-3.5 text-slate-700 font-medium text-xs max-w-[200px] truncate">{c.lensType}</td>
                      <td className="py-3.5 text-slate-700 font-medium text-xs">{c.frameName}</td>
                      <td className="py-3.5 text-right font-black text-emerald-600">LKR {c.totalLkr}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* VIEW: Clinical Advisor Stepper */}
      {activeView === "advisor" && (
        <div>
          {/* Multi-Step Progress Tracker */}
          <div className="flex items-center gap-2 sm:gap-4 mb-8 bg-white p-4 sm:p-5 rounded-2xl border border-slate-100 shadow-sm">
            {[
              { num: 1, title: "Patient & Rx", desc: "Clinical metrics" },
              { num: 2, title: "Facial Optics", desc: "Biometric morphology" },
              { num: 3, title: "Lifestyle Audit", desc: "Environmental demands" },
              { num: 4, title: "Dispensing Plan", desc: "Live recommendations" },
            ].map((s) => (
              <div key={s.num} className="flex items-center gap-3 flex-1">
                <div
                  className={`w-9 h-9 sm:w-10 sm:h-10 rounded-2xl flex items-center justify-center text-sm font-extrabold shrink-0 transition-all ${
                    step >= s.num
                      ? "bg-[#1b5e85] text-white shadow-md shadow-blue-900/20"
                      : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {step > s.num ? <CheckCircle2 className="w-5 h-5 text-emerald-300" /> : s.num}
                </div>
                <div className="hidden md:block">
                  <p className={`text-xs font-black uppercase tracking-wider ${step >= s.num ? "text-[#1b5e85]" : "text-slate-400"}`}>
                    {s.title}
                  </p>
                  <p className="text-[11px] text-slate-400 font-medium">{s.desc}</p>
                </div>
                {s.num < 4 && <div className={`flex-1 h-0.5 rounded-full transition-all ${step > s.num ? "bg-[#1b5e85]" : "bg-slate-100"}`} />}
              </div>
            ))}
          </div>

          {/* STEP 1: Patient & Prescription Metrics */}
          {step === 1 && (
            <div className="bg-white rounded-3xl border border-slate-100 p-6 sm:p-8 shadow-sm space-y-6">
              <div className="space-y-4 pb-6 border-b border-slate-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
                      <User className="w-5 h-5 text-[#1b5e85]" />
                      Step 1: Patient Refractive Diagnosis
                    </h2>
                    <p className="text-slate-500 text-sm mt-0.5">
                      Select any registered customer from the dropdown to automatically import their profile and clinical prescription.
                    </p>
                  </div>

                  {patients.length > 0 && (
                    <span className="px-3 py-1 bg-blue-50 text-[#1b5e85] border border-blue-200/70 rounded-full text-xs font-extrabold self-start sm:self-auto">
                      {patients.length} Registered Customers
                    </span>
                  )}
                </div>

                {/* Primary Customer Selection Dropdown Box */}
                <div className="bg-gradient-to-r from-blue-50/70 via-slate-50 to-blue-50/40 p-4 sm:p-5 rounded-2xl border border-blue-200/80 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[#1b5e85]" />
                      Select Registered Customer (Auto-Populate Profile & Rx)
                    </label>
                    {selectedPatient && (
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                        ✓ Profile & Rx Auto-Loaded
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <div className="relative flex-1 w-full">
                      <select
                        value={selectedPatient?.id || ""}
                        onChange={(e) => {
                          const patId = e.target.value;
                          if (!patId) {
                            handleClearPatient();
                          } else {
                            const found = patients.find(p => p.id === patId);
                            if (found) handleSelectPatient(found);
                          }
                        }}
                        className="w-full bg-white border-2 border-slate-300 hover:border-[#1b5e85] focus:border-[#1b5e85] rounded-xl px-4 py-3 text-xs md:text-sm font-bold text-slate-800 shadow-xs focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all cursor-pointer"
                      >
                        <option value="">
                          -- Select Registered Customer (Click to Auto-Fill Information) --
                        </option>
                        {patients.map((p) => {
                          const rxCount = p.prescriptionsAsPatient?.length || 0;
                          const hasRx = rxCount > 0;
                          return (
                            <option key={p.id} value={p.id}>
                              {p.fullName} ({p.email}) — {hasRx ? `✓ ${rxCount} Prescription${rxCount > 1 ? 's' : ''} on file` : "No Rx on file"}
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    {selectedPatient && (
                      <button
                        type="button"
                        onClick={handleClearPatient}
                        className="px-4 py-3 bg-white border border-rose-200 hover:bg-rose-50 text-rose-600 font-bold text-xs rounded-xl shadow-xs transition-colors shrink-0 flex items-center gap-1.5"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Clear Selection
                      </button>
                    )}
                  </div>

                  {/* Active Patient & Prescription Indicator Card */}
                  {selectedPatient && (
                    <div className="mt-3 p-4 bg-white border border-blue-200 rounded-2xl shadow-xs space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-[#1b5e85] text-white flex items-center justify-center font-black text-sm shadow-xs">
                            {selectedPatient.fullName?.[0]?.toUpperCase()}
                          </div>
                          <div>
                            <p className="font-black text-slate-900 text-sm flex items-center gap-2">
                              {selectedPatient.fullName}
                              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold">
                                Active Customer
                              </span>
                            </p>
                            <p className="text-xs text-slate-500 font-medium mt-0.5 flex items-center gap-2 flex-wrap">
                              <span>{selectedPatient.email}</span>
                              <span>·</span>
                              <span>Phone: {selectedPatient.phoneNumber || "N/A"}</span>
                              <span>·</span>
                              <span>Age: {profile.age || "N/A"}</span>
                              <span>·</span>
                              <span>Gender: {profile.gender}</span>
                              {autoDetectedShape && (
                                <>
                                  <span>·</span>
                                  <span className="font-extrabold text-[#1b5e85] bg-blue-100/80 px-2 py-0.5 rounded-md text-[11px]">
                                    AR Face Shape: {autoDetectedShape}
                                  </span>
                                </>
                              )}
                            </p>
                          </div>
                        </div>

                        {/* If multiple prescriptions exist, let optician switch */}
                        {selectedPatient.prescriptionsAsPatient?.length > 1 && (
                          <div className="flex items-center gap-2">
                            <label className="text-[11px] font-bold text-slate-600 shrink-0">Prescription Date:</label>
                            <select
                              value={selectedRxId}
                              onChange={(e) => handleSelectSpecificRx(e.target.value)}
                              className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1b5e85]"
                            >
                              {selectedPatient.prescriptionsAsPatient.map((rx) => (
                                <option key={rx.id} value={rx.id}>
                                  {new Date(rx.createdAt).toLocaleDateString()} ({rx.status || "VALIDATED"})
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>

                      {/* Auto-Loaded Prescription Status */}
                      {selectedPatient.prescriptionsAsPatient?.length > 0 ? (
                        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-200/80">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>
                            <strong>Clinical Metrics Imported:</strong> OD & OS Sphere, Cylinder, Axis, ADD, and PD have been automatically loaded into the Refraction Table below.
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-xs font-semibold text-amber-800 bg-amber-50/80 p-2.5 rounded-xl border border-amber-200/80">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>
                            <strong>No Prescription on File:</strong> Customer profile was loaded. You can perform an eye examination and enter new refraction numbers below.
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Patient Basic Demographics */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Patient Full Name</label>
                  <input
                    type="text"
                    value={profile.patientName}
                    onChange={(e) => setProfile(p => ({ ...p, patientName: e.target.value }))}
                    placeholder="e.g. Johnathan Perera"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#1b5e85]/20 focus:border-[#1b5e85]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Age (Years)</label>
                  <input
                    type="number"
                    value={profile.age}
                    onChange={(e) => setProfile(p => ({ ...p, age: e.target.value }))}
                    placeholder="e.g. 38"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#1b5e85]/20 focus:border-[#1b5e85]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Gender Demographic</label>
                  <select
                    value={profile.gender}
                    onChange={(e) => setProfile(p => ({ ...p, gender: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#1b5e85]/20 focus:border-[#1b5e85]"
                  >
                    <option value="Unisex">Unisex / All Styles</option>
                    <option value="Male">Men's Collection</option>
                    <option value="Female">Women's Collection</option>
                  </select>
                </div>
              </div>

              {/* Optical Prescription Matrix */}
              <div className="bg-slate-50/80 p-5 rounded-2xl border border-slate-200">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-2">
                    <Eye className="w-4 h-4 text-[#1b5e85]" />
                    Clinical Refraction Table (Diopters)
                  </p>
                  <span className="text-[11px] text-slate-500 font-medium">Standard 0.25D Step Increments</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs font-bold text-slate-700">
                    <thead>
                      <tr className="text-slate-400 uppercase tracking-wider border-b border-slate-200">
                        <th className="pb-2 text-left w-20">Eye</th>
                        <th className="pb-2 text-center">Sphere (SPH)</th>
                        <th className="pb-2 text-center">Cylinder (CYL)</th>
                        <th className="pb-2 text-center">Axis (deg)</th>
                        <th className="pb-2 text-center">Near Add (ADD)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {/* OD - Right Eye */}
                      <tr>
                        <td className="py-3 font-extrabold text-[#1b5e85]">OD (Right)</td>
                        <td className="py-2 px-1">
                          <input
                            type="number"
                            step="0.25"
                            value={profile.odSph}
                            onChange={(e) => setProfile(p => ({ ...p, odSph: parseFloat(e.target.value) || 0 }))}
                            className="w-full py-1.5 px-2 bg-white border border-slate-200 rounded-lg text-center font-bold focus:outline-none focus:ring-1 focus:ring-[#1b5e85]"
                          />
                        </td>
                        <td className="py-2 px-1">
                          <input
                            type="number"
                            step="0.25"
                            value={profile.odCyl}
                            onChange={(e) => setProfile(p => ({ ...p, odCyl: parseFloat(e.target.value) || 0 }))}
                            className="w-full py-1.5 px-2 bg-white border border-slate-200 rounded-lg text-center font-bold focus:outline-none focus:ring-1 focus:ring-[#1b5e85]"
                          />
                        </td>
                        <td className="py-2 px-1">
                          <input
                            type="number"
                            min="0"
                            max="180"
                            value={profile.odAxis}
                            onChange={(e) => setProfile(p => ({ ...p, odAxis: parseInt(e.target.value) || 0 }))}
                            className="w-full py-1.5 px-2 bg-white border border-slate-200 rounded-lg text-center font-bold focus:outline-none focus:ring-1 focus:ring-[#1b5e85]"
                          />
                        </td>
                        <td className="py-2 px-1">
                          <input
                            type="number"
                            step="0.25"
                            min="0"
                            max="4.00"
                            value={profile.odAdd}
                            onChange={(e) => setProfile(p => ({ ...p, odAdd: parseFloat(e.target.value) || 0 }))}
                            className="w-full py-1.5 px-2 bg-white border border-slate-200 rounded-lg text-center font-bold focus:outline-none focus:ring-1 focus:ring-[#1b5e85]"
                          />
                        </td>
                      </tr>

                      {/* OS - Left Eye */}
                      <tr>
                        <td className="py-3 font-extrabold text-[#1b5e85]">OS (Left)</td>
                        <td className="py-2 px-1">
                          <input
                            type="number"
                            step="0.25"
                            value={profile.osSph}
                            onChange={(e) => setProfile(p => ({ ...p, osSph: parseFloat(e.target.value) || 0 }))}
                            className="w-full py-1.5 px-2 bg-white border border-slate-200 rounded-lg text-center font-bold focus:outline-none focus:ring-1 focus:ring-[#1b5e85]"
                          />
                        </td>
                        <td className="py-2 px-1">
                          <input
                            type="number"
                            step="0.25"
                            value={profile.osCyl}
                            onChange={(e) => setProfile(p => ({ ...p, osCyl: parseFloat(e.target.value) || 0 }))}
                            className="w-full py-1.5 px-2 bg-white border border-slate-200 rounded-lg text-center font-bold focus:outline-none focus:ring-1 focus:ring-[#1b5e85]"
                          />
                        </td>
                        <td className="py-2 px-1">
                          <input
                            type="number"
                            min="0"
                            max="180"
                            value={profile.osAxis}
                            onChange={(e) => setProfile(p => ({ ...p, osAxis: parseInt(e.target.value) || 0 }))}
                            className="w-full py-1.5 px-2 bg-white border border-slate-200 rounded-lg text-center font-bold focus:outline-none focus:ring-1 focus:ring-[#1b5e85]"
                          />
                        </td>
                        <td className="py-2 px-1">
                          <input
                            type="number"
                            step="0.25"
                            min="0"
                            max="4.00"
                            value={profile.osAdd}
                            onChange={(e) => setProfile(p => ({ ...p, osAdd: parseFloat(e.target.value) || 0 }))}
                            className="w-full py-1.5 px-2 bg-white border border-slate-200 rounded-lg text-center font-bold focus:outline-none focus:ring-1 focus:ring-[#1b5e85]"
                          />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 flex items-center justify-between pt-3 border-t border-slate-200 flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <label className="text-xs font-bold text-slate-700">Pupillary Distance (PD mm):</label>
                    <input
                      type="number"
                      step="0.5"
                      value={profile.pd}
                      onChange={(e) => setProfile(p => ({ ...p, pd: parseFloat(e.target.value) || 63 }))}
                      className="w-20 py-1 px-2.5 bg-white border border-slate-200 rounded-lg text-center font-extrabold text-sm text-[#1b5e85]"
                    />
                  </div>
                  <div className="text-xs text-slate-500 font-medium">
                    Calculated Max Dioptric Absolute Power:{" "}
                    <strong className="text-slate-900 font-extrabold">
                      ±{Math.max(
                        Math.abs(Number(profile.odSph)) + Math.abs(Number(profile.odCyl)),
                        Math.abs(Number(profile.osSph)) + Math.abs(Number(profile.osCyl))
                      ).toFixed(2)}D
                    </strong>
                  </div>
                </div>
              </div>

              {/* Navigation */}
              <div className="flex justify-end pt-4">
                <button
                  onClick={() => setStep(2)}
                  className="px-6 py-3 bg-[#1b5e85] hover:bg-[#154d70] text-white text-sm font-bold rounded-2xl shadow-md transition-all flex items-center gap-2"
                >
                  Continue to Facial Optics
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Facial Morphology & Biometrics */}
          {step === 2 && (
            <div className="bg-white rounded-3xl border border-slate-100 p-6 sm:p-8 shadow-sm space-y-5">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">Step 2: Face Shape</h2>
                <p className="text-slate-500 text-xs mt-0.5">Select customer's facial morphology.</p>
              </div>

              {/* Auto-Detected AR Scan Banner */}
              {autoDetectedShape && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs font-bold text-emerald-900">
                  <span>Auto-detected from AR Scan: {autoDetectedShape}</span>
                  <span className="text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded font-black uppercase tracking-wider">
                    Auto-Selected
                  </span>
                </div>
              )}

              {/* 6 Face Shape Buttons (No emoji, no icons, minimal text) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {Object.values(FACE_SHAPE_OPTICS).map((shape) => {
                  const isSelected = profile.faceShape === shape.name;
                  const isAutoScanned = shape.name === autoDetectedShape;
                  return (
                    <button
                      key={shape.name}
                      type="button"
                      onClick={() => setProfile(p => ({ ...p, faceShape: shape.name }))}
                      className={`p-4 rounded-xl border-2 text-left transition-all relative ${
                        isSelected
                          ? "border-[#1b5e85] bg-blue-50/50 shadow-xs ring-2 ring-[#1b5e85]/20"
                          : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
                      }`}
                    >
                      {isAutoScanned && (
                        <span className="absolute top-2.5 right-2.5 px-1.5 py-0.5 bg-emerald-100 border border-emerald-300 text-emerald-800 text-[9px] font-black rounded uppercase">
                          Auto
                        </span>
                      )}
                      <h3 className="font-extrabold text-slate-900 text-sm">{shape.name}</h3>
                      <p className="text-slate-500 text-xs mt-0.5 font-medium">{shape.trait}</p>
                    </button>
                  );
                })}
              </div>

              {/* Concise Optical Guidelines */}
              {profile.faceShape && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-500 uppercase text-[10px] tracking-wider">Recommended:</span>
                    <span className="font-extrabold text-slate-900">
                      {FACE_SHAPE_OPTICS[profile.faceShape].recommendedShapes.join(", ")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-500 uppercase text-[10px] tracking-wider">Avoid:</span>
                    <span className="font-semibold text-rose-600">
                      {FACE_SHAPE_OPTICS[profile.faceShape].avoid}
                    </span>
                  </div>
                </div>
              )}

              {/* Navigation */}
              <div className="flex justify-between pt-2">
                <button
                  onClick={() => setStep(1)}
                  className="px-5 py-2 border border-slate-200 rounded-xl text-slate-600 font-bold text-xs hover:bg-slate-50 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  className="px-6 py-2 bg-[#1b5e85] hover:bg-[#154d70] text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Lifestyle, Ergonomics & Environmental Audit */}
          {step === 3 && (
            <div className="bg-white rounded-3xl border border-slate-100 p-6 sm:p-8 shadow-sm space-y-6">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-[#1b5e85]" />
                  Step 3: Multi-Factor Clinical & Lifestyle Audit
                </h2>
                <p className="text-slate-500 text-sm mt-0.5">
                  Audit daily visual tasks, digital screen exposure, and occupational hazards to pinpoint optimal lens coatings and materials.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* 1. Screen Exposure */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Monitor className="w-4 h-4 text-blue-600" />
                    Daily Digital Screen Exposure
                  </label>
                  <div className="space-y-2">
                    {[
                      { id: "heavy", label: "Heavy (> 6 hrs / day)", sub: "Software, office, intensive desk work" },
                      { id: "moderate", label: "Moderate (3 - 6 hrs / day)", sub: "Mixed daily device usage" },
                      { id: "light", label: "Light (< 3 hrs / day)", sub: "Casual phone / reading use" },
                    ].map(item => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setProfile(p => ({ ...p, screenTime: item.id }))}
                        className={`w-full text-left p-3 rounded-xl border text-xs font-bold transition-all ${
                          profile.screenTime === item.id
                            ? "border-blue-600 bg-blue-50 text-blue-900 font-extrabold"
                            : "border-slate-200 text-slate-600 hover:border-slate-300"
                        }`}
                      >
                        <div>{item.label}</div>
                        <div className="text-[10px] text-slate-400 font-medium mt-0.5">{item.sub}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Lighting Environment */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Sun className="w-4 h-4 text-amber-500" />
                    Primary Lighting & Commute
                  </label>
                  <div className="space-y-2">
                    {[
                      { id: "office", label: "Indoor / Controlled Office", sub: "Fluorescent or LED lighting" },
                      { id: "outdoor", label: "Outdoor / Frequent Transit", sub: "High solar UV exposure & driving" },
                      { id: "mixed", label: "Dynamic Mixed (All-Day)", sub: "Frequent transition indoor-outdoor" },
                    ].map(item => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setProfile(p => ({ ...p, environment: item.id }))}
                        className={`w-full text-left p-3 rounded-xl border text-xs font-bold transition-all ${
                          profile.environment === item.id
                            ? "border-amber-500 bg-amber-50 text-amber-900 font-extrabold"
                            : "border-slate-200 text-slate-600 hover:border-slate-300"
                        }`}
                      >
                        <div>{item.label}</div>
                        <div className="text-[10px] text-slate-400 font-medium mt-0.5">{item.sub}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Safety & Physical Risk */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    Impact Risk (ANSI Z87.1 Safety)
                  </label>
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setProfile(p => ({ ...p, impactRisk: true }))}
                      className={`w-full text-left p-3 rounded-xl border text-xs font-bold transition-all ${
                        profile.impactRisk
                          ? "border-emerald-600 bg-emerald-50 text-emerald-900 font-extrabold"
                          : "border-slate-200 text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      <div>Active Sports / Ball Games / Field Work</div>
                      <div className="text-[10px] text-slate-400 font-medium mt-0.5">Demands shatterproof Polycarbonate/Trivex</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setProfile(p => ({ ...p, impactRisk: false }))}
                      className={`w-full text-left p-3 rounded-xl border text-xs font-bold transition-all ${
                        !profile.impactRisk
                          ? "border-emerald-600 bg-emerald-50 text-emerald-900 font-extrabold"
                          : "border-slate-200 text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      <div>Standard Daily Sedentary Wear</div>
                      <div className="text-[10px] text-slate-400 font-medium mt-0.5">General optical resin is suitable</div>
                    </button>
                  </div>
                </div>
              </div>

              {/* Special Clinical Symptoms Toggles */}
              <div className="pt-2">
                <label className="block text-xs font-bold text-slate-700 mb-2.5">
                  Specific Visual Symptoms & Ergonomic Needs (Check all that apply):
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { key: "digitalFatigue", title: "Digital Asthenopia (Eye Strain, Fatigue & Headaches)", desc: "Triggers BlueCut UV420 filtration" },
                    { key: "nightDrivingGlaring", title: "Night Driving Glare & Headlight Halos", desc: "Demands 99.6% ultra-high transmission AR coating" },
                    { key: "photophobia", title: "Photophobia (Severe Sunlight Sensitivity)", desc: "Triggers Photochromic Transitions or Dark Polarized tint" },
                    { key: "highSweatDust", title: "Humid / Dusty / Active Perspiration", desc: "Requires Oleophobic & Super-Hydrophobic clean coat" },
                  ].map(item => {
                    const active = profile.symptoms[item.key];
                    return (
                      <div
                        key={item.key}
                        onClick={() => setProfile(p => ({
                          ...p,
                          symptoms: { ...p.symptoms, [item.key]: !active }
                        }))}
                        className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
                          active
                            ? "bg-blue-50/70 border-blue-300 text-blue-950"
                            : "bg-slate-50/50 border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={() => {}}
                          className="mt-0.5 w-4 h-4 rounded text-[#1b5e85] focus:ring-0"
                        />
                        <div>
                          <p className="text-xs font-bold">{item.title}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">{item.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Optician Clinical Consultation Notes</label>
                <textarea
                  rows={2}
                  value={profile.clinicalNotes}
                  onChange={(e) => setProfile(p => ({ ...p, clinicalNotes: e.target.value }))}
                  placeholder="e.g. Patient sensitive to pantoscopic tilt; recommends high-transmission Crizal coating..."
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#1b5e85]/20 focus:border-[#1b5e85]"
                />
              </div>

              {/* Navigation */}
              <div className="flex justify-between pt-4">
                <button
                  onClick={() => setStep(2)}
                  className="px-6 py-2.5 border border-slate-200 rounded-2xl text-slate-600 font-bold text-sm hover:bg-slate-50 transition-colors flex items-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
                <button
                  onClick={calculateEvidenceBasedDispensing}
                  className="px-7 py-3 bg-gradient-to-r from-[#1b5e85] to-[#0f2d45] hover:from-[#154d70] hover:to-[#0a2033] text-white text-sm font-extrabold rounded-2xl shadow-lg transition-all flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  Generate Clinical Dispensing Plan ✨
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Evidence-Based Clinical Recommendations & Live Inventory */}
          {step === 4 && recommendationResult && (
            <div className="space-y-7">
              {/* Action Bar */}
              <div className="flex items-center justify-between flex-wrap gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-100 shadow-sm">
                <div>
                  <h2 className="text-lg font-black text-slate-900">Personalized Clinical Dispensing Prescription</h2>
                  <p className="text-slate-500 text-xs">Patient: <strong>{recommendationResult.patientName}</strong> · Age: {recommendationResult.age} · Face: {recommendationResult.faceShape}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePrintPlan}
                    className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold rounded-xl transition-colors flex items-center gap-2"
                  >
                    <Printer className="w-4 h-4 text-slate-500" />
                    Print Plan
                  </button>
                  <button
                    onClick={handleSaveConsultation}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-2 shadow-sm"
                  >
                    <Save className="w-4 h-4" />
                    Save Consultation
                  </button>
                  <button
                    onClick={resetAdvisor}
                    className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    New Assessment
                  </button>
                </div>
              </div>

              {/* SECTION 1: Evidence-Based Lens Science Card */}
              <div className="bg-gradient-to-br from-slate-900 via-[#0f2d45] to-[#1a4a6b] text-white p-6 sm:p-8 rounded-3xl shadow-xl">
                <div className="flex items-center justify-between pb-4 border-b border-white/10 flex-wrap gap-2">
                  <div className="flex items-center gap-2 text-amber-400 text-xs font-black uppercase tracking-wider">
                    <Award className="w-4 h-4" />
                    Clinical Lens Dispensing Diagnosis (Jalie's Sizing & ISO Standards)
                  </div>
                  <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold border border-blue-400/30">
                    Max Power: ±{recommendationResult.refractiveMetrics.maxPower}D
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 my-5">
                  <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4">
                    <span className="text-white/50 text-[10px] font-black uppercase tracking-wider">Refractive Index</span>
                    <p className="text-xl font-black text-white mt-1">{recommendationResult.lensSolution.recommendedIndex} Index</p>
                    <p className="text-white/70 text-[11px] mt-0.5">{recommendationResult.lensSolution.materialName}</p>
                  </div>

                  <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4">
                    <span className="text-white/50 text-[10px] font-black uppercase tracking-wider">Focal Design</span>
                    <p className="text-base font-black text-white mt-1 leading-tight">{recommendationResult.lensSolution.focalDesign}</p>
                    <p className="text-white/70 text-[11px] mt-0.5">Dual-surface Freeform</p>
                  </div>

                  <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4">
                    <span className="text-white/50 text-[10px] font-black uppercase tracking-wider">Optical Abbe Value</span>
                    <p className="text-sm font-black text-white mt-1">{recommendationResult.lensSolution.abbeValue}</p>
                    <p className="text-white/70 text-[11px] mt-0.5">Dispersion Control</p>
                  </div>

                  <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-emerald-400/30 bg-emerald-950/20">
                    <span className="text-emerald-400 text-[10px] font-black uppercase tracking-wider">Catalog Matched Lens</span>
                    <p className="text-sm font-black text-white mt-1 truncate">{recommendationResult.lensSolution.dbLens.type}</p>
                    <p className="text-emerald-300 text-base font-extrabold mt-1">
                      LKR {Number(recommendationResult.lensSolution.dbLens.price).toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Scientific Rationale Notes */}
                <div className="space-y-2.5 pt-2 text-xs text-white/80 leading-relaxed">
                  <p>
                    <strong className="text-white">Thickness & Geometry:</strong> {recommendationResult.lensSolution.thicknessRationale}
                  </p>
                  <p>
                    <strong className="text-white">Corridor & Optics:</strong> {recommendationResult.lensSolution.designRationale}
                  </p>
                  <div className="pt-2">
                    <strong className="text-white block mb-1">Recommended Coatings & Treatments:</strong>
                    <div className="flex flex-wrap gap-2">
                      {recommendationResult.lensSolution.coatings.map((coat, idx) => (
                        <span key={idx} className="px-3 py-1 bg-white/15 rounded-xl text-xs font-semibold text-white">
                          ✓ {coat}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 2: Live Inventory Frame Matching */}
              <div className="bg-white rounded-3xl border border-slate-100 p-6 sm:p-8 shadow-sm space-y-5">
                <div className="flex items-center justify-between flex-wrap gap-3 pb-4 border-b border-slate-100">
                  <div>
                    <h3 className="text-lg font-black text-slate-900">
                      Live Catalog Frames Matching {recommendationResult.faceShape} Face
                    </h3>
                    <p className="text-slate-500 text-xs mt-0.5">
                      {recommendationResult.faceOptics.principle}: Geometric contrast to balance facial contours.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-400">Select frame to bundle:</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {recommendationResult.rankedFrames.map((frame) => {
                    const isChosen = selectedFrame?.id === frame.id;
                    return (
                      <div
                        key={frame.id}
                        onClick={() => setSelectedFrame(frame)}
                        className={`rounded-3xl border-2 p-5 cursor-pointer transition-all relative flex flex-col justify-between ${
                          isChosen
                            ? "border-[#1b5e85] bg-blue-50/40 shadow-lg shadow-blue-900/10 ring-2 ring-[#1b5e85]/20"
                            : "border-slate-100 hover:border-slate-300 hover:shadow-md bg-white"
                        }`}
                      >
                        <div>
                          {/* Image preview */}
                          <div className="w-full h-40 bg-slate-50 rounded-2xl mb-4 flex items-center justify-center p-3 relative overflow-hidden">
                            {frame.imageUrl ? (
                              <img
                                src={frame.imageUrl.startsWith("http") ? frame.imageUrl : `${API_BASE_URL}${frame.imageUrl}`}
                                alt={frame.name}
                                className="w-full h-full object-contain"
                                onError={(e) => { e.target.style.display = "none"; }}
                              />
                            ) : (
                              <Glasses className="w-16 h-16 text-slate-300" />
                            )}
                            <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-white/90 backdrop-blur-md text-[10px] font-black text-[#1b5e85] shadow-xs border border-slate-200">
                              {frame.shape || "Frame"}
                            </span>
                          </div>

                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{frame.brand}</p>
                              <h4 className="font-extrabold text-slate-900 text-sm leading-tight mt-0.5">{frame.name}</h4>
                              <p className="text-xs text-slate-500 mt-1">{frame.material} · Stock: {frame.stockLevel}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-base font-black text-slate-900">
                                LKR {Number(frame.price).toLocaleString()}
                              </span>
                            </div>
                          </div>

                          {/* Compatibility Badge */}
                          <div className="mt-3.5 pt-3 border-t border-slate-100">
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="font-bold text-slate-600">Optometric Match:</span>
                              <span className={`font-black ${frame.matchScore >= 90 ? "text-emerald-600" : "text-amber-600"}`}>
                                {frame.matchScore}%
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 leading-snug">{frame.clinicalNote}</p>
                          </div>
                        </div>

                        <div className="mt-4 pt-3">
                          <button
                            type="button"
                            className={`w-full py-2 rounded-xl text-xs font-bold transition-all ${
                              isChosen
                                ? "bg-[#1b5e85] text-white"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            }`}
                          >
                            {isChosen ? "Selected for Bundle ✓" : "Select Frame"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* SECTION 3: Clinical Total Package Cost Summary */}
              {selectedFrame && (
                <div className="bg-white rounded-3xl border border-slate-100 p-6 sm:p-7 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center font-black text-2xl">
                      ✓
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider text-slate-400">Total Complete Optical Dispensing Bundle</p>
                      <h4 className="text-lg font-black text-slate-900 mt-0.5">
                        {selectedFrame.name} + {recommendationResult.lensSolution.dbLens.type}
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Frame: LKR {Number(selectedFrame.price).toLocaleString()} | Lens: LKR {Number(recommendationResult.lensSolution.dbLens.price).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Package Amount</span>
                    <p className="text-3xl font-black text-[#1b5e85] tracking-tight">
                      LKR {(Number(selectedFrame.price) + Number(recommendationResult.lensSolution.dbLens.price)).toLocaleString()}
                    </p>
                    <span className="text-[11px] text-emerald-600 font-bold">Includes fitting, UV400 & multi-coat</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
