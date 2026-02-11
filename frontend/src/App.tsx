// React hooks removed (unused)
import { useState, useEffect } from 'react';
// import { useGeminiLive } from './hooks/useGeminiLive'; // Removed (Used in SessionRunner now)
// import { usePoseDetection } from './hooks/usePoseDetection'; // Removed
// import { ThinkingLog } from './components/ThinkingLog'; // Removed
// import { HistoryGraph } from './components/HistoryGraph'; // Removed
import { Dashboard } from './components/Dashboard'; 
import type { ExerciseConfig } from './types/Exercise';
// import { AnalyticsChart } from './components/AnalyticsChart'; // Removed
import './App.css';
import { exercisesApi } from './api/exercises'; // [NEW]
import { apiClient } from './api/client'; // [NEW]

import { HistoryView } from './components/HistoryView'; 
import { DailyPlanView } from './components/DailyPlanView'; 
import { LandingPage } from './components/LandingPage'; 
// import { TourOverlay, type TourStep } from './components/TourOverlay'; 
// import type { RoutineItem } from './types/Plan'; 
import { ShoulderAbductionConfig, BicepCurlConfig, WallSlideConfig, ExternalRotationConfig } from './ExerciseConfigs'; 

// import { ArcadeOverlay } from './components/ArcadeOverlay'; // Removed

import { SessionRunner } from './components/SessionRunner'; // [MOVED HERE]

// --- TOUR DATA ---
// ... (Keep comments)

import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { Layout } from './components/Layout';

// ... (Imports remain)

// --- WRAPPER FOR SESSION RUNNER ---
import { useParams } from 'react-router-dom';


import { UniversalPhysicsEngine } from './exercises/UniversalPhysicsEngine';

function SessionRoute() {
    const navigate = useNavigate();
    const { exerciseId } = useParams(); 
    const location = useLocation();
    
    // Fallback Config Lookup 
    const REGISTRY: Record<string, ExerciseConfig> = {
          'abduction': ShoulderAbductionConfig,
          'bicep_curl': BicepCurlConfig,
          'wall_slide': WallSlideConfig,
          'rotation': ExternalRotationConfig
    };
    
    // Initialize with direct registry lookup OR passed state
    const initialConfig = REGISTRY[exerciseId || ''] || location.state?.config;

    const [config, setConfig] = useState<ExerciseConfig | null>(initialConfig || null);
    const [loading, setLoading] = useState<boolean>(!initialConfig);
    const [error, setError] = useState<string | null>(null);
    
    const planIndex = location.state?.planIndex as number | undefined; 

    // Helper: Hydrate Universal Engine from raw schema
    const hydrateConfig = (item: any): ExerciseConfig => {
        return {
            id: item.id,
            name: item.name,
            description: "Custom AI Generated Exercise",
            targetRom: { min: 0, max: 180 },
            engine: new UniversalPhysicsEngine(item.config),
            systemPrompt: `You are monitoring ${item.name}. ${JSON.stringify(item.config.stages || [])}`,
            _rawSchema: item.config
        };
    };
    
    useEffect(() => {
        // 1. If we have config, ensure it's hydrated (methods are lost in navigation state)
        if (config) {
             if (config.engine && typeof config.engine.calculate !== 'function' && (config as any)._rawSchema) {
                console.log("[Route] Hydrating Engine for:", config.name);
                try {
                    setConfig({
                        ...config,
                        engine: new UniversalPhysicsEngine((config as any)._rawSchema)
                    });
                } catch (err) {
                    console.error("Hydration Failed:", err);
                    setError("Failed to initialize exercise engine");
                }
            }
            return;
        }

        // 2. If no config, try to fetch dynamic exercise
        const fetchDynamicExercise = async () => {
             if (!exerciseId) return;
             // If ID is in registry but was not caught (unlikely but safe)
             if (REGISTRY[exerciseId]) {
                 setConfig(REGISTRY[exerciseId]);
                 setLoading(false);
                 return;
             }

             console.log("[Route] Fetching Dynamic Exercise:", exerciseId);
             setLoading(true);
             try {
                 const customEx = await exercisesApi.get(exerciseId);
                 const hydrated = hydrateConfig(customEx); 
                 setConfig(hydrated);
                 console.log("[Route] Fetched & Hydrated:", hydrated.name);
             } catch (e) {
                 console.error("[Route] Failed to fetch:", e);
                 setError("Exercise not found or could not load.");
             } finally {
                 setLoading(false);
             }
        };

        fetchDynamicExercise();
    }, [exerciseId, config]); // Re-run if ID changes

    if (loading) {
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center bg-gray-900 text-white gap-4">
                <div className="w-8 h-8 border-4 border-cyber-cyan border-t-transparent rounded-full animate-spin"></div>
                <div className="font-mono text-xs animate-pulse tracking-widest text-cyber-cyan">RETRIEVING NEURAL CONFIG...</div>
            </div>
        );
    }

    if (error || !config) {
        return (
             <div className="h-screen w-full flex flex-col items-center justify-center bg-gray-900 text-red-400 gap-4">
                <div className="text-4xl">⚠️</div>
                <div className="font-mono">{error || "Invalid Exercise ID"}</div>
                <button onClick={() => navigate('/reconnect')} className="px-6 py-2 border border-red-500 rounded hover:bg-red-500/10 transition-colors font-bold text-xs uppercase tracking-widest">
                    Return to Dashboard
                </button>
            </div>
        );
    }

    const handleExit = async () => {
         // Logic to mark complete if planIndex exists
          if (planIndex !== undefined && planIndex !== null) {
               try {
                 await apiClient('/plan/complete', {
                     method: 'POST',
                     body: JSON.stringify({ exercise_index: planIndex })
                 });
              } catch (e) { console.error(e); }
              navigate('/reconnect/plan');
          } else {
              navigate('/reconnect');
          }
    };

    return <SessionRunner config={config} onExit={handleExit} />;
}

