import React, { useRef, useEffect, useState } from 'react';
import { Camera } from 'lucide-react';

// Angle calculation utility
const calculateAngle = (a, b, c) => {
  const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs(radians * 180.0 / Math.PI);
  if (angle > 180.0) {
    angle = 360 - angle;
  }
  return angle;
};

const BicepCurlCounter = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [repCount, setRepCount] = useState(0);
  const [isTracking, setIsTracking] = useState(false);
  const [currentAngle, setCurrentAngle] = useState(0);
  const [repState, setRepState] = useState('waiting'); // waiting, down, up
  const [cameraReady, setCameraReady] = useState(false);
  const [useLeftArm, setUseLeftArm] = useState(true);
  const [workoutTime, setWorkoutTime] = useState(0);
  const [error, setError] = useState('');

  const poseRef = useRef(null);
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

  // Initialize camera
  useEffect(() => {
    const setupCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 }
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play();
            setCameraReady(true);
          };
        }
      } catch (err) {
        setError('Camera access denied. Please allow camera access to use this app.');
        console.error('Camera error:', err);
      }
    };

    setupCamera();

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Load MediaPipe Pose (simulated for demo)
  useEffect(() => {
    // In production, you'd load MediaPipe here
    // For this demo, we'll simulate pose detection
    console.log('MediaPipe Pose would be initialized here');
  }, []);

  // Process frame and detect reps
  const processFrame = () => {
    if (!isTracking || !videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const video = videoRef.current;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Simulate pose detection (in production, MediaPipe would provide these)
    // For demo, we'll create mock landmarks
    const mockPose = generateMockPose();
    
    if (mockPose) {
      drawPose(ctx, mockPose, canvas.width, canvas.height);
      detectBicepCurl(mockPose);
    }

    animationRef.current = requestAnimationFrame(processFrame);
  };

  // Generate mock pose data for demo
  const generateMockPose = () => {
    // Simulate arm movement based on time
    const time = Date.now() / 1000;
    const cyclePosition = (Math.sin(time * 0.5) + 1) / 2; // 0 to 1
    
    // Mock landmarks (normalized coordinates)
    const shoulder = useLeftArm 
      ? { x: 0.4, y: 0.3, visibility: 0.9 }
      : { x: 0.6, y: 0.3, visibility: 0.9 };
    
    const elbow = useLeftArm
      ? { x: 0.35, y: 0.5, visibility: 0.9 }
      : { x: 0.65, y: 0.5, visibility: 0.9 };
    
    // Wrist moves up and down to simulate curl
    const wristY = 0.5 + (cyclePosition * 0.3);
    const wrist = useLeftArm
      ? { x: 0.32, y: wristY, visibility: 0.9 }
      : { x: 0.68, y: wristY, visibility: 0.9 };

    return { shoulder, elbow, wrist };
  };

  // Draw pose skeleton
  const drawPose = (ctx, pose, width, height) => {
    const { shoulder, elbow, wrist } = pose;
    
    // Convert normalized coordinates to pixel coordinates
    const shoulderPx = { x: shoulder.x * width, y: shoulder.y * height };
    const elbowPx = { x: elbow.x * width, y: elbow.y * height };
    const wristPx = { x: wrist.x * width, y: wrist.y * height };

    // Draw connections
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(shoulderPx.x, shoulderPx.y);
    ctx.lineTo(elbowPx.x, elbowPx.y);
    ctx.lineTo(wristPx.x, wristPx.y);
    ctx.stroke();

    // Draw joints
    [shoulderPx, elbowPx, wristPx].forEach(point => {
      ctx.fillStyle = '#00ff00';
      ctx.beginPath();
      ctx.arc(point.x, point.y, 8, 0, 2 * Math.PI);
      ctx.fill();
    });

    // Draw angle arc at elbow
    const angle = calculateAngle(shoulder, elbow, wrist);
    setCurrentAngle(Math.round(angle));
    
    ctx.strokeStyle = '#ffff00';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(elbowPx.x, elbowPx.y, 30, 0, 2 * Math.PI);
    ctx.stroke();
  };

  // Detect bicep curl reps
  const detectBicepCurl = (pose) => {
    const { shoulder, elbow, wrist } = pose;
    const angle = calculateAngle(shoulder, elbow, wrist);

    const EXTENDED_THRESHOLD = 160;
    const CONTRACTED_THRESHOLD = 50;

    let newState = lastStateRef.current;

    if (angle > EXTENDED_THRESHOLD && lastStateRef.current !== 'down') {
      newState = 'down';
      setRepState('DOWN');
    } else if (angle < CONTRACTED_THRESHOLD && lastStateRef.current === 'down') {
      newState = 'up';
      setRepState('UP!');
      setRepCount(prev => prev + 1);
      
      // Play sound or haptic feedback here
      playRepSound();
    }

    lastStateRef.current = newState;
  };

  // Play sound on rep completion
  const playRepSound = () => {
    // Create a simple beep
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
    setIsTracking(true);
    setRepCount(0);
    setWorkoutTime(0);
    startTimeRef.current = Date.now();
    lastStateRef.current = 'waiting';
    setRepState('Ready!');
    processFrame();
  };

  // Stop tracking
  const stopTracking = () => {
    setIsTracking(false);
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
  };

  // Reset
  const reset = () => {
    stopTracking();
    setRepCount(0);
    setWorkoutTime(0);
    setRepState('waiting');
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
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent">
            Bicep Curl Rep Counter
          </h1>
          <p className="text-gray-300">AI-powered rep tracking using your webcam</p>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 mb-4">
            <p className="text-red-200">{error}</p>
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-6">
          {/* Video Feed */}
          <div className="md:col-span-2">
            <div className="bg-slate-800/50 rounded-xl p-4 backdrop-blur">
              <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  className="absolute inset-0 w-full h-full object-cover"
                  playsInline
                  muted
                />
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 w-full h-full"
                />
                
                {!cameraReady && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80">
                    <div className="text-center">
                      <Camera className="w-16 h-16 mx-auto mb-4 text-gray-400 animate-pulse" />
                      <p className="text-gray-400">Initializing camera...</p>
                    </div>
                  </div>
                )}

                {/* Rep State Indicator */}
                {isTracking && (
                  <div className="absolute top-4 left-4 bg-black/70 px-4 py-2 rounded-lg">
                    <div className={`text-2xl font-bold ${
                      repState === 'UP!' ? 'text-green-400' : 'text-yellow-400'
                    }`}>
                      {repState}
                    </div>
                  </div>
                )}

                {/* Current Angle */}
                {isTracking && (
                  <div className="absolute top-4 right-4 bg-black/70 px-4 py-2 rounded-lg">
                    <div className="text-sm text-gray-300">Elbow Angle</div>
                    <div className="text-xl font-bold text-blue-400">{currentAngle}°</div>
                  </div>
                )}
              </div>

              {/* Instructions */}
              <div className="mt-4 text-sm text-gray-400">
                <p>📍 <strong>Setup:</strong> Stand 6 feet from camera, side view (profile)</p>
                <p>💪 <strong>Form:</strong> Keep elbow stationary, curl weight up fully</p>
              </div>
            </div>
          </div>

          {/* Controls & Stats */}
          <div className="space-y-6">
            {/* Stats */}
            <div className="bg-slate-800/50 rounded-xl p-6 backdrop-blur">
              <h3 className="text-xl font-bold mb-4">Workout Stats</h3>
              
              <div className="space-y-4">
                <div className="bg-gradient-to-r from-green-500/20 to-blue-500/20 rounded-lg p-4">
                  <div className="text-sm text-gray-300 mb-1">Reps Completed</div>
                  <div className="text-5xl font-bold text-green-400">{repCount}</div>
                </div>

                <div className="bg-slate-700/50 rounded-lg p-4">
                  <div className="text-sm text-gray-300 mb-1">Workout Time</div>
                  <div className="text-3xl font-bold text-blue-400">{formatTime(workoutTime)}</div>
                </div>

                {repCount > 0 && workoutTime > 0 && (
                  <div className="bg-slate-700/50 rounded-lg p-4">
                    <div className="text-sm text-gray-300 mb-1">Avg Time/Rep</div>
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
              
              {/* Arm Selection */}
              <div className="mb-4">
                <label className="text-sm text-gray-300 mb-2 block">Track Arm</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setUseLeftArm(true)}
                    disabled={isTracking}
                    className={`flex-1 px-4 py-2 rounded-lg transition ${
                      useLeftArm
                        ? 'bg-blue-500 text-white'
                        : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                    } ${isTracking ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    Left
                  </button>
                  <button
                    onClick={() => setUseLeftArm(false)}
                    disabled={isTracking}
                    className={`flex-1 px-4 py-2 rounded-lg transition ${
                      !useLeftArm
                        ? 'bg-blue-500 text-white'
                        : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                    } ${isTracking ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    Right
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2">
                {!isTracking ? (
                  <button
                    onClick={startTracking}
                    disabled={!cameraReady}
                    className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition transform hover:scale-105 active:scale-95"
                  >
                    Start Workout
                  </button>
                ) : (
                  <button
                    onClick={stopTracking}
                    className="w-full bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white font-bold py-3 px-6 rounded-lg transition transform hover:scale-105 active:scale-95"
                  >
                    Stop Workout
                  </button>
                )}

                <button
                  onClick={reset}
                  className="w-full bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-6 rounded-lg transition"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Info */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
              <p className="text-sm text-blue-200">
                <strong>Privacy:</strong> All processing happens in your browser. 
                Your video never leaves your device.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BicepCurlCounter;
