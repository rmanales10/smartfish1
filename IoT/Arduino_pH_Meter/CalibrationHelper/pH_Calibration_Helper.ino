/*
 * pH Sensor Calibration Helper
 * 
 * This sketch helps you calibrate your pH sensor by displaying
 * the raw voltage readings for known pH buffer solutions.
 * 
 * INSTRUCTIONS:
 * 1. Upload this sketch to your Arduino
 * 2. Open Serial Monitor (9600 baud)
 * 3. Immerse sensor in pH 7.0 buffer solution
 * 4. Wait 30 seconds for stabilization
 * 5. Note the "Voltage" value - this is ph7_voltage
 * 6. Rinse sensor with distilled water
 * 7. Immerse sensor in pH 4.0 buffer solution
 * 8. Wait 30 seconds for stabilization
 * 9. Note the "Voltage" value - this is ph4_voltage
 * 10. Use these values in Arduino_pH_Meter.ino
 */

unsigned long int avgval;
int buffer_arr[10], temp;

void setup() {
  Serial.begin(9600);
  Serial.println("\n=== pH Sensor Calibration Helper ===");
  Serial.println("READY - Immerse sensor in buffer solution");
  Serial.println("====================================\n");
  delay(1000);
}

void loop() {
  // Take 10 readings
  for (int i = 0; i < 10; i++) {
    buffer_arr[i] = analogRead(A0);
    delay(30);
  }

  // Sort readings
  for (int i = 0; i < 9; i++) {
    for (int j = i + 1; j < 10; j++) {
      if (buffer_arr[i] > buffer_arr[j]) {
        temp = buffer_arr[i];
        buffer_arr[i] = buffer_arr[j];
        buffer_arr[j] = temp;
      }
    }
  }

  // Calculate average of middle 6 values (remove outliers)
  avgval = 0;
  for (int i = 2; i < 8; i++) {
    avgval += buffer_arr[i];
  }

  float avg_analog = avgval / 6.0;
  float voltage = avg_analog * 5.0 / 1024.0;
  
  // Display voltage prominently (this is what you need!)
  Serial.print(">>> VOLTAGE: ");
  Serial.print(voltage, 3);
  Serial.print("V");
  
  // Calculate estimated pH using typical values (for reference only)
  float estimated_ph = -5.70 * voltage + 21.34;
  Serial.print(" | Est. pH: ");
  Serial.print(estimated_ph, 2);
  
  Serial.println();
  
  delay(1000);  // Update every 1 second for faster reading
}

