package com.gridguardian.simulation;

import java.util.List;

public interface SimulationInputProvider {
    List<HourlyInput> loadInputs();
}