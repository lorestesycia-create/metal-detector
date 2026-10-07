package com.metaldetector.smartscanner;

import android.content.Context;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "MagneticSensor")
public class MagneticSensorPlugin extends Plugin implements SensorEventListener {

    private SensorManager sensorManager;
    private Sensor magneticSensor;
    private boolean listening = false;

    @Override
    public void load() {
        sensorManager =
            (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);

        if (sensorManager != null) {
            magneticSensor =
                sensorManager.getDefaultSensor(Sensor.TYPE_MAGNETIC_FIELD);
        }
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject result = new JSObject();
        result.put("available", magneticSensor != null);
        call.resolve(result);
    }

    @PluginMethod
    public void start(PluginCall call) {
        if (sensorManager == null || magneticSensor == null) {
            call.reject("Magnetic sensor unavailable");
            return;
        }

        if (!listening) {
            listening = sensorManager.registerListener(
                this,
                magneticSensor,
                SensorManager.SENSOR_DELAY_GAME
            );
        }

        if (listening) {
            call.resolve();
        } else {
            call.reject("Unable to start magnetic sensor");
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        if (sensorManager != null && listening) {
            sensorManager.unregisterListener(this);
        }

        listening = false;
        call.resolve();
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        if (event.sensor.getType() != Sensor.TYPE_MAGNETIC_FIELD) return;

        JSObject data = new JSObject();
        data.put("x", event.values[0]);
        data.put("y", event.values[1]);
        data.put("z", event.values[2]);

        notifyListeners("magneticField", data);
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {}
}
