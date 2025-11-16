'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import FishDetectionModal from '@/components/FishDetectionModal';
import Image from 'next/image';

interface SensorData {
  ph: number | null;
  temperature: number | null;
}

const HIGH_TEMP_SMS_THRESHOLD = 29; // °C - treat as critically high
const TEMP_ALERT_RESET_THRESHOLD = 27; // °C - require cooldown back in safe range
const TEMP_SMS_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes

export default function DashboardPage() {
  const [sensorData, setSensorData] = useState<SensorData>({ ph: null, temperature: null });
  const [connectionStatus, setConnectionStatus] = useState(true);
  const [lastDataTimestamp, setLastDataTimestamp] = useState<number>(Date.now());
  const hasActiveHighTempAlert = useRef(false);
  const lastHighTempSmsAt = useRef(0);

  const sendHighTempSms = useCallback(async (temperature: number) => {
    const message = `SmartFish Care Alert: Water temperature is critically high at ${temperature.toFixed(
      2,
    )}°C. Please check your system immediately.`;

    try {
      const response = await fetch('/api/sms/send', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message }),
      });

      const result = await response.json().catch(() => null);
      if (!response.ok || result?.success === false) {
        console.error('Failed to send high-temperature SMS alert', result);
        return;
      }

      console.log('High-temperature SMS alert sent', result);
    } catch (error) {
      console.error('Error sending high-temperature SMS alert', error);
    }
  }, []);

  useEffect(() => {
    // Fetch initial data immediately (before SSE connects)
    const fetchInitialData = async () => {
      try {
        const response = await fetch('/api/iot-data?t=' + new Date().getTime());
        const json = await response.json();
        console.log('Initial data fetch:', json);

        if (json.data) {
          const ph = json.data.ph !== null && json.data.ph !== undefined
            ? parseFloat(json.data.ph.toString())
            : null;
          const temperature = json.data.temperature !== null && json.data.temperature !== undefined
            ? parseFloat(json.data.temperature.toString())
            : null;

          const isPHValid = ph !== null && !isNaN(ph) && ph >= 0.0 && ph <= 14.0;
          const isTempValid = temperature !== null && !isNaN(temperature) && temperature > -20 && temperature < 100;

          if (isPHValid || isTempValid) {
            setSensorData({ ph: isPHValid ? ph : null, temperature: isTempValid ? temperature : null });
            setLastDataTimestamp(Date.now()); // Update timestamp when valid data is received
            setConnectionStatus(true);
          }
        }
      } catch (err) {
        console.error('Error fetching initial data:', err);
      }
    };

    fetchInitialData();

    // Set up polling as primary method (more reliable than SSE)
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch('/api/iot-data?t=' + new Date().getTime());
        const json = await response.json();

        if (json.data) {
          const ph = json.data.ph !== null && json.data.ph !== undefined
            ? parseFloat(json.data.ph.toString())
            : null;
          const temperature = json.data.temperature !== null && json.data.temperature !== undefined
            ? parseFloat(json.data.temperature.toString())
            : null;

          const isPHValid = ph !== null && !isNaN(ph) && ph >= 0.0 && ph <= 14.0;
          const isTempValid = temperature !== null && !isNaN(temperature) && temperature > -20 && temperature < 100;

          if (isPHValid || isTempValid) {
            setSensorData({ ph: isPHValid ? ph : null, temperature: isTempValid ? temperature : null });
            setLastDataTimestamp(Date.now()); // Update timestamp when valid data is received
            setConnectionStatus(true);
          }
        }
      } catch (err) {
        console.error('Error polling sensor data:', err);
      }
    }, 1000); // Poll every 1 second

    // Use Server-Sent Events for real-time updates (secondary method)
    const eventSource = new EventSource('/api/iot-data/stream');

    eventSource.onopen = () => {
      console.log('SSE connection opened');
      setConnectionStatus(true);
    };

    eventSource.onmessage = (event) => {
      try {
        console.log('SSE message received:', event.data);
        const data = JSON.parse(event.data);
        console.log('Parsed SSE data:', data);

        const ph = data.ph !== null && data.ph !== undefined
          ? parseFloat(data.ph.toString())
          : null;
        const temperature = data.temperature !== null && data.temperature !== undefined
          ? parseFloat(data.temperature.toString())
          : null;

        console.log('Extracted values - pH:', ph, 'Temperature:', temperature);

        const isPHValid = ph !== null && !isNaN(ph) && ph >= 0.0 && ph <= 14.0;
        const isTempValid = temperature !== null && !isNaN(temperature) && temperature > -20 && temperature < 100;

        console.log('Validation - pH valid:', isPHValid, 'Temp valid:', isTempValid);

        if (isPHValid || isTempValid) {
          const newData = { ph: isPHValid ? ph : null, temperature: isTempValid ? temperature : null };
          console.log('Setting sensor data:', newData);
          setSensorData(newData);
          setLastDataTimestamp(Date.now()); // Update timestamp when valid data is received
          setConnectionStatus(true);
        } else {
          console.log('Data validation failed, setting to null');
          setSensorData({ ph: null, temperature: null });
          setConnectionStatus(true);
        }
      } catch (err) {
        console.error('Error parsing SSE data:', err, 'Raw data:', event.data);
      }
    };

    eventSource.onerror = (err) => {
      console.error('SSE connection error:', err);
      console.error('EventSource readyState:', eventSource.readyState);
      // Don't close immediately - SSE will auto-reconnect
      // Only close if it's been closed (readyState === 2)
      if (eventSource.readyState === EventSource.CLOSED) {
        eventSource.close();
        setConnectionStatus(false);
      }

      // Fallback to polling if SSE fails (reads from in-memory data, no database)
      // Only set up fallback if SSE is actually closed
      if (eventSource.readyState === EventSource.CLOSED) {
        const fetchSensorData = () => {
          fetch('/api/iot-data?t=' + new Date().getTime())
            .then((response) => {
              if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
              }
              return response.json();
            })
            .then((json) => {
              console.log('Fallback polling - received data:', json);
              const ph = json.data?.ph !== null && json.data?.ph !== undefined
                ? parseFloat(json.data.ph.toString())
                : null;
              const temperature = json.data?.temperature !== null && json.data?.temperature !== undefined
                ? parseFloat(json.data.temperature.toString())
                : null;

              const isPHValid = ph !== null && !isNaN(ph) && ph >= 0.0 && ph <= 14.0;
              const isTempValid = temperature !== null && !isNaN(temperature) && temperature > -20 && temperature < 100;

              if (isPHValid || isTempValid) {
                setSensorData({ ph: isPHValid ? ph : null, temperature: isTempValid ? temperature : null });
                setLastDataTimestamp(Date.now()); // Update timestamp when valid data is received
                setConnectionStatus(true);
              } else {
                // No data yet, but connection is working
                setConnectionStatus(true);
              }
            })
            .catch((err) => {
              console.error('Error fetching sensor data (fallback):', err);
              setConnectionStatus(false);
            });
        };

        fetchSensorData();
        const interval = setInterval(fetchSensorData, 2000); // Poll every 2 seconds as fallback

        return () => {
          clearInterval(interval);
        };
      }
    };

    return () => {
      clearInterval(pollInterval);
      eventSource.close();
    };
  }, []);

  // Separate effect for timeout check (runs independently)
  useEffect(() => {
    const timeoutInterval = setInterval(() => {
      const timeSinceLastData = Date.now() - lastDataTimestamp;
      if (timeSinceLastData > 5000 && (sensorData.ph !== null || sensorData.temperature !== null)) {
        console.log('No sensor data received in 5 seconds, clearing display');
        setSensorData({ ph: null, temperature: null });
        setConnectionStatus(false);
      }
    }, 1000); // Check every second

    return () => {
      clearInterval(timeoutInterval);
    };
  }, [lastDataTimestamp, sensorData]);

  useEffect(() => {
    const temp = sensorData.temperature;
    if (temp === null || isNaN(temp)) {
      return;
    }

    const now = Date.now();
    const isDangerouslyHigh = temp >= HIGH_TEMP_SMS_THRESHOLD;

    if (isDangerouslyHigh) {
      const cooldownExpired = now - lastHighTempSmsAt.current > TEMP_SMS_COOLDOWN_MS;
      if (!hasActiveHighTempAlert.current || cooldownExpired) {
        hasActiveHighTempAlert.current = true;
        lastHighTempSmsAt.current = now;
        void sendHighTempSms(temp);
      }
    } else if (temp <= TEMP_ALERT_RESET_THRESHOLD) {
      // Reset when water cools down to prevent missing future alerts
      hasActiveHighTempAlert.current = false;
    }
  }, [sensorData.temperature, sendHighTempSms]);

  const interpretPHStatus = (ph: number | null) => {
    if (ph === null || isNaN(ph) || ph < 0.0 || ph > 14.0)
      return { status: 'No Data', color: 'gray' };
    if (ph >= 6.5 && ph <= 8.0) return { status: 'SAFE', color: 'green' };
    if (ph >= 4.1 && ph < 6.5) return { status: 'ACIDIC', color: 'orange' };
    if (ph > 8.0) return { status: 'ALKALINE', color: 'orange' };
    if (ph <= 4.0) return { status: 'DNG ACIDIC', color: 'red' };
    return { status: 'UNKNOWN', color: 'gray' };
  };

  const interpretTemperatureStatus = (temp: number | null) => {
    if (temp === null || isNaN(temp)) return { status: 'No Data', color: 'gray' };
    if (temp >= 24 && temp <= 27) return { status: `${temp.toFixed(1)} °C`, color: 'green' };
    if ((temp >= 22 && temp < 24) || (temp > 27 && temp <= 29))
      return { status: `${temp.toFixed(1)} °C`, color: 'orange' };
    return { status: `${temp.toFixed(1)} °C`, color: 'red' };
  };

  const phStatus = interpretPHStatus(sensorData.ph);
  const tempStatus = interpretTemperatureStatus(sensorData.temperature);



  return (
    <>
      <header className="text-center mb-6 sm:mb-10">
        <Image
          src="/smartfishcarelogo.png"
          alt="Smart Fish Care Logo"
          width={150}
          height={150}
          className="mx-auto mb-2 drop-shadow-lg w-24 h-24 sm:w-32 sm:h-32 md:w-[150px] md:h-[150px]"
          priority
        />
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#e6e9ef] mb-2">Dashboard</h1>
        <div className="mt-3 sm:mt-4">
          <p className="text-sm sm:text-base md:text-lg text-[#e6e9ef]">
            Connection Status:{' '}
            <span className={connectionStatus ? 'text-green-500' : 'text-red-500'}>
              {connectionStatus ? 'Connected' : 'Not Connected'}
            </span>
          </p>
          <p id="data-status" className={`mt-2 text-xs sm:text-sm ${connectionStatus ? 'text-[#a2a8b6]' : 'text-red-500'}`}>
            {connectionStatus ? (
              sensorData.ph !== null || sensorData.temperature !== null
                ? `Last updated: ${new Date().toLocaleTimeString()}`
                : 'No valid sensor data detected.'
            ) : (
              'Connection error - Unable to fetch sensor data'
            )}
          </p>
        </div>
      </header>

      {/* Sensor Data Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
        {/* Water Temperature Card */}
        <div className="bg-gradient-to-b from-white/6 to-white/2 border border-white/8 rounded-xl sm:rounded-2xl p-5 sm:p-6 backdrop-blur-sm shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base sm:text-lg font-semibold text-[#e6e9ef]">Water Temperature</h3>
            <i className="fas fa-thermometer-half text-2xl text-blue-400"></i>
          </div>
          <div className="text-center">
            <div className={`text-4xl sm:text-5xl font-bold mb-2 ${tempStatus.color === 'green' ? 'text-green-500' :
              tempStatus.color === 'orange' ? 'text-orange-500' :
                tempStatus.color === 'red' ? 'text-red-500' :
                  'text-gray-500'
              }`}>
              {tempStatus.status}
            </div>
          </div>
        </div>

        {/* Water Quality Level Card */}
        <div className="bg-gradient-to-b from-white/6 to-white/2 border border-white/8 rounded-xl sm:rounded-2xl p-5 sm:p-6 backdrop-blur-sm shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base sm:text-lg font-semibold text-[#e6e9ef]">Water Quality (pH)</h3>
            <i className="fas fa-flask text-2xl text-purple-400"></i>
          </div>
          <div className="text-center">
            {sensorData.ph !== null && !isNaN(sensorData.ph) ? (
              <>
                <div className={`text-4xl sm:text-5xl font-bold mb-2 ${phStatus.color === 'green' ? 'text-green-500' :
                  phStatus.color === 'orange' ? 'text-orange-500' :
                    phStatus.color === 'red' ? 'text-red-500' :
                      'text-gray-500'
                  }`}>
                  {sensorData.ph.toFixed(2)}
                </div>
                <div className={`text-sm font-medium ${phStatus.color === 'green' ? 'text-green-400' :
                  phStatus.color === 'orange' ? 'text-orange-400' :
                    phStatus.color === 'red' ? 'text-red-400' :
                      'text-gray-400'
                  }`}>
                  {phStatus.status}
                </div>
              </>
            ) : (
              <div className="text-4xl font-bold text-gray-500">No Data</div>
            )}
          </div>
        </div>
      </div>

      {/* Fish Detection Section - Directly on Dashboard */}
      <div className="mb-10">
        <FishDetectionModal />
      </div>
    </>
  );
}
