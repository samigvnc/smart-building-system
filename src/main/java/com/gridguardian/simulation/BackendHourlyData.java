package com.gridguardian.simulation;

import java.util.List;

public record BackendHourlyData(
        int hour,
        List<BackendBuildingLoad> buildings,
        double solarGenerationKwh,
        boolean gridAvailable,
        boolean batteryAvailable,
        double gridPricePerKwh
) {

    public BackendHourlyData {

        if (hour < 0 || hour > 23) {
            throw new IllegalArgumentException(
                    "Hour must be between 0 and 23."
            );
        }

        if (buildings == null) {
            throw new IllegalArgumentException(
                    "Buildings cannot be null."
            );
        }

        if (solarGenerationKwh < 0) {
            throw new IllegalArgumentException(
                    "Solar generation cannot be negative."
            );
        }

        if (gridPricePerKwh < 0) {
            throw new IllegalArgumentException(
                    "Grid price cannot be negative."
            );
        }

        buildings = List.copyOf(buildings);
    }

    public BackendHourlyData(
            int hour,
            List<BackendBuildingLoad> buildings,
            double solarGenerationKwh,
            boolean gridAvailable,
            double gridPricePerKwh
    ) {
        this(
                hour,
                buildings,
                solarGenerationKwh,
                gridAvailable,
                true,
                gridPricePerKwh
        );
    }
}