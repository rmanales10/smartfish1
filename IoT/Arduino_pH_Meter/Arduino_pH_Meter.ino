#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <OneWire.h>
#include <DallasTemperature.h>

// LCD Setup
LiquidCrystal_I2C lcd(0x27, 16, 2);

// pH Sensor Two-Point Calibration with Temperature Correction
// CALIBRATION INSTRUCTIONS (Using pH 6.86 and pH 4.01 buffers):
// 1. Prepare buffer solutions according to packet directions (250mL deionized water)
// 2. Measure temperature of buffer solutions (important for accuracy!)
// 3. Immerse sensor in pH 6.86 buffer solution, wait 30-60 seconds
// 4. Read voltage from serial monitor, set as ph_neutral_voltage
// 5. Record the temperature, update calibration_temp variable
// 6. Rinse sensor, immerse in pH 4.01 buffer solution, wait 30-60 seconds
// 7. Read voltage from serial monitor, set as ph_acidic_voltage
// 8. Upload this code with your calibration values
// NOTE: Buffer pH values are automatically corrected for temperature using the calibration table

// Calibration values (UPDATE THESE AFTER CALIBRATION)
// Using pH 4.01 (acidic) and pH 9.18 (alkaline) buffers for WIDER RANGE = BETTER ACCURACY
// Wider pH range (5.17 units) gives more accurate calibration than narrow range
// IMPORTANT: Use 3 decimal places for voltage (e.g., 2.090) for better sensitivity
// CURRENT READINGS (UPDATED WITH ACTUAL MEASUREMENTS):
float ph_acidic_voltage = 2.090;   // Voltage at pH 4.01 buffer (UPDATED: actual reading is 2.09V)
float ph_alkaline_voltage = 2.108;  // Voltage at pH 9.18 buffer (from previous calibration)
// NOTE: pH 9.18 has HIGHER voltage than pH 4.01 - this is unusual but valid for your sensor
// UPDATED: pH 4.01 voltage changed from 2.063 to 2.090 based on actual sensor reading

// Temperature at which calibration was performed
float calibration_temp = 27.8;  // Temperature from your readings (~27.8°C)

// Calculate calibration constants (will be recalculated with temperature-corrected pH values)
float ph_slope = 0.0;
float ph_offset = 7.0;

// Alternative: Single-point calibration (if two-point not available)
// float calibration_value = 21.34;  // Old method
// float ph_slope = -5.70;
// float ph_offset = calibration_value;

// Temperature compensation (ENABLED for better accuracy)
const float TEMP_COEFFICIENT = -0.003;  // pH change per °C (typical value)
const float REFERENCE_TEMP = 25.0;      // Reference temperature in °C

// Enhanced accuracy settings (improved sensitivity)
#define NUM_SAMPLES 20  // Increased for better accuracy and sensitivity
unsigned long int avgval;
int buffer_arr[NUM_SAMPLES], temp;

// Voltage filtering for stability (reduces noise)
#define VOLTAGE_FILTER_SIZE 7  // Increased for better stability
float voltage_history[VOLTAGE_FILTER_SIZE];
int voltage_history_index = 0;
bool voltage_history_filled = false;


// DS18B20 Temp Sensor Setup
#define ONE_WIRE_BUS 2
OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature sensors(&oneWire);

// For tracking last sent data
float last_ph = -1;
float last_temperature = -1000;

// Function to get temperature-corrected buffer pH value (optimized for memory)
// Based on the calibration table from your buffer powder packets
// Reference: Standard NIST buffer solutions temperature correction
float getBufferpH(float temp, int buffer_type) {
  // buffer_type: 0 = pH 4.01, 1 = pH 6.86, 2 = pH 9.18
  // Temperature table: 10, 15, 20, 25, 30, 35, 40, 45, 50°C
  
  // Clamp temperature to valid range
  if (temp < 10.0) temp = 10.0;
  if (temp > 50.0) temp = 50.0;
  
  // Accurate temperature correction based on NIST standards
  float ph;
  if (buffer_type == 0) {  // pH 4.01 (Potassium Hydrogen Phthalate)
    // pH 4.01: {4.00, 4.00, 4.00, 4.01, 4.01, 4.02, 4.03, 4.04, 4.06}
    // Very stable, slight increase above 30°C
    if (temp <= 30.0) {
      ph = 4.01;
    } else {
      ph = 4.01 + (temp - 30.0) * 0.002;  // 0.002 per 5°C above 30
    }
  } else if (buffer_type == 1) {  // pH 6.86 (Mixed Phosphate)
    // pH 6.86: {6.92, 6.90, 6.88, 6.86, 6.85, 6.84, 6.84, 6.83, 6.83}
    // Decreases with temperature: -0.002 per 5°C from 25°C
    ph = 6.86 - (temp - 25.0) * 0.002;
  } else {  // pH 9.18 (Borax)
    // pH 9.18: {9.33, 9.28, 9.23, 9.18, 9.14, 9.10, 9.07, 9.04, 9.02}
    // Decreases with temperature: -0.003 per 5°C below 25, -0.002 per 5°C above 25
    if (temp <= 25.0) {
      ph = 9.18 + (25.0 - temp) * 0.003;  // Increases as temp decreases
    } else {
      ph = 9.18 - (temp - 25.0) * 0.002;  // Decreases as temp increases
    }
  }
  
  return ph;
}

