package com.gridguardian.simulation;

public record SimulationSummary(
        String strategyName,
        double totalCost,
        double gridUsageKwh,
        double solarUsageKwh,
        double batteryUsageKwh,
        double unservedEnergyKwh,
        double renewableUtilizationPercent,
        double finalBatterySocKwh
) {

    public SimulationSummary {
        if (strategyName == null || strategyName.isBlank()) {
            throw new IllegalArgumentException("Strategy name cannot be empty.");
        }
    }
}
