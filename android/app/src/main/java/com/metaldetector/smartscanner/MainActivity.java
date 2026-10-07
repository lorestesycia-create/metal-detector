package com.metaldetector.smartscanner;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(MagneticSensorPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
