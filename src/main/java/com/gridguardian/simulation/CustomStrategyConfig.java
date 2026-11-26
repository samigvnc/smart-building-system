package com.gridguardian.simulation;

public record CustomStrategyConfig(
        double minimumReservePercent,
        double highPriceThreshold,
        int outagePreparationHours,
        boolean useBatteryForHighPrice,
        boolean prioritizeCriticalBuildings
) {

    public CustomStrategyConfig {

        if (minimumReservePercent < 0
                || minimumReservePercent > 100) {
            throw new IllegalArgumentException(
                    "Minimum reserve must be between 0 and 100."
            );
        }

        if (highPriceThreshold < 0) {
            throw new IllegalArgumentException(
                    "High price threshold cannot be negative."
            );
        }

        if (outagePreparationHours < 0) {
            throw new IllegalArgumentException(
                    "Outage preparation hours cannot be negative."
            );
        }
    }

    public static CustomStrategyConfig defaultConfig() {
        return new CustomStrategyConfig(
                25.0,
                2.5,
                3,
                true,
                true
        );
    }
}