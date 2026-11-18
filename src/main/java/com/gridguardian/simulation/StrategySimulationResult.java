package com.gridguardian.simulation;

import java.util.List;

public record StrategySimulationResult(
        SimulationSummary summary,
        List<HourlyResult> hourlyResults
) {

    public StrategySimulationResult {
        if (summary == null) {
            throw new IllegalArgumentException("Summary cannot be null.");
        }

        if (hourlyResults == null) {
            throw new IllegalArgumentException("Hourly results cannot be null.");
        }

        hourlyResults = List.copyOf(hourlyResults);
    }
}
