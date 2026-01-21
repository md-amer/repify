import React, { useRef, useEffect, useState } from 'react';
import { Camera, Dumbbell, Play, Square, RotateCcw } from 'lucide-react';

// Angle calculation utility
const calculateAngle = (a, b, c) => {
  const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs(radians * 180.0 / Math.PI);
  if (angle > 180.0) {
    angle = 360 - angle;
  }
  return angle;
};

// Exercise configurations
const EXERCISES = {
  bicep_curl: {
    name: 'Bicep Curl',
    landmarks: { shoulder: 11, elbow: 13, wrist: 15 }, // Left arm
    landmarksRight: { shoulder: 12, elbow: 14, wrist: 16 },
    extended: 160,
    contracted: 50,
    instructions: 'Stand sideways to camera. Keep elbow stationary, curl weight up fully.',
  },
  squat: {
    name: 'Squat',
    landmarks: { hip: 23, knee: 25, ankle: 27 }, // Left leg
    landmarksRight: { hip: 24, knee: 26, ankle: 28 },
    extended: 160,
    contracted: 90,
    instructions: 'Face camera. Squat down until thighs parallel to ground.',
  },
  shoulder_press: {
    name: 'Shoulder Press',
    landmarks: { shoulder: 11, elbow: 13, wrist: 15 },
    landmarksRight: { shoulder: 12, elbow: 14, wrist: 16 },
    extended: 160,
    contracted: 90,
    instructions: 'Face camera. Press weight overhead until arms fully extended.',
  },
  pushup: {
    name: 'Push-up',
    landmarks: { shoulder: 11, elbow: 13, wrist: 15 },
    landmarksRight: { shoulder: 12, elbow: 14, wrist: 16 },
    extended: 160,
    contracted: 90,
    instructions: 'Side view. Lower chest to ground, push back up.',
  },
  lunge: {
    name: 'Lunge',
    landmarks: { hip: 23, knee: 25, ankle: 27 },
    landmarksRight: { hip: 24, knee: 26, ankle: 28 },
    extended: 160,
    contracted: 90,
    instructions: 'Side view. Step forward and lower back knee toward ground.',
  }
};