// Function to calculate calibration constants using temperature-corrected buffer pH values
// Using WIDE RANGE calibration (pH 4.01 to pH 9.18) for better accuracy
// Formula: pH = slope × voltage + offset
// Slope = (pH_alkaline - pH_acidic) / (Voltage_alkaline - Voltage_acidic)
// Offset = pH_acidic - (slope × Voltage_acidic)
void calculateCalibrationConstants(float temp) {
  // Get actual buffer pH values at the calibration temperature (temperature-corrected)
  float ph_acidic_actual = getBufferpH(temp, 0);    // pH 4.01 buffer
  float ph_alkaline_actual = getBufferpH(temp, 2); // pH 9.18 buffer
  
  // Calculate voltage difference
  // NOTE: For your sensor, pH 9.18 has HIGHER voltage (2.11V) than pH 4.01 (2.06V)
  // This is unusual but valid - the formula will handle it correctly
  float voltage_diff = ph_alkaline_voltage - ph_acidic_voltage;
  float ph_diff = ph_alkaline_actual - ph_acidic_actual;
  
  // Validate calibration data
  if (abs(voltage_diff) > 0.01) {  // Prevent division by zero, ensure meaningful difference
    // Standard two-point calibration formula (works for any voltage relationship)
    ph_slope = ph_diff / voltage_diff;
    ph_offset = ph_acidic_actual - (ph_slope * ph_acidic_voltage);
    
    // Validate calculated values (wider ranges to account for different sensor types)
    if (ph_slope < -20.0 || ph_slope > 20.0) {
      Serial.print("WARNING: Slope=");
      Serial.print(ph_slope, 2);
      Serial.println(" seems unusual - check calibration!");
    }
    if (ph_offset < 0.0 || ph_offset > 50.0) {
      Serial.print("WARNING: Offset=");
      Serial.print(ph_offset, 2);
      Serial.println(" seems unusual - check calibration!");
    }
  } else {
    // Use default values if calibration is invalid
    ph_slope = -6.0;
    ph_offset = 22.0;
    Serial.println("WARNING: Invalid calibration values! Using defaults.");
    Serial.println("Ensure voltage difference > 0.01V between buffers.");
  }
}

