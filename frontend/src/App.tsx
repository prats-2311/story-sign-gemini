// React hooks removed (unused)
// import { useState, useRef } from 'react';
// import { useGeminiLive } from './hooks/useGeminiLive'; // Removed (Used in SessionRunner now)
// import { usePoseDetection } from './hooks/usePoseDetection'; // Removed
// import { ThinkingLog } from './components/ThinkingLog'; // Removed
// import { HistoryGraph } from './components/HistoryGraph'; // Removed
import { Dashboard } from './components/Dashboard'; 
import type { ExerciseConfig } from './types/Exercise';
// import { AnalyticsChart } from './components/AnalyticsChart'; // Removed
import './App.css';

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

import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
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
    
    let config = REGISTRY[exerciseId || ''] || location.state?.config;
    const planIndex = location.state?.planIndex as number | undefined; 
    
    console.log("SessionRoute Init. ExerciseID:", exerciseId);
    if (config) {
        console.log("Config found:", config.name);
        console.log("Has Engine:", !!config.engine);
        console.log("Calculate Type:", config.engine ? typeof config.engine.calculate : 'N/A');
        console.log("Has Raw Schema:", !!(config as any)._rawSchema);
    } else {
        console.log("Config NOT found in Registry or State");
        console.log("Location State:", location.state);
    }

    // [HYDRATION FIX]
    // When passing objects via React Router state, class methods are stripped.
    // We need to re-instantiate the UniversalPhysicsEngine if it's missing the 'calculate' method.
    if (config && config.engine && typeof config.engine.calculate !== 'function' && (config as any)._rawSchema) {
        console.log("Hydrating Universal Engine for:", config.name);
        try {
            config = {
                ...config,
                engine: new UniversalPhysicsEngine((config as any)._rawSchema)
            };
            console.log("Hydration Successful. Calculate is now:", typeof config.engine.calculate);
        } catch (err) {
            console.error("Hydration Failed:", err);
        }
    }

    if (!config) {
        console.warn("Invalid Exercise ID:", exerciseId);
        return <Navigate to="/reconnect" replace />;
    }

    const handleExit = async () => {
         // Logic to mark complete if planIndex exists
          if (planIndex !== undefined && planIndex !== null) {
              // ... 
               try {
                 await fetch('/plan/complete', {
                     method: 'POST',
                     headers: {'Content-Type': 'application/json'},
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
import { HarmonyDashboard } from './components/Harmony/HarmonyDashboard';
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
                 navigate('/session', { state: { config, planIndex: index } });
            }} 
        />
    );
}

// --- SUB-COMPONENT: SESSION RUNNER ---
// (Moved to components/SessionRunner.tsx)

export default App;
