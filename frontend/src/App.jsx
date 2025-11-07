import { useEffect, useState } from "react";

export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchLatest = async () => {
    try {
      const res = await fetch("/api/face-recognition/latest");
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLatest();
    const interval = setInterval(fetchLatest, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center p-8">
      <h1 className="text-3xl font-bold mb-6">Face Recognition Dashboard</h1>

      {loading && <p className="text-gray-600">Loading...</p>}
      {error && <p className="text-red-600">{error}</p>}

      {data && (
        <div className="w-full max-w-3xl bg-white shadow-lg rounded-2xl p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Latest Recognition</h2>
            <span
              className={`px-3 py-1 rounded-full text-white text-sm ${
                data.recognized ? "bg-green-600" : "bg-red-600"
              }`}
            >
              {data.recognized ? "Recognized" : "Not Recognized"}
            </span>
          </div>

          {/* User Info */}
          {data.recognized ? (
            <div className="mb-4">
              <p className="text-lg font-medium">Name: {data.name}</p>
              <p>Person ID: {data.personId}</p>
              <p>Group: {data.groupName}</p>
              <p>Captured: {data.captureTime}</p>
            </div>
          ) : (
            <p className="mb-4 text-gray-700">No user match found.</p>
          )}

          {/* Device Info */}
          <div className="bg-gray-100 rounded-xl p-4 mb-4">
            <h3 className="text-lg font-semibold mb-2">Device Info</h3>
            <p>Device Name: {data.deviceName || data.deviceInfo?.deviceName}</p>
            <p>Device IP: {data.deviceIp || data.deviceInfo?.deviceIp}</p>
            <p>Device No: {data.deviceNo || data.deviceInfo?.deviceNo}</p>
            <p>Track ID: {data.trackId || data.deviceInfo?.trackId}</p>
          </div>

          {/* Images */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Captured Images</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {data.images?.originPic && (
                <div className="bg-gray-50 p-2 rounded-xl shadow">
                  <p className="text-sm mb-2 text-center">Origin</p>
                  <img
                    src={data.images.originPic}
                    alt="origin"
                    className="rounded-xl object-cover w-full h-40"
                  />
                </div>
              )}

              {data.images?.bodyPic && (
                <div className="bg-gray-50 p-2 rounded-xl shadow">
                  <p className="text-sm mb-2 text-center">Body</p>
                  <img
                    src={data.images.bodyPic}
                    alt="body"
                    className="rounded-xl object-cover w-full h-40"
                  />
                </div>
              )}

              {data.images?.facePic && (
                <div className="bg-gray-50 p-2 rounded-xl shadow">
                  <p className="text-sm mb-2 text-center">Face</p>
                  <img
                    src={data.images.facePic}
                    alt="face"
                    className="rounded-xl object-cover w-full h-40"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
