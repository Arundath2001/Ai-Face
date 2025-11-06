import React, { useState, useEffect } from "react";

function InfoCard({ label, value }) {
  if (!value) return null;
  return (
    <div className="bg-gray-50 p-4 rounded-xl border-l-4 border-purple-500">
      <div className="text-xs text-gray-500 uppercase font-semibold mb-1">
        {label}
      </div>
      <div className="text-lg text-gray-800 font-semibold break-words">
        {value}
      </div>
    </div>
  );
}

export default function FaceRecognitionViewer() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isOnline, setIsOnline] = useState(false);
  const [lastUpdated, setLastUpdated] = useState("");

  // ⚙️ CONFIGURATION - Update this with your backend URL
  const API_URL = "http://localhost:5000/api/face-recognition/latest";
  const FETCH_INTERVAL = 3000; // 3 seconds

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, FETCH_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const response = await fetch(API_URL);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      setData(result);
      setIsOnline(true);
      setError(null);
      setLoading(false);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      console.error("Fetch error:", err);
      setError(err.message);
      setIsOnline(false);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-purple-900 flex items-center justify-center">
        <div className="text-white text-2xl animate-pulse">
          Connecting to system...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-purple-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-white mb-4 drop-shadow-lg">
            🔍 Face Recognition System
          </h1>

          <div className="inline-flex items-center bg-white bg-opacity-20 px-6 py-3 rounded-full backdrop-blur-sm">
            <div
              className={`w-3 h-3 rounded-full mr-3 ${
                isOnline ? "bg-green-400 animate-pulse" : "bg-red-400"
              }`}
            ></div>
            <span className="text-white font-medium">
              {isOnline ? "Live Monitoring" : "Connection Lost"}
            </span>
          </div>

          {lastUpdated && (
            <div className="text-white text-sm mt-3 opacity-80">
              Last updated: {lastUpdated}
            </div>
          )}
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-100 border-2 border-red-400 text-red-800 p-6 rounded-xl mb-6 shadow-lg">
            <h3 className="text-lg font-bold mb-2">⚠️ Connection Error</h3>
            <p className="mb-4">{error}</p>
            <div className="text-sm bg-white bg-opacity-50 p-4 rounded">
              <strong>Troubleshooting:</strong>
              <ul className="list-disc ml-5 mt-2 space-y-1">
                <li>Verify backend server is running on port 5000</li>
                <li>Check API_URL matches your backend URL</li>
                <li>Ensure CORS is enabled on the backend</li>
                <li>
                  Run:{" "}
                  <code className="bg-gray-800 text-white px-2 py-1 rounded">
                    npm start
                  </code>{" "}
                  in backend directory
                </li>
              </ul>
            </div>
          </div>
        )}

        {/* Main Content */}
        {data && !error && (
          <div className="bg-white rounded-2xl shadow-2xl p-8">
            {/* Status Badge */}
            <div className="mb-6">
              {data.message?.includes("Waiting") ? (
                <span className="inline-block px-6 py-3 bg-yellow-500 text-white font-bold rounded-full text-lg shadow-lg">
                  ⏳ Waiting
                </span>
              ) : data.recognized ? (
                <span className="inline-block px-6 py-3 bg-green-500 text-white font-bold rounded-full text-lg shadow-lg">
                  ✅ Recognized
                </span>
              ) : (
                <span className="inline-block px-6 py-3 bg-red-500 text-white font-bold rounded-full text-lg shadow-lg">
                  ❌ Not Recognized
                </span>
              )}
            </div>

            {/* Waiting State */}
            {data.message?.includes("Waiting") && (
              <div className="text-center py-16">
                <div className="text-7xl mb-6">⏱️</div>
                <div className="text-3xl text-gray-700 font-bold mb-3">
                  System Ready
                </div>
                <div className="text-gray-500 text-lg">
                  Waiting for first recognition event...
                </div>
              </div>
            )}

            {/* Not Recognized State */}
            {!data.recognized && !data.message?.includes("Waiting") && (
              <div>
                <div className="text-center py-16">
                  <div className="text-7xl mb-6">👤</div>
                  <div className="text-3xl text-gray-700 font-bold mb-3">
                    No User Match
                  </div>
                  <div className="text-gray-500 text-lg">
                    {data.message || "Person not found in system"}
                  </div>
                </div>

                {data.deviceInfo && (
                  <div className="bg-blue-50 border-l-4 border-blue-500 p-6 rounded-lg mt-6">
                    <h4 className="text-blue-900 font-bold mb-4 text-lg">
                      📍 Device Information
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {data.deviceInfo.deviceName && (
                        <div className="bg-white p-3 rounded">
                          <strong className="text-gray-700 block mb-1">
                            Device:
                          </strong>
                          <span className="text-gray-600">
                            {data.deviceInfo.deviceName}
                          </span>
                        </div>
                      )}
                      {data.deviceInfo.deviceIp && (
                        <div className="bg-white p-3 rounded">
                          <strong className="text-gray-700 block mb-1">
                            IP Address:
                          </strong>
                          <span className="text-gray-600">
                            {data.deviceInfo.deviceIp}
                          </span>
                        </div>
                      )}
                      {data.deviceInfo.captureTime && (
                        <div className="bg-white p-3 rounded">
                          <strong className="text-gray-700 block mb-1">
                            Capture Time:
                          </strong>
                          <span className="text-gray-600">
                            {data.deviceInfo.captureTime}
                          </span>
                        </div>
                      )}
                      {data.deviceInfo.trackId && (
                        <div className="bg-white p-3 rounded">
                          <strong className="text-gray-700 block mb-1">
                            Track ID:
                          </strong>
                          <span className="text-gray-600">
                            {data.deviceInfo.trackId}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Images for Not Recognized */}
                {data.images &&
                  (data.images.originPic ||
                    data.images.bodyPic ||
                    data.images.facePic) && (
                    <div className="mt-8">
                      <h3 className="text-xl font-bold text-gray-800 mb-4">
                        📸 Captured Images
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {data.images.originPic && (
                          <div className="bg-gray-50 p-4 rounded-xl shadow-md hover:shadow-xl transition-shadow">
                            <h4 className="text-center font-semibold mb-3 text-gray-700">
                              Original Picture
                            </h4>
                            <img
                              src={data.images.originPic}
                              alt="Original"
                              className="w-full rounded-lg"
                            />
                          </div>
                        )}
                        {data.images.facePic && (
                          <div className="bg-gray-50 p-4 rounded-xl shadow-md hover:shadow-xl transition-shadow">
                            <h4 className="text-center font-semibold mb-3 text-gray-700">
                              Face Picture
                            </h4>
                            <img
                              src={data.images.facePic}
                              alt="Face"
                              className="w-full rounded-lg"
                            />
                          </div>
                        )}
                        {data.images.bodyPic && (
                          <div className="bg-gray-50 p-4 rounded-xl shadow-md hover:shadow-xl transition-shadow">
                            <h4 className="text-center font-semibold mb-3 text-gray-700">
                              Body Picture
                            </h4>
                            <img
                              src={data.images.bodyPic}
                              alt="Body"
                              className="w-full rounded-lg"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
              </div>
            )}

            {/* Recognized State */}
            {data.recognized && (
              <div>
                {/* User Info Grid */}
                <div className="mb-8">
                  <h3 className="text-2xl font-bold text-gray-800 mb-4">
                    👤 Person Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <InfoCard label="Name" value={data.name} />
                    <InfoCard label="Person Code" value={data.personCode} />
                    <InfoCard label="Person ID" value={data.personId} />
                    <InfoCard label="Group Name" value={data.groupName} />
                    <InfoCard label="Capture Time" value={data.captureTime} />
                    <InfoCard label="Device IP" value={data.deviceIp} />
                    <InfoCard label="Device Name" value={data.deviceName} />
                  </div>
                </div>

                {/* Body Information */}
                {data.bodyInfo && (
                  <div className="mb-8 bg-purple-50 p-6 rounded-xl">
                    <h3 className="text-xl font-bold text-gray-800 mb-4">
                      🚶 Physical Attributes
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <InfoCard label="Gender" value={data.bodyInfo.gender} />
                      <InfoCard label="Age" value={data.bodyInfo.age} />
                      <InfoCard
                        label="Upper Color"
                        value={data.bodyInfo.upperColor}
                      />
                      <InfoCard
                        label="Upper Type"
                        value={data.bodyInfo.upperType}
                      />
                      <InfoCard
                        label="Bottom Color"
                        value={data.bodyInfo.bottomColor}
                      />
                      <InfoCard
                        label="Bottom Type"
                        value={data.bodyInfo.bottomType}
                      />
                      <InfoCard label="Hair" value={data.bodyInfo.hair} />
                      <InfoCard label="Hat" value={data.bodyInfo.hat} />
                      <InfoCard
                        label="Hat Color"
                        value={data.bodyInfo.hatColor}
                      />
                      <InfoCard label="Glasses" value={data.bodyInfo.glasses} />
                      <InfoCard label="Mask" value={data.bodyInfo.mask} />
                    </div>
                  </div>
                )}

                {/* Metadata */}
                {data.metadata && (
                  <div className="mb-8 bg-gray-50 p-6 rounded-xl">
                    <h3 className="text-xl font-bold text-gray-800 mb-4">
                      🔧 Technical Details
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <InfoCard
                        label="Tenant ID"
                        value={data.metadata.tenantId}
                      />
                      <InfoCard
                        label="Capture ID"
                        value={data.metadata.captureId}
                      />
                      <InfoCard
                        label="Device ID"
                        value={data.metadata.deviceId}
                      />
                      <InfoCard
                        label="Recognition Device"
                        value={data.metadata.recogDeviceNo}
                      />
                      <InfoCard
                        label="Track ID"
                        value={data.metadata.trackId}
                      />
                      <InfoCard
                        label="Scene Code"
                        value={data.metadata.sceneCode}
                      />
                    </div>
                  </div>
                )}

                {/* Images for Recognized */}
                {data.images &&
                  (data.images.originPic ||
                    data.images.bodyPic ||
                    data.images.facePic) && (
                    <div>
                      <h3 className="text-2xl font-bold text-gray-800 mb-4">
                        📸 Captured Images
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {data.images.originPic && (
                          <div className="bg-gray-50 p-4 rounded-xl shadow-md hover:shadow-xl transition-shadow">
                            <h4 className="text-center font-semibold mb-3 text-gray-700">
                              Original Picture
                            </h4>
                            <img
                              src={data.images.originPic}
                              alt="Original"
                              className="w-full rounded-lg"
                            />
                          </div>
                        )}
                        {data.images.facePic && (
                          <div className="bg-gray-50 p-4 rounded-xl shadow-md hover:shadow-xl transition-shadow">
                            <h4 className="text-center font-semibold mb-3 text-gray-700">
                              Face Picture
                            </h4>
                            <img
                              src={data.images.facePic}
                              alt="Face"
                              className="w-full rounded-lg"
                            />
                          </div>
                        )}
                        {data.images.bodyPic && (
                          <div className="bg-gray-50 p-4 rounded-xl shadow-md hover:shadow-xl transition-shadow">
                            <h4 className="text-center font-semibold mb-3 text-gray-700">
                              Body Picture
                            </h4>
                            <img
                              src={data.images.bodyPic}
                              alt="Body"
                              className="w-full rounded-lg"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
