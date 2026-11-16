package com.gridguardian.simulation;

public record SmartStrategyConfig(
        double minimumReservePercent,
        double highPriceThreshold,
        int outageLookAheadHours
) {

    public SmartStrategyConfig {

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

        if (outageLookAheadHours < 0) {
            throw new IllegalArgumentException(
                    "Outage look-ahead cannot be negative."
            );
        }
    }

    public static SmartStrategyConfig defaultConfig() {
        return new SmartStrategyConfig(
                25.0,
                2.5,
                3
        );
    }
}