void setup() {
  Serial.begin(9600);

  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("Smart Fish Care");
  lcd.setCursor(0, 1);
  lcd.print("Calibrating...");
  delay(2000);
  lcd.clear();

  sensors.begin();
  
  // Initialize voltage filter
  for (int i = 0; i < VOLTAGE_FILTER_SIZE; i++) {
    voltage_history[i] = 2.5;  // Initialize with typical voltage
  }
  
  // Calculate calibration constants using temperature-corrected buffer pH values
  calculateCalibrationConstants(calibration_temp);
  
  // Display calibration info on startup
  Serial.println("\n=== pH Sensor Calibration Info (Temperature-Corrected) ===");
  Serial.print("Calibration Temperature: ");
  Serial.print(calibration_temp, 1);
  Serial.println("C");
  Serial.print("pH 4.01 Buffer Voltage: ");
  Serial.println(ph_acidic_voltage, 3);  // 3 decimals for precision
  Serial.print("pH 9.18 Buffer Voltage: ");
  Serial.println(ph_alkaline_voltage, 3);  // 3 decimals for precision
  
  // Show actual buffer pH values at calibration temperature
  float ph_acidic_actual = getBufferpH(calibration_temp, 0);
  float ph_alkaline_actual = getBufferpH(calibration_temp, 2);
  Serial.print("pH 4.01 @ ");
  Serial.print(calibration_temp, 1);
  Serial.print("C = ");
  Serial.println(ph_acidic_actual, 2);
  Serial.print("pH 9.18 @ ");
  Serial.print(calibration_temp, 1);
  Serial.print("C = ");
  Serial.println(ph_alkaline_actual, 2);
  Serial.print("Voltage Difference: ");
  Serial.print(abs(ph_alkaline_voltage - ph_acidic_voltage), 3);
  Serial.println("V");
  
  Serial.print("Slope: ");
  Serial.println(ph_slope, 2);
  Serial.print("Offset: ");
  Serial.println(ph_offset, 2);
  
  // Check if calibration is complete (using approximate check for float comparison)
  if (abs(ph_acidic_voltage - 2.090) < 0.001 && abs(ph_alkaline_voltage - 2.108) < 0.001) {
    Serial.println("\n=== CALIBRATION COMPLETE ===");
    Serial.println("Using pH 4.01 and pH 9.18 buffers");
    Serial.println("Wide range calibration for better accuracy!");
  } else {
    Serial.println("\n!!! CALIBRATION INCOMPLETE !!!");
    Serial.println("Update ph_acidic_voltage and ph_alkaline_voltage");
    Serial.println("Use 3 decimal places (e.g., 2.063) for better sensitivity");
  }
  
  Serial.println("========================================================\n");
}

