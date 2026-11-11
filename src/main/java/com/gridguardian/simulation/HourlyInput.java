package com.gridguardian.simulation;

import java.util.List;

public record HourlyInput(
        int hour,
        double demandKwh,
        List<BuildingLoad> buildingLoads,
        double solarGenerationKwh,
        boolean gridAvailable,
        boolean batteryAvailable,
        double gridPricePerKwh
) {

    private static final double EPSILON = 0.0001;

    public HourlyInput(
            int hour,
            double demandKwh,
            double solarGenerationKwh,
            boolean gridAvailable,
            double gridPricePerKwh
    ) {
        this(
                hour,
                demandKwh,
                List.of(),
                solarGenerationKwh,
                gridAvailable,
                true,
                gridPricePerKwh
        );
    }

    public HourlyInput(
            int hour,
            double demandKwh,
            double solarGenerationKwh,
            boolean gridAvailable,
            boolean batteryAvailable,
            double gridPricePerKwh
    ) {
        this(
                hour,
                demandKwh,
                List.of(),
                solarGenerationKwh,
                gridAvailable,
                batteryAvailable,
                gridPricePerKwh
        );
    }

    public HourlyInput {
        if (hour < 0 || hour > 23) {
            throw new IllegalArgumentException("Hour must be between 0 and 23.");
        }

        if (demandKwh < 0) {
            throw new IllegalArgumentException("Demand cannot be negative.");
        }

        if (buildingLoads == null) {
            throw new IllegalArgumentException("Building loads cannot be null.");
        }

        if (solarGenerationKwh < 0) {
            throw new IllegalArgumentException("Solar generation cannot be negative.");
        }

        if (gridPricePerKwh < 0) {
            throw new IllegalArgumentException("Grid price cannot be negative.");
        }

        buildingLoads = List.copyOf(buildingLoads);

        if (!buildingLoads.isEmpty()) {
            double totalBuildingDemand = buildingLoads
                    .stream()
                    .mapToDouble(BuildingLoad::demandKwh)
                    .sum();

            if (Math.abs(totalBuildingDemand - demandKwh) > EPSILON) {
                throw new IllegalArgumentException(
                        "Total building demand must match hourly demand."
                );
            }
        }
    }
}