// --- ASL COMPONENTS ---
import { ASLDashboard } from './components/ASL/ASLDashboard';
import { ASLGameView } from './components/ASL/ASLGameView';

// --- HARMONY COMPONENTS ---
import { HarmonyDashboard } from './components/HarmonyDashboard';
import { HarmonyMirror } from './components/Harmony/HarmonyMirror';
import { ExerciseCreator } from './components/ExerciseCreator';
import { UniversalExerciseView } from './components/UniversalExerciseView';

// --- APP COMPONENT ---
function App() {
  return (
    <BrowserRouter>
        <Routes>
            {/* PUBLIC LAYOUT ROUTES */}
            <Route element={<Layout />}>
                <Route path="/" element={<LandingPage />} />
                
                {/* RECONNECT MODULE - Standard Views */}
                <Route path="/reconnect" element={<DashboardWrapper />} />
                <Route path="/reconnect/history" element={<HistoryView onBack={() => window.history.back()} />} />
                <Route path="/reconnect/plan" element={<DailyPlanViewWrapper />} />

                {/* ASL MODULE - Dashboard */}
                <Route path="/asl" element={<ASLDashboard />} />
                
                {/* HARMONY MODULE - Dashboard */}
                <Route path="/harmony" element={<HarmonyDashboard />} />
                <Route path="/harmony/history" element={<HistoryView onBack={() => window.history.back()} initialDomain="FACE" />} />
            </Route>
            
            {/* FULLSCREEN ROUTES */}
            <Route path="/reconnect/session/:exerciseId" element={<SessionRoute />} />
            <Route path="/asl/level/:levelId" element={<ASLGameView />} />
            <Route path="/harmony/mirror" element={<HarmonyMirror />} />
            
            {/* UNIVERSAL ENGINE */}
            <Route path="/create-exercise" element={<ExerciseCreator />} />
            <Route path="/universal-preview" element={<UniversalExerciseView />} />
        </Routes>
    </BrowserRouter>
  );
}

// --- WRAPPERS FOR PROPS ---
function DashboardWrapper() {
    const navigate = useNavigate();
    return (
        <Dashboard 
            // [NEW] Pass config in state for dynamic exercises
            onSelectExercise={(config) => navigate(`/reconnect/session/${config.id}`, { state: { config } })} 
        />
    );
}

function DailyPlanViewWrapper() {
    const navigate = useNavigate();
    return (
        <DailyPlanView 
            onSelectExercise={(item, index) => {
                 // Registry Lookup 
                 const REGISTRY: Record<string, ExerciseConfig> = {
                      'abduction': ShoulderAbductionConfig,
                      'bicep_curl': BicepCurlConfig,
                      'wall_slide': WallSlideConfig,
                      'rotation': ExternalRotationConfig
                 };
                 const config = REGISTRY[item.exercise_id] || ShoulderAbductionConfig;
                 // [FIX] Correct Route & Pass ID
                 navigate(`/reconnect/session/${config.id}`, { state: { config, planIndex: index } });
            }} 
        />
    );
}

// --- SUB-COMPONENT: SESSION RUNNER ---
// (Moved to components/SessionRunner.tsx)

export default App;