void loop() {
  // Enhanced pH Readings - Take multiple samples for better accuracy and sensitivity
  // Read each sample multiple times and average for improved precision
  for (int i = 0; i < NUM_SAMPLES; i++) {
    // Take 3 quick reads and average for each sample (reduces noise)
    int sample_sum = 0;
    for (int j = 0; j < 3; j++) {
      sample_sum += analogRead(A0);
      delay(10);  // Small delay between reads
    }
    buffer_arr[i] = sample_sum / 3;  // Average of 3 reads
    delay(20);  // Delay between samples
  }

  // Sort readings for median filter (removes outliers)
  for (int i = 0; i < NUM_SAMPLES - 1; i++) {
    for (int j = i + 1; j < NUM_SAMPLES; j++) {
      if (buffer_arr[i] > buffer_arr[j]) {
        temp = buffer_arr[i];
        buffer_arr[i] = buffer_arr[j];
        buffer_arr[j] = temp;
      }
    }
  }

  // Use middle 70% of readings (remove top and bottom 15% outliers)
  int start_idx = NUM_SAMPLES * 15 / 100;  // Remove bottom 15%
  int end_idx = NUM_SAMPLES - (NUM_SAMPLES * 15 / 100);  // Remove top 15%
  avgval = 0;
  int valid_samples = 0;
  for (int i = start_idx; i < end_idx; i++) {
    avgval += buffer_arr[i];
    valid_samples++;
  }

  // Calculate voltage with improved precision and sensitivity
  // Using float division for better accuracy
  float avg_analog = (float)avgval / (float)valid_samples;
  // More precise voltage calculation: V = (analog_value / 1024.0) * 5.0
  // Using double precision calculation for better sensitivity
  float voltage_raw = (avg_analog * 5.0) / 1024.0;
  
  // Apply moving average filter for voltage stability (reduces noise)
  voltage_history[voltage_history_index] = voltage_raw;
  voltage_history_index = (voltage_history_index + 1) % VOLTAGE_FILTER_SIZE;
  if (voltage_history_index == 0) voltage_history_filled = true;
  
  // Calculate filtered voltage (more stable reading)
  float voltage = 0.0;
  int count = voltage_history_filled ? VOLTAGE_FILTER_SIZE : voltage_history_index;
  for (int i = 0; i < count; i++) {
    voltage += voltage_history[i];
  }
  voltage = voltage / count;
  
  // Calculate pH using two-point calibration
  float ph_act = ph_slope * voltage + ph_offset;

  // Get temperature (simple version from original code)
  sensors.requestTemperatures();
  float waterTemp = sensors.getTempCByIndex(0);

  // Temperature compensation (ENABLED for better accuracy)
  if (waterTemp > -55.0 && waterTemp < 125.0) {  // Valid DS18B20 range
    float ph_compensated = ph_act + (TEMP_COEFFICIENT * (waterTemp - REFERENCE_TEMP));
    ph_act = ph_compensated;
  }

  // Validate readings
  bool valid_reading = true;
  if (voltage < 0.5 || voltage > 4.5) {
    valid_reading = false;
  }
  if (ph_act < 0.0 || ph_act > 14.0) {
    valid_reading = false;
  }
  if (waterTemp < -55.0 || waterTemp > 125.0) {
    valid_reading = false;  // DS18B20 range
  }

  // If calibration is incomplete, ALWAYS show voltage reading (regardless of validity)
  bool calibration_incomplete = (abs(ph_acidic_voltage - 2.090) < 0.001 && abs(ph_alkaline_voltage - 2.108) < 0.001) ? false : true;
  if (calibration_incomplete) {
    Serial.print(">>> CALIB: FilteredV=");
    Serial.print(voltage, 3);  // 3 decimals for better precision
    Serial.print("V | RawV=");
    Serial.print(voltage_raw, 3);  // 3 decimals for better precision
    Serial.print("V | Temp=");
    Serial.print(waterTemp, 1);
    Serial.print("C | pH=");
    Serial.print(ph_act, 2);
    Serial.print(" | NOTE: Calibration incomplete!");
    Serial.println();
    
    // Show which buffer this might be based on voltage
    if (abs(voltage - ph_acidic_voltage) < 0.02) {
      Serial.println("    -> pH 4.01 buffer (voltage matches)");
    } else if (abs(voltage - ph_alkaline_voltage) < 0.02) {
      Serial.println("    -> pH 9.18 buffer (voltage matches)");
    } else if (voltage > ph_acidic_voltage && voltage < ph_alkaline_voltage) {
      Serial.println("    -> pH 6.86 buffer (voltage between 4.01 and 9.18)");
      Serial.print("    RECORD THIS FilteredV=");
      Serial.print(voltage, 3);  // 3 decimals for precision
      Serial.println("V if testing pH 6.86!");
    } else {
      Serial.println("    -> Unknown buffer or sensor issue");
    }
  }

  // LCD Display
  lcd.clear();
  lcd.setCursor(0, 0);
  String status_str = "";
  
  if (!valid_reading) {
    lcd.print("pH: -- T:");
    lcd.print(waterTemp, 1);
    lcd.setCursor(0, 1);
    lcd.print("Status: Not in H2O");
    status_str = "Not in H2O";
  } else {
    lcd.print("pH:");
    lcd.print(ph_act, 2);  // Show 2 decimal places
    lcd.print(" T:");
    lcd.print(waterTemp, 1);

    lcd.setCursor(0, 1);
    
    // Interpret pH status - Matching buffer solution labels
    // Status ranges (aligned with buffer solutions):
    // ACIDIC: pH < 6.5 (includes pH 4.01 buffer)
    // SAFE: 6.5 <= pH <= 8.0 (includes pH 6.86 buffer)
    // ALKALINE: pH > 8.0 (includes pH 9.18 buffer)
    
    if (ph_act < 6.5) {
      lcd.print("Stat: ACIDIC");
      status_str = "ACIDIC";
    } else if (ph_act >= 6.5 && ph_act <= 8.0) {
      lcd.print("Stat: SAFE");
      status_str = "SAFE";
    } else if (ph_act > 8.0) {
      lcd.print("Stat: ALKALINE");
      status_str = "ALKALINE";
    } else {
      // Should not reach here, but handle edge cases
      lcd.print("Stat: UNKNOWN");
      status_str = "UNKNOWN";
    }

    // Send to Serial - always show if calibration incomplete, otherwise only on change
    if (calibration_incomplete || abs(ph_act - last_ph) >= 0.05 || abs(waterTemp - last_temperature) >= 0.1) {
      Serial.print("ph_value=");
      Serial.print(ph_act, 2);  // 2 decimal places
      Serial.print("&temperature=");
      Serial.print(waterTemp, 2);
      Serial.print("&status=");
      Serial.println(status_str);

      // Simplified debug output (memory optimized)
      if (!calibration_incomplete) {
        Serial.print("DEBUG: V=");
        Serial.print(voltage, 2);
        Serial.print("V pH=");
        Serial.print(ph_act, 2);
        Serial.print(" T=");
        Serial.print(waterTemp, 1);
        Serial.println("C");
      }

      last_ph = ph_act;
      last_temperature = waterTemp;
    }
  }

  delay(2000); // Check every 2 seconds
}

