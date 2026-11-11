package com.gridguardian.simulation;

import java.util.List;

public class SimulationMetricsCalculator {

    public SimulationSummary calculate(
            String strategyName,
            List<HourlyResult> results
    ) {

        if (results == null || results.isEmpty()) {
            throw new IllegalArgumentException("Simulation results cannot be empty.");
        }

        double totalCost = 0.0;
        double gridUsage = 0.0;
        double solarUsage = 0.0;
        double batteryUsage = 0.0;
        double unservedEnergy = 0.0;
        double totalAvailableSolar = 0.0;

        for (HourlyResult result : results) {
            totalCost += result.cost();
            gridUsage += result.gridToLoadKwh();

            solarUsage +=
                    result.solarToLoadKwh()
                            + result.solarToBatteryKwh();

            batteryUsage += result.batteryToLoadKwh();
            unservedEnergy += result.unservedEnergyKwh();
            totalAvailableSolar += result.solarAvailableKwh();
        }

        double renewableUtilization = 0.0;

        if (totalAvailableSolar > 0.0) {
            renewableUtilization =
                    solarUsage
                            / totalAvailableSolar
                            * 100.0;
        }

        double finalBatterySoc =
                results.get(results.size() - 1)
                        .batterySocEndKwh();

        return new SimulationSummary(
                strategyName,
                totalCost,
                gridUsage,
                solarUsage,
                batteryUsage,
                unservedEnergy,
                renewableUtilization,
                finalBatterySoc
        );
    }
}