const RepifyApp = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [repCount, setRepCount] = useState(0);
  const [isTracking, setIsTracking] = useState(false);
  const [currentAngle, setCurrentAngle] = useState(0);
  const [repState, setRepState] = useState('Ready');
  const [cameraReady, setCameraReady] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState('bicep_curl');
  const [useLeftSide, setUseLeftSide] = useState(true);
  const [workoutTime, setWorkoutTime] = useState(0);
  const [error, setError] = useState('');
  const [mediapipeLoaded, setMediapipeLoaded] = useState(false);

  const poseRef = useRef(null);
  const cameraRef = useRef(null);
  const animationRef = useRef(null);
  const startTimeRef = useRef(null);
  const lastStateRef = useRef('waiting');

  // Timer effect
  useEffect(() => {
    let interval;
    if (isTracking) {
      interval = setInterval(() => {
        setWorkoutTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTracking]);

  // Load MediaPipe Pose
  useEffect(() => {
    const loadMediaPipe = async () => {
      try {
        // Load MediaPipe from CDN
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js';
        script.crossOrigin = 'anonymous';
        
        script.onload = async () => {
          const cameraScript = document.createElement('script');
          cameraScript.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js';
          cameraScript.crossOrigin = 'anonymous';
          
          cameraScript.onload = async () => {
            const drawingScript = document.createElement('script');
            drawingScript.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js';
            drawingScript.crossOrigin = 'anonymous';
            
            drawingScript.onload = () => {
              setMediapipeLoaded(true);
              console.log('MediaPipe loaded successfully');
            };
            
            document.body.appendChild(drawingScript);
          };
          
          document.body.appendChild(cameraScript);
        };
        
        document.body.appendChild(script);
      } catch (err) {
        console.error('Failed to load MediaPipe:', err);
        setError('Failed to load pose detection library');
      }
    };

    loadMediaPipe();
  }, []);

  // Initialize camera and pose detection
  useEffect(() => {
    if (!mediapipeLoaded) return;

    const setupCameraAndPose = async () => {
      try {
        // Initialize MediaPipe Pose
        const pose = new window.Pose({
          locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
          }
        });

        pose.setOptions({
          modelComplexity: 1,
          smoothLandmarks: true,
          enableSegmentation: false,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        });

        pose.onResults(onPoseResults);
        poseRef.current = pose;

        // Setup camera
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720 }
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await new Promise((resolve) => {
            videoRef.current.onloadedmetadata = resolve;
          });
          await videoRef.current.play();
          setCameraReady(true);

          // Initialize MediaPipe camera
          const camera = new window.Camera(videoRef.current, {
            onFrame: async () => {
              if (poseRef.current) {
                await poseRef.current.send({ image: videoRef.current });
              }
            },
            width: 1280,
            height: 720
          });
          
          cameraRef.current = camera;
          camera.start();
        }
      } catch (err) {
        setError('Camera access denied. Please allow camera access.');
        console.error('Camera/Pose setup error:', err);
      }
    };

    setupCameraAndPose();

    return () => {
      if (cameraRef.current) {
        cameraRef.current.stop();
      }
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      }
    };
  }, [mediapipeLoaded]);

  // Handle pose detection results
  const onPoseResults = (results) => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    canvas.width = results.image.width;
    canvas.height = results.image.height;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw landmarks and connections
    if (results.poseLandmarks) {
      // Draw connections
      window.drawConnectors(ctx, results.poseLandmarks, window.POSE_CONNECTIONS, {
        color: '#00FF00',
        lineWidth: 4
      });
      
      // Draw landmarks
      window.drawLandmarks(ctx, results.poseLandmarks, {
        color: '#FF0000',
        lineWidth: 2,
        radius: 6
      });

      // Detect reps if tracking
      if (isTracking) {
        detectRep(results.poseLandmarks);
      }
    }
  };

  // Detect rep based on selected exercise
  const detectRep = (landmarks) => {
    const exercise = EXERCISES[selectedExercise];
    const config = useLeftSide ? exercise.landmarks : exercise.landmarksRight;

    const points = {
      a: landmarks[Object.values(config)[0]],
      b: landmarks[Object.values(config)[1]],
      c: landmarks[Object.values(config)[2]]
    };

    if (!points.a || !points.b || !points.c) return;

    const angle = calculateAngle(points.a, points.b, points.c);
    setCurrentAngle(Math.round(angle));

    const { extended, contracted } = exercise;
    let newState = lastStateRef.current;

    if (angle > extended && lastStateRef.current !== 'down') {
      newState = 'down';
      setRepState('DOWN');
    } else if (angle < contracted && lastStateRef.current === 'down') {
      newState = 'up';
      setRepState('UP!');
      setRepCount(prev => prev + 1);
      playRepSound();
    }

    lastStateRef.current = newState;
  };

  // Play sound on rep completion
  const playRepSound = () => {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
  };

  // Start tracking
  const startTracking = () => {
    if (!cameraReady) return;
    setIsTracking(true);
    setRepCount(0);
    setWorkoutTime(0);
    startTimeRef.current = Date.now();
    lastStateRef.current = 'waiting';
    setRepState('Ready!');
  };

  // Stop tracking
  const stopTracking = () => {
    setIsTracking(false);
  };

  // Reset
  const reset = () => {
    stopTracking();
    setRepCount(0);
    setWorkoutTime(0);
    setRepState('Ready');
    lastStateRef.current = 'waiting';
  };

  // Format time
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Dumbbell className="w-10 h-10 text-purple-400" />
            <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-400 via-pink-500 to-blue-500 bg-clip-text text-transparent">
              Repify
            </h1>
          </div>
          <p className="text-gray-300">AI-powered exercise tracking using your webcam</p>
          <p className="text-sm text-gray-400 mt-2">
            🔒 Privacy-first: All processing happens in your browser
          </p>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 mb-6 max-w-2xl mx-auto">
            <p className="text-red-200">{error}</p>
          </div>
        )}

        {!mediapipeLoaded && (
          <div className="bg-blue-500/20 border border-blue-500 rounded-lg p-4 mb-6 max-w-2xl mx-auto">
            <p className="text-blue-200">Loading pose detection library...</p>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Video Feed */}
          <div className="lg:col-span-2">
            <div className="bg-slate-800/50 rounded-xl p-4 backdrop-blur">
              <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  className="absolute inset-0 w-full h-full object-cover hidden"
                  playsInline
                  muted
                />
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 w-full h-full"
                />
                
                {!cameraReady && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-900/90">
                    <div className="text-center">
                      <Camera className="w-16 h-16 mx-auto mb-4 text-gray-400 animate-pulse" />
                      <p className="text-gray-400">Initializing camera...</p>
                    </div>
                  </div>
                )}

                {/* Rep State */}
                {isTracking && (
                  <div className="absolute top-4 left-4 bg-black/80 px-6 py-3 rounded-lg">
                    <div className={`text-3xl font-bold ${
                      repState === 'UP!' ? 'text-green-400' : 'text-yellow-400'
                    }`}>
                      {repState}
                    </div>
                  </div>
                )}

                {/* Angle Display */}
                {isTracking && (
                  <div className="absolute top-4 right-4 bg-black/80 px-4 py-2 rounded-lg">
                    <div className="text-xs text-gray-300">Angle</div>
                    <div className="text-2xl font-bold text-blue-400">{currentAngle}°</div>
                  </div>
                )}
              </div>

              {/* Instructions */}
              <div className="mt-4 p-4 bg-slate-700/30 rounded-lg">
                <p className="text-sm text-gray-300">
                  📍 <strong>Setup:</strong> {EXERCISES[selectedExercise].instructions}
                </p>
              </div>
            </div>
          </div>

          {/* Controls & Stats */}
          <div className="space-y-6">
            {/* Exercise Selection */}
            <div className="bg-slate-800/50 rounded-xl p-6 backdrop-blur">
              <h3 className="text-xl font-bold mb-4">Exercise</h3>
              <select
                value={selectedExercise}
                onChange={(e) => setSelectedExercise(e.target.value)}
                disabled={isTracking}
                className="w-full bg-slate-700 text-white px-4 py-3 rounded-lg mb-4 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {Object.entries(EXERCISES).map(([key, ex]) => (
                  <option key={key} value={key}>{ex.name}</option>
                ))}
              </select>

              <div className="mb-4">
                <label className="text-sm text-gray-300 mb-2 block">Track Side</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setUseLeftSide(true)}
                    disabled={isTracking}
                    className={`flex-1 px-4 py-2 rounded-lg transition ${
                      useLeftSide
                        ? 'bg-purple-500 text-white'
                        : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                    } ${isTracking ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    Left
                  </button>
                  <button
                    onClick={() => setUseLeftSide(false)}
                    disabled={isTracking}
                    className={`flex-1 px-4 py-2 rounded-lg transition ${
                      !useLeftSide
                        ? 'bg-purple-500 text-white'
                        : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                    } ${isTracking ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    Right
                  </button>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="bg-slate-800/50 rounded-xl p-6 backdrop-blur">
              <h3 className="text-xl font-bold mb-4">Stats</h3>
              
              <div className="space-y-4">
                <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-lg p-4 border border-green-500/30">
                  <div className="text-sm text-gray-300 mb-1">Reps</div>
                  <div className="text-5xl font-bold text-green-400">{repCount}</div>
                </div>

                <div className="bg-slate-700/50 rounded-lg p-4">
                  <div className="text-sm text-gray-300 mb-1">Time</div>
                  <div className="text-3xl font-bold text-blue-400">{formatTime(workoutTime)}</div>
                </div>

                {repCount > 0 && workoutTime > 0 && (
                  <div className="bg-slate-700/50 rounded-lg p-4">
                    <div className="text-sm text-gray-300 mb-1">Avg/Rep</div>
                    <div className="text-2xl font-bold text-purple-400">
                      {(workoutTime / repCount).toFixed(1)}s
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Controls */}
            <div className="bg-slate-800/50 rounded-xl p-6 backdrop-blur">
              <h3 className="text-xl font-bold mb-4">Controls</h3>
              
              <div className="space-y-2">
                {!isTracking ? (
                  <button
                    onClick={startTracking}
                    disabled={!cameraReady || !mediapipeLoaded}
                    className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-lg transition transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
                  >
                    <Play className="w-5 h-5" />
                    Start Workout
                  </button>
                ) : (
                  <button
                    onClick={stopTracking}
                    className="w-full bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white font-bold py-4 px-6 rounded-lg transition transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
                  >
                    <Square className="w-5 h-5" />
                    Stop Workout
                  </button>
                )}

                <button
                  onClick={reset}
                  className="w-full bg-slate-700 hover:bg-slate-600 text-white font-semibold py-3 px-6 rounded-lg transition flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RepifyApp